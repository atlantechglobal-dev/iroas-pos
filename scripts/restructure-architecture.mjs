/**
 * One-shot architecture migration: move folders + rewrite imports to @/ aliases.
 * Run from repo root: node scripts/restructure-architecture.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src = path.join(root, 'src')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function moveDir(fromRel, toRel) {
  const from = path.join(src, fromRel)
  const to = path.join(src, toRel)
  if (!fs.existsSync(from)) {
    console.warn('skip missing', fromRel)
    return
  }
  ensureDir(path.dirname(to))
  if (fs.existsSync(to)) {
    console.warn('target exists, merge', toRel)
    for (const name of fs.readdirSync(from)) {
      const s = path.join(from, name)
      const d = path.join(to, name)
      if (fs.existsSync(d)) {
        console.warn('  conflict', path.join(toRel, name))
        continue
      }
      fs.renameSync(s, d)
    }
    try {
      fs.rmdirSync(from)
    } catch {
      /* ignore */
    }
    return
  }
  fs.renameSync(from, to)
  console.log('moved', fromRel, '->', toRel)
}

function movePage(pageName, feature) {
  moveDir(path.join('pages', pageName), path.join('features', feature, pageName))
}

// --- physical moves ---
ensureDir(path.join(src, 'shared'))
ensureDir(path.join(src, 'features'))

moveDir('services/api', 'shared/api')
moveDir('services/storage', 'shared/storage')
moveDir('hooks', 'shared/hooks')
moveDir('constants', 'shared/constants')
moveDir('utils', 'shared/utils')
moveDir('lib', 'shared/lib')
moveDir('context', 'shared/context')
moveDir('config', 'shared/config')
moveDir('components', 'shared/ui')

const authPages = [
  'Login',
  'CreateAccount',
  'ForgotPassword',
  'AccountRecovery',
  'NewPassword',
  'PasswordUpdated',
  'AccountThanks',
  'AwaitingApproval',
]
const onboardingPages = [
  'RestaurantSetup',
  'Domain',
  'Brand',
  'Launch',
  'OnboardingPayment',
  'GoLive',
  'SetupReview',
]
const guestPages = ['GuestSite', 'GuestBusinessCard', 'GuestOneLink']
const platformPages = ['PlatformAdmin']
const systemPages = ['NotFound', 'Unauthorized']
const dashboardPages = [
  'Dashboard',
  'Analytics',
  'BusinessId',
  'Customers',
  'DigitalBusinessCard',
  'DigitalIdentity',
  'DirectoryListings',
  'Marketing',
  'Menu',
  'MobileApplication',
  'Notifications',
  'OneLink',
  'Orders',
  'Payments',
  'PosIntegration',
  'Reservations',
  'RestaurantProfile',
  'Reviews',
  'RolePermissions',
  'Settings',
  'Staff',
  'Tables',
]

for (const p of authPages) movePage(p, 'auth')
for (const p of onboardingPages) movePage(p, 'onboarding')
for (const p of guestPages) movePage(p, 'guest')
for (const p of platformPages) movePage(p, 'platform-admin')
for (const p of systemPages) movePage(p, 'system')
for (const p of dashboardPages) movePage(p, 'dashboard')

// remove empty pages dir if possible
const pagesDir = path.join(src, 'pages')
if (fs.existsSync(pagesDir) && fs.readdirSync(pagesDir).length === 0) {
  fs.rmdirSync(pagesDir)
  console.log('removed empty pages/')
}

// remove deprecated shims
for (const rel of ['App.jsx', 'shared/ui/ProtectedRoute.jsx']) {
  const p = path.join(src, rel)
  if (fs.existsSync(p)) {
    fs.unlinkSync(p)
    console.log('deleted', rel)
  }
}

// remove empty services
const servicesDir = path.join(src, 'services')
if (fs.existsSync(servicesDir) && fs.readdirSync(servicesDir).length === 0) {
  fs.rmdirSync(servicesDir)
}

console.log('physical moves done')
