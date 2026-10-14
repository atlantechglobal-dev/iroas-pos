// Operator-only management of IROAS ↔ URY tenant mappings. Run from server/.
//
//   node scripts/ury-link-restaurant.js --list
//   node scripts/ury-link-restaurant.js link <owner-email | restaurant-id> \
//        --restaurant "<URY Restaurant>" --branch "<Branch>" --pos-profile "<POS Profile>" \
//        --credential-ref <REF> [--self-ordering-profile "<URY Self Ordering Profile>"]
//        [--move-from <restaurant-id>]   (moves that URY restaurant's link off another IROAS restaurant)
//   node scripts/ury-link-restaurant.js verify  <owner-email | restaurant-id>
//   node scripts/ury-link-restaurant.js disable <owner-email | restaurant-id>
//   node scripts/ury-link-restaurant.js features <owner-email | restaurant-id> \
//        [--hours on|off] [--contact on|off] [--menu on|off] [--guest-ordering on|off]
//
// Feature switches choose, per restaurant, which public-site features come from
// URY instead of local IROAS records. All default to off.
//
// <REF> names server-side env vars holding that tenant's own URY integration user:
//   URY_CRED_<REF>_API_KEY / URY_CRED_<REF>_API_SECRET  (or _USERNAME / _PASSWORD)
// A link is saved only after it verifies with that credential. Nothing is
// written to URY; credentials are never printed.

import 'dotenv/config'
import { db } from '../src/infra/db.js'
import { getList, UryError } from '../src/integrations/ury/uryClient.js'
import {
  credentialEnvNames,
  getTenantClient,
  getTenantCredential,
  isValidCredentialRef,
} from '../src/integrations/ury/uryCredentials.js'
import {
  disableUryRestaurant,
  getUryIntegration,
  IntegrationError,
  linkUryRestaurant,
  resolveUryTenant,
  verifyUryMapping,
} from '../src/integrations/ury/uryTenant.js'

const [command, target, ...rest] = process.argv.slice(2)

function usage() {
  console.log(
    [
      'Usage (from server/):',
      '  node scripts/ury-link-restaurant.js --list',
      '  node scripts/ury-link-restaurant.js link <owner-email | restaurant-id> --restaurant "<URY Restaurant>"',
      '       --branch "<Branch>" --pos-profile "<POS Profile>" --credential-ref <REF>',
      '       [--self-ordering-profile "<URY Self Ordering Profile>"] [--move-from <restaurant-id>]',
      '  node scripts/ury-link-restaurant.js verify <owner-email | restaurant-id>',
      '  node scripts/ury-link-restaurant.js disable <owner-email | restaurant-id>',
      '  node scripts/ury-link-restaurant.js features <owner-email | restaurant-id> [--hours on|off] [--contact on|off]',
      '       [--menu on|off] [--guest-ordering on|off]',
    ].join('\n'),
  )
  process.exit(1)
}

function parseFlags(args) {
  const flags = {}
  for (let i = 0; i < args.length; i += 1) {
    const m = /^--([a-z-]+)$/.exec(args[i])
    if (!m || args[i + 1] === undefined) usage()
    flags[m[1]] = args[i + 1]
    i += 1
  }
  return flags
}

function findRestaurant(t) {
  if (!t) usage()
  const restaurant = /^\d+$/.test(t)
    ? db.prepare('SELECT id, name FROM restaurants WHERE id = ?').get(Number(t))
    : db
        .prepare('SELECT r.id, r.name FROM restaurants r JOIN users u ON u.id = r.owner_id WHERE lower(u.email) = lower(?)')
        .get(t)
  if (!restaurant) {
    console.log(`No IROAS restaurant found for "${t}".`)
    process.exit(1)
  }
  return restaurant
}

function describeError(err) {
  if (err instanceof IntegrationError) return `${err.code}${err.reason ? ` (${err.reason})` : ''}`
  if (err instanceof UryError) return `URY ${err.code}`
  return err?.message || String(err)
}

if (command === '--list') {
  // Operator credential, read-only. Self-ordering profiles: non-secret fields only.
  console.table(await getList('URY Restaurant', { fields: ['name', 'company', 'branch', 'active_menu'] }))
  console.table(await getList('POS Profile', { fields: ['name', 'restaurant', 'branch', 'disabled'] }))
  console.table(
    await getList('URY Self Ordering Profile', { fields: ['name', 'restaurant', 'branch', 'pos_profile', 'enabled'] }),
  )
  const links = db
    .prepare(
      `SELECT ri.restaurant_id, r.name AS iroas_restaurant, ri.external_restaurant, ri.ury_branch,
              ri.ury_pos_profile, ri.ury_self_ordering_profile, ri.credential_ref, ri.verified_user,
              ri.verified_at, ri.status
       FROM restaurant_integrations ri JOIN restaurants r ON r.id = ri.restaurant_id
       WHERE ri.provider = 'ury'`,
    )
    .all()
    .map((row) => ({ ...row, credential_present: Boolean(getTenantCredential(row.credential_ref)) }))
  console.log('\nCurrent IROAS ↔ URY links:')
  console.table(links)
  process.exit(0)
}

if (command === 'link') {
  const restaurant = findRestaurant(target)
  const flags = parseFlags(rest)
  const mapping = {
    external_restaurant: flags.restaurant,
    ury_branch: flags.branch,
    ury_pos_profile: flags['pos-profile'],
    ury_self_ordering_profile: flags['self-ordering-profile'] || null,
    credential_ref: flags['credential-ref'],
  }
  if (!mapping.external_restaurant || !mapping.ury_branch || !mapping.ury_pos_profile || !mapping.credential_ref) usage()
  if (!isValidCredentialRef(mapping.credential_ref)) {
    console.log('--credential-ref must be uppercase letters, digits and underscores (e.g. TENANT_62).')
    process.exit(1)
  }
  const client = getTenantClient(mapping.credential_ref)
  if (!client) {
    const names = credentialEnvNames(mapping.credential_ref)
    console.log(
      `No credential found for ${mapping.credential_ref}. Set ${names.apiKey} + ${names.apiSecret} ` +
        `(or ${names.username} + ${names.password}) in server/.env, then retry.`,
    )
    process.exit(1)
  }
  const moveFrom = flags['move-from'] ? Number(flags['move-from']) : null
  if (moveFrom !== null) {
    const holder = db
      .prepare(`SELECT restaurant_id FROM restaurant_integrations WHERE provider = 'ury' AND external_restaurant = ?`)
      .get(mapping.external_restaurant)
    if (!holder || holder.restaurant_id !== moveFrom) {
      console.log(`--move-from ${moveFrom}: that IROAS restaurant does not hold the link to "${mapping.external_restaurant}". Nothing changed.`)
      process.exit(1)
    }
  }
  try {
    const { user } = await verifyUryMapping(mapping, client, { restaurantId: restaurant.id })
    db.transaction(() => {
      if (moveFrom !== null) {
        db.prepare(`DELETE FROM restaurant_integrations WHERE provider = 'ury' AND restaurant_id = ?`).run(moveFrom)
        console.log(`Removed the URY link from IROAS restaurant #${moveFrom}.`)
      }
      linkUryRestaurant(restaurant.id, mapping, { verifiedUser: user })
    })()
    console.log(
      `Linked IROAS restaurant #${restaurant.id} "${restaurant.name}" → URY "${mapping.external_restaurant}" ` +
        `(branch "${mapping.ury_branch}", POS profile "${mapping.ury_pos_profile}"` +
        `${mapping.ury_self_ordering_profile ? `, self-ordering "${mapping.ury_self_ordering_profile}"` : ''}) ` +
        `as integration user ${user}.`,
    )
  } catch (err) {
    if (String(err?.message).includes('UNIQUE')) {
      console.log('That URY restaurant or credential reference is already linked to another IROAS restaurant.')
    } else {
      console.log(`Not linked: ${describeError(err)}`)
    }
    process.exit(1)
  }
  process.exit(0)
}

if (command === 'verify') {
  const restaurant = findRestaurant(target)
  if (!getUryIntegration(restaurant.id)) {
    console.log(`IROAS restaurant #${restaurant.id} has no URY mapping.`)
    process.exit(1)
  }
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    console.log(
      `OK: #${restaurant.id} → URY "${tenant.uryRestaurant}" / "${tenant.branch}" / "${tenant.posProfile}"` +
        `${tenant.selfOrderingProfile ? ` / "${tenant.selfOrderingProfile}"` : ''} as ${tenant.integrationUser}.`,
    )
    process.exit(0)
  } catch (err) {
    console.log(`Verification failed: ${describeError(err)}`)
    process.exit(1)
  }
}

if (command === 'features') {
  const restaurant = findRestaurant(target)
  if (!getUryIntegration(restaurant.id)) {
    console.log(`IROAS restaurant #${restaurant.id} has no URY mapping.`)
    process.exit(1)
  }
  const flags = parseFlags(rest)
  const columns = { hours: 'feature_hours', contact: 'feature_contact', menu: 'feature_menu', 'guest-ordering': 'feature_guest_ordering' }
  for (const [flag, value] of Object.entries(flags)) {
    if (!columns[flag] || !['on', 'off'].includes(value)) usage()
    db.prepare(`UPDATE restaurant_integrations SET ${columns[flag]} = ? WHERE provider = 'ury' AND restaurant_id = ?`).run(
      value === 'on' ? 1 : 0,
      restaurant.id,
    )
  }
  const row = getUryIntegration(restaurant.id)
  console.log(`URY features for #${restaurant.id} "${restaurant.name}":`)
  console.table({
    hours: Boolean(row.feature_hours),
    contact: Boolean(row.feature_contact),
    menu: Boolean(row.feature_menu),
    guestOrdering: Boolean(row.feature_guest_ordering),
  })
  if (row.feature_guest_ordering && !row.feature_menu) console.log('Note: guest ordering only shows when the URY menu is also on.')
  if (row.feature_guest_ordering && !row.ury_self_ordering_profile) console.log('Note: guest ordering needs --self-ordering-profile on the link.')
  process.exit(0)
}

if (command === 'disable') {
  const restaurant = findRestaurant(target)
  console.log(
    disableUryRestaurant(restaurant.id)
      ? `Disabled URY integration for IROAS restaurant #${restaurant.id}.`
      : `IROAS restaurant #${restaurant.id} has no URY mapping.`,
  )
  process.exit(0)
}

usage()
