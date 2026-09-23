/**
 * Rewrite imports after architecture move to use @/ aliases.
 * Run: node scripts/rewrite-imports.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcRoot = path.resolve(__dirname, '../src')

const PAGE_TO_FEATURE = {
  Login: 'auth',
  CreateAccount: 'auth',
  ForgotPassword: 'auth',
  AccountRecovery: 'auth',
  NewPassword: 'auth',
  PasswordUpdated: 'auth',
  AccountThanks: 'auth',
  AwaitingApproval: 'auth',
  RestaurantSetup: 'onboarding',
  Domain: 'onboarding',
  Brand: 'onboarding',
  Launch: 'onboarding',
  OnboardingPayment: 'onboarding',
  GoLive: 'onboarding',
  SetupReview: 'onboarding',
  GuestSite: 'guest',
  GuestBusinessCard: 'guest',
  GuestOneLink: 'guest',
  PlatformAdmin: 'platform-admin',
  NotFound: 'system',
  Unauthorized: 'system',
  Dashboard: 'dashboard',
  Analytics: 'dashboard',
  BusinessId: 'dashboard',
  Customers: 'dashboard',
  DigitalBusinessCard: 'dashboard',
  DigitalIdentity: 'dashboard',
  DirectoryListings: 'dashboard',
  Marketing: 'dashboard',
  Menu: 'dashboard',
  MobileApplication: 'dashboard',
  Notifications: 'dashboard',
  OneLink: 'dashboard',
  Orders: 'dashboard',
  Payments: 'dashboard',
  PosIntegration: 'dashboard',
  Reservations: 'dashboard',
  RestaurantProfile: 'dashboard',
  Reviews: 'dashboard',
  RolePermissions: 'dashboard',
  Settings: 'dashboard',
  Staff: 'dashboard',
  Tables: 'dashboard',
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(jsx?|tsx?|css|mjs)$/.test(name)) out.push(p)
  }
  return out
}

function toPosix(p) {
  return p.split(path.sep).join('/')
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null
  return path.normalize(path.resolve(path.dirname(fromFile), spec))
}

function absoluteToAlias(absPath) {
  let rel = toPosix(path.relative(srcRoot, absPath))
  // strip extension for JS modules
  rel = rel.replace(/\.(jsx?|tsx?|mjs)$/, '')
  if (rel.startsWith('..')) return null
  return `@/${rel}`
}

function rewriteSpec(fromFile, spec) {
  // Already aliased
  if (spec.startsWith('@/')) return spec

  // Bare-ish old patterns without relative (unlikely)
  const replacements = [
    [/^(\.\.\/)+services\/api(\/|$)/, '@/shared/api$2'],
    [/^(\.\.\/)+services\/storage(\/|$)/, '@/shared/storage$2'],
    [/^(\.\.\/)+hooks(\/|$)/, '@/shared/hooks$2'],
    [/^(\.\.\/)+constants(\/|$)/, '@/shared/constants$2'],
    [/^(\.\.\/)+utils(\/|$)/, '@/shared/utils$2'],
    [/^(\.\.\/)+lib(\/|$)/, '@/shared/lib$2'],
    [/^(\.\.\/)+context(\/|$)/, '@/shared/context$2'],
    [/^(\.\.\/)+config(\/|$)/, '@/shared/config$2'],
    [/^(\.\.\/)+components(\/|$)/, '@/shared/ui$2'],
    [/^(\.\.\/)+styles(\/|$)/, '@/styles$2'],
    [/^(\.\.\/)+app(\/|$)/, '@/app$2'],
  ]

  for (const [re, repl] of replacements) {
    if (re.test(spec)) {
      let next = spec.replace(re, repl)
      // pages/Foo -> features/...
      next = next.replace(/@\/pages\/([A-Za-z0-9_-]+)/, (_, page) => {
        const feature = PAGE_TO_FEATURE[page]
        return feature ? `@/features/${feature}/${page}` : `@/features/${page}`
      })
      return next.replace(/\.jsx?$/, '').replace(/\.tsx?$/, '')
    }
  }

  // pages imports
  const pageMatch = spec.match(/^(\.\.\/)+pages\/([A-Za-z0-9_-]+)(.*)$/)
  if (pageMatch) {
    const page = pageMatch[2]
    const rest = pageMatch[3] || ''
    const feature = PAGE_TO_FEATURE[page]
    if (feature) {
      return `@/features/${feature}/${page}${rest}`.replace(/\.jsx?$/, '')
    }
  }

  // Resolve relative and map if under src
  const abs = resolveImport(fromFile, spec)
  if (!abs) return null
  // try with extensions
  const candidates = [
    abs,
    `${abs}.js`,
    `${abs}.jsx`,
    `${abs}.ts`,
    `${abs}.tsx`,
    path.join(abs, 'index.js'),
    path.join(abs, 'index.jsx'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      const alias = absoluteToAlias(c)
      if (alias) return alias
    }
  }
  // directory without index — keep relative but under new tree if path exists as moved
  return null
}

const importRe =
  /(import\s+(?:type\s+)?(?:[^'"\n]+?\s+from\s+)?|export\s+(?:[^'"\n]+?\s+from\s+)?|import\s*\(\s*)['"]([^'"]+)['"]/g

let changedFiles = 0
const files = walk(srcRoot)

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8')
  let next = original
  next = next.replace(importRe, (full, prefix, spec) => {
    // CSS relative assets stay relative when same folder
    if (spec.endsWith('.css') || spec.endsWith('.svg') || spec.endsWith('.png')) {
      // still rewrite if pointing to moved trees via relative
      const rewritten = rewriteSpec(file, spec)
      if (rewritten) return `${prefix}'${rewritten}'`
      return full
    }
    const rewritten = rewriteSpec(file, spec)
    if (rewritten && rewritten !== spec) {
      return `${prefix}'${rewritten}'`
    }
    return full
  })

  // Fix known string paths in routePrefetch etc that use import()
  next = next.replace(
    /import\(\s*['"](\.\.\/)+pages\/([A-Za-z0-9_-]+)\/([^'"]+)['"]\s*\)/g,
    (full, _dots, page, rest) => {
      const feature = PAGE_TO_FEATURE[page]
      if (!feature) return full
      return `import('@/features/${feature}/${page}/${rest}')`
    },
  )

  if (next !== original) {
    fs.writeFileSync(file, next)
    changedFiles += 1
    console.log('updated', toPosix(path.relative(srcRoot, file)))
  }
}

console.log(`rewrote ${changedFiles} files`)
