// Operator-only, idempotent creation of a dedicated URY integration user for
// one IROAS restaurant (never Administrator, never shared between tenants):
//   - User <email> (System User, roles URY Manager + Employee, no welcome email)
//   - row in Branch <branch> → URY User   (URY resolves the user's branch from it)
//   - row in POS Profile <profile> → Applicable for Users (default = 0)
//   - API key/secret via frappe.core.doctype.user.user.generate_keys, written
//     only to server/.env as URY_CRED_<REF>_API_KEY / _API_SECRET (never printed)
// URY Manager is the narrowest stock URY role that can read Address and the
// Branch Operating Schedule/Exception and write the Self Ordering Profile
// (needed by self_ordering.generate_qr_token).
//
//   node scripts/ury-integration-user.js --ref TENANT_62 --email iroas-integration-62@iroas.com \
//        --branch "Demo Branch" --pos-profile "Demo Profile"            (dry run)
//   ... --apply
//
// Uses the operator credential and standard Frappe methods only.

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDoc, uryPost, UryError } from '../src/integrations/ury/uryClient.js'
import { credentialEnvNames, isValidCredentialRef } from '../src/integrations/ury/uryCredentials.js'

const ROLES = ['URY Manager', 'Employee']
const ENV_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env')

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : ''
}
const apply = args.includes('--apply')
const ref = flag('ref')
const email = flag('email').toLowerCase()
const branch = flag('branch')
const posProfile = flag('pos-profile')

if (!isValidCredentialRef(ref) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !branch || !posProfile) {
  console.log(
    'Usage: node scripts/ury-integration-user.js --ref <REF> --email <email> --branch "<Branch>" --pos-profile "<POS Profile>" [--apply]',
  )
  process.exit(1)
}
if (email === 'administrator') {
  console.log('Refusing to use Administrator as an integration user.')
  process.exit(1)
}

async function load(doctype, name) {
  try {
    return (await getDoc(doctype, name)).docs[0]
  } catch (err) {
    if (err instanceof UryError && err.code === 'not_found') return null
    throw err
  }
}

const names = credentialEnvNames(ref)
const envText = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : ''
const envHas = (key) => new RegExp(`^\\s*${key}\\s*=\\s*\\S`, 'm').test(envText)

const user = await load('User', email)
const branchDoc = await load('Branch', branch)
const profileDoc = await load('POS Profile', posProfile)
if (!branchDoc || !profileDoc) {
  console.log(`${!branchDoc ? `Branch "${branch}"` : `POS Profile "${posProfile}"`} not found in URY. Nothing done.`)
  process.exit(1)
}
if (profileDoc.branch !== branch) {
  console.log(`POS Profile "${posProfile}" belongs to branch "${profileDoc.branch}", not "${branch}". Nothing done.`)
  process.exit(1)
}

const plan = []
if (!user) plan.push('user')
else if (user.enabled !== 1) {
  console.log(`URY user ${email} exists but is disabled. Enable it in URY desk first. Nothing done.`)
  process.exit(1)
}
const missingRoles = ROLES.filter((r) => !(user?.roles || []).some((x) => x.role === r))
if (user && missingRoles.length) plan.push('roles')
if (!(branchDoc.user || []).some((r) => r.user === email)) plan.push('branch')
if (!(profileDoc.applicable_for_users || []).some((r) => r.user === email)) plan.push('pos_profile')
if (!envHas(names.apiKey) || !envHas(names.apiSecret)) plan.push('api_keys')

console.log(`Integration user ${email} · ref ${ref} · branch "${branch}" · POS profile "${posProfile}"`)
if (!plan.length) {
  console.log('Nothing to do.')
  process.exit(0)
}
console.log(`${apply ? 'Doing' : 'Would do'}: ${plan.join(', ')}`)
if (!apply) {
  console.log('Dry run. Re-run with --apply to write these changes.')
  process.exit(0)
}

if (plan.includes('user')) {
  await uryPost('frappe.client.insert', {
    doc: {
      doctype: 'User',
      email,
      first_name: 'IROAS Integration',
      last_name: ref,
      user_type: 'System User',
      send_welcome_email: 0,
      enabled: 1,
      roles: ROLES.map((role) => ({ role })),
    },
  })
  console.log(`Created URY user ${email} with roles ${ROLES.join(', ')}.`)
}
if (plan.includes('roles')) {
  for (const role of missingRoles) {
    await uryPost('frappe.client.insert', {
      doc: { doctype: 'Has Role', parenttype: 'User', parent: email, parentfield: 'roles', role },
    })
  }
  console.log(`Added roles ${missingRoles.join(', ')}.`)
}
if (plan.includes('branch')) {
  await uryPost('frappe.client.insert', {
    doc: { doctype: 'URY User', parenttype: 'Branch', parent: branch, parentfield: 'user', user: email },
  })
  console.log(`Added ${email} to Branch "${branch}" → URY User.`)
}
if (plan.includes('pos_profile')) {
  await uryPost('frappe.client.insert', {
    doc: {
      doctype: 'POS Profile User',
      parenttype: 'POS Profile',
      parent: posProfile,
      parentfield: 'applicable_for_users',
      user: email,
      default: 0,
    },
  })
  console.log(`Added ${email} to POS Profile "${posProfile}" → Applicable for Users.`)
}
if (plan.includes('api_keys')) {
  const body = await uryPost('frappe.core.doctype.user.user.generate_keys', { user: email })
  const secret = body?.message?.api_secret
  const key = body?.message?.api_key || (await load('User', email))?.api_key
  if (!secret || !key) {
    console.log('URY did not return an API key/secret. Generate them in URY desk (User → API Access) and add them to server/.env.')
    process.exit(1)
  }
  const kept = envText
    .split(/\r?\n/)
    .filter((line) => !new RegExp(`^\\s*(${names.apiKey}|${names.apiSecret})\\s*=`).test(line))
    .join('\n')
    .replace(/\n*$/, '\n')
  fs.writeFileSync(ENV_PATH, `${kept}${names.apiKey}=${key}\n${names.apiSecret}=${secret}\n`)
  console.log(`Generated API keys and saved ${names.apiKey} / ${names.apiSecret} to server/.env (values not shown).`)
}
console.log('Done. Restart the IROAS backend so it reads the new credential.')
