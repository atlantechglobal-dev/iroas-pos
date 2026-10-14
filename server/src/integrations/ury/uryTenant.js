// Resolves an authenticated IROAS restaurant to its verified URY tenant.
// The mapping row in restaurant_integrations is the only source of URY
// identity (restaurant, branch, POS profile, self-ordering profile). The URY
// login is used only to authenticate — never to decide which restaurant a
// request belongs to — and every mapped value is checked against URY before
// a scoped client is handed to the integration modules.

import { db } from '../../infra/db.js'
import { getEnv, isProd } from '../../config/env.js'
import { getUryBaseUrl, UryError } from './uryClient.js'
import { getTenantClient, isValidCredentialRef } from './uryCredentials.js'

export class IntegrationError extends Error {
  constructor(code, message, { reason = '' } = {}) {
    super(message)
    this.name = 'IntegrationError'
    this.code = code
    this.reason = reason
  }
}

const VERIFY_TTL_MS = 5 * 60_000
const verifiedTenants = new Map()

function notConnected() {
  return new IntegrationError('not_connected', 'POS is not connected.')
}

function invalid(reason) {
  return new IntegrationError('mapping_invalid', 'POS mapping is invalid.', { reason })
}

function administratorAllowed() {
  return !isProd() && getEnv('URY_ALLOW_ADMINISTRATOR_CREDENTIAL') === 'true'
}

/** The mapping row for a restaurant (any status), or undefined. */
export function getUryIntegration(restaurantId) {
  return db
    .prepare(`SELECT * FROM restaurant_integrations WHERE restaurant_id = ? AND provider = 'ury'`)
    .get(restaurantId)
}

function missingFields(mapping) {
  const missing = []
  if (!mapping.external_restaurant) missing.push('restaurant')
  if (!mapping.ury_branch) missing.push('branch')
  if (!mapping.ury_pos_profile) missing.push('pos_profile')
  if (!isValidCredentialRef(mapping.credential_ref)) missing.push('credential_ref')
  return missing
}

/** Maps URY read failures during verification to a mapping problem; network failures propagate. */
async function check(fn, notFoundReason) {
  try {
    return await fn()
  } catch (err) {
    if (!(err instanceof UryError)) throw err
    if (err.code === 'not_found') throw invalid(notFoundReason)
    if (err.code === 'forbidden') throw invalid('permission_missing')
    if (err.code === 'auth_failed') throw invalid('credentials_rejected')
    throw err
  }
}

/**
 * Verifies a mapping with the tenant's own client. Throws IntegrationError
 * ('mapping_invalid', reason) on any mismatch; returns { user } on success.
 * Used on every (cache-expired) request and by the operator link script.
 */
export async function verifyUryMapping(mapping, client, { restaurantId } = {}) {
  const missing = missingFields(mapping)
  if (missing.length) throw invalid(`mapping_incomplete:${missing.join(',')}`)
  if (!client) throw invalid('credentials_missing')

  const restaurant = mapping.external_restaurant
  const branch = mapping.ury_branch
  const posProfile = mapping.ury_pos_profile
  const selfProfile = mapping.ury_self_ordering_profile || null

  const user = await check(() => client.getLoggedUser(), 'credentials_rejected')
  if (user === 'Administrator' && !administratorAllowed()) throw invalid('administrator_credential')

  const sharedWith = db
    .prepare(
      `SELECT restaurant_id FROM restaurant_integrations
       WHERE provider = 'ury' AND status = 'active' AND verified_user = ? AND restaurant_id != ?`,
    )
    .get(user, restaurantId ?? -1)
  if (sharedWith) throw invalid('credential_shared')

  const uryRestaurant = (await check(() => client.getDoc('URY Restaurant', restaurant), 'restaurant_not_found')).docs[0]
  if (uryRestaurant.name !== restaurant) throw invalid('restaurant_not_found')
  if (uryRestaurant.branch !== branch) throw invalid('restaurant_branch_mismatch')

  const branchDoc = (await check(() => client.getDoc('Branch', branch), 'branch_not_found')).docs[0]
  const branchUsers = (branchDoc.user || []).filter((row) => row.parent === branchDoc.name).map((row) => row.user)
  if (!branchUsers.includes(user)) throw invalid('user_not_in_branch')

  // URY resolves the session user's branch and POS profile itself (getBranch()
  // reads Branch → URY User); menu and ordering calls depend on this result.
  let effective
  try {
    effective = (await client.get('ury.ury_pos.api.getPosProfile'))?.message || {}
  } catch (err) {
    if (err instanceof UryError && err.status >= 400 && !['unreachable', 'timeout'].includes(err.code)) {
      throw invalid(err.code === 'auth_failed' ? 'credentials_rejected' : 'user_branch_unresolved')
    }
    throw err
  }
  if (effective.branch !== branch) throw invalid('user_branch_mismatch')
  if (effective.pos_profile !== posProfile) throw invalid('pos_profile_mismatch')

  const profiles = await check(
    () =>
      client.getList('POS Profile', {
        fields: ['name', 'restaurant', 'branch', 'disabled'],
        filters: { name: posProfile },
        limit: 2,
      }),
    'pos_profile_not_found',
  )
  const profile = profiles.find((p) => p.name === posProfile)
  if (!profile) throw invalid('pos_profile_not_found')
  if (profile.restaurant !== restaurant || profile.branch !== branch) throw invalid('pos_profile_mismatch')
  if (profile.disabled === 1) throw invalid('pos_profile_disabled')

  if (selfProfile) {
    // Only non-secret fields: the DocType also holds qr_signing_secret and staff_pin.
    const rows = await check(
      () =>
        client.getList('URY Self Ordering Profile', {
          fields: ['name', 'restaurant', 'branch', 'pos_profile', 'enabled'],
          filters: { name: selfProfile },
          limit: 2,
        }),
      'self_ordering_profile_not_found',
    )
    const sp = rows.find((r) => r.name === selfProfile)
    if (!sp) throw invalid('self_ordering_profile_not_found')
    if (sp.restaurant !== restaurant || sp.branch !== branch || sp.pos_profile !== posProfile) {
      throw invalid('self_ordering_profile_mismatch')
    }
    if (sp.enabled !== 1) throw invalid('self_ordering_profile_disabled')
  }

  return { user }
}

function cacheKey(row) {
  return [
    row.updated_at,
    row.external_restaurant,
    row.ury_branch,
    row.ury_pos_profile,
    row.ury_self_ordering_profile,
    row.credential_ref,
  ].join('\u0000')
}

/**
 * Returns the verified URY tenant for an IROAS restaurant id taken from the
 * authenticated owner (never from the request):
 *   { restaurantId, uryRestaurant, branch, posProfile, selfOrderingProfile, integrationUser, client }
 * Throws IntegrationError('not_connected' | 'mapping_invalid').
 */
export async function resolveUryTenant(restaurantId) {
  if (!getUryBaseUrl()) throw notConnected()
  const row = getUryIntegration(restaurantId)
  if (!row || row.status !== 'active') throw notConnected()

  const key = cacheKey(row)
  const hit = verifiedTenants.get(restaurantId)
  if (hit && hit.key === key && hit.expires > Date.now()) return hit.tenant

  verifiedTenants.delete(restaurantId)
  const client = isValidCredentialRef(row.credential_ref) ? getTenantClient(row.credential_ref) : null
  let user
  try {
    ;({ user } = await verifyUryMapping(row, client, { restaurantId }))
    db.prepare(
      `UPDATE restaurant_integrations SET verified_user = ?, verified_at = datetime('now') WHERE id = ?`,
    ).run(user, row.id)
  } catch (err) {
    if (err instanceof IntegrationError) {
      db.prepare(`UPDATE restaurant_integrations SET verified_user = NULL, verified_at = NULL WHERE id = ?`).run(row.id)
    }
    if (String(err?.message).includes('UNIQUE')) throw invalid('credential_shared')
    throw err
  }

  const tenant = Object.freeze({
    restaurantId,
    uryRestaurant: row.external_restaurant,
    branch: row.ury_branch,
    posProfile: row.ury_pos_profile,
    selfOrderingProfile: row.ury_self_ordering_profile || null,
    integrationUser: user,
    client,
  })
  verifiedTenants.set(restaurantId, { key, tenant, expires: Date.now() + VERIFY_TTL_MS })
  return tenant
}

/** Forces re-verification on the next request (e.g. after URY rejected the credential). */
export function invalidateUryTenant(restaurantId) {
  verifiedTenants.delete(restaurantId)
}

export function clearUryTenantCache() {
  verifiedTenants.clear()
}

/** Operator-only: saves a mapping that has already passed verifyUryMapping. */
export function linkUryRestaurant(restaurantId, mapping, { verifiedUser }) {
  db.prepare(
    `INSERT INTO restaurant_integrations
       (restaurant_id, provider, external_restaurant, ury_branch, ury_pos_profile,
        ury_self_ordering_profile, credential_ref, verified_user, verified_at, status)
     VALUES (?, 'ury', ?, ?, ?, ?, ?, ?, datetime('now'), 'active')
     ON CONFLICT (restaurant_id, provider)
     DO UPDATE SET external_restaurant = excluded.external_restaurant,
                   ury_branch = excluded.ury_branch,
                   ury_pos_profile = excluded.ury_pos_profile,
                   ury_self_ordering_profile = excluded.ury_self_ordering_profile,
                   credential_ref = excluded.credential_ref,
                   verified_user = excluded.verified_user,
                   verified_at = excluded.verified_at,
                   status = 'active',
                   updated_at = datetime('now')`,
  ).run(
    restaurantId,
    mapping.external_restaurant,
    mapping.ury_branch,
    mapping.ury_pos_profile,
    mapping.ury_self_ordering_profile || null,
    mapping.credential_ref,
    verifiedUser,
  )
  invalidateUryTenant(restaurantId)
  return getUryIntegration(restaurantId)
}

/** Operator-only: disables a restaurant's URY integration (requests then return pos_not_connected). */
export function disableUryRestaurant(restaurantId) {
  const result = db
    .prepare(
      `UPDATE restaurant_integrations
       SET status = 'disabled', verified_user = NULL, verified_at = NULL, updated_at = datetime('now')
       WHERE restaurant_id = ? AND provider = 'ury'`,
    )
    .run(restaurantId)
  invalidateUryTenant(restaurantId)
  return result.changes > 0
}
