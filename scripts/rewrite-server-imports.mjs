import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('server/src')

function walk(d, a = []) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n)
    if (fs.statSync(p).isDirectory()) walk(p, a)
    else if (/\.js$/.test(n)) a.push(p)
  }
  return a
}

function rewriteFile(file, rules) {
  let t = fs.readFileSync(file, 'utf8')
  let next = t
  for (const [a, b] of rules) next = next.split(a).join(b)
  if (next !== t) {
    fs.writeFileSync(file, next)
    return true
  }
  return false
}

let count = 0

// services: ../db.js -> ../infra/db.js, ../utils/validation -> ../shared/validation
for (const f of walk(path.join(root, 'services'))) {
  if (
    rewriteFile(f, [
      ["from '../db.js'", "from '../infra/db.js'"],
      ['from "../db.js"', 'from "../infra/db.js"'],
      ["from '../utils/validation.js'", "from '../shared/validation.js'"],
    ])
  ) {
    count += 1
    console.log('svc', path.relative(root, f))
  }
}

// middleware
for (const f of walk(path.join(root, 'middleware'))) {
  if (
    rewriteFile(f, [
      ["from '../db.js'", "from '../infra/db.js'"],
      ["from '../utils/validation.js'", "from '../shared/validation.js'"],
    ])
  ) {
    count += 1
    console.log('mw', path.relative(root, f))
  }
}

// modules: deeper paths
for (const f of walk(path.join(root, 'modules'))) {
  if (
    rewriteFile(f, [
      ["from '../db.js'", "from '../../infra/db.js'"],
      ["from '../middleware/auth.js'", "from '../../middleware/auth.js'"],
      ["from '../services/", "from '../../services/"],
      ["from '../utils/validation.js'", "from '../../shared/validation.js'"],
    ])
  ) {
    count += 1
    console.log('mod', path.relative(root, f))
  }
}

// seed + any top-level
for (const name of ['seed.js', 'index.js']) {
  const f = path.join(root, name)
  if (!fs.existsSync(f)) continue
  if (
    rewriteFile(f, [
      ["from './db.js'", "from './infra/db.js'"],
      ["from './utils/validation.js'", "from './shared/validation.js'"],
      ["from './routes/auth.js'", "from './modules/auth/routes.js'"],
      ["from './routes/restaurant.js'", "from './modules/tenants/routes.js'"],
      ["from './routes/admin.js'", "from './modules/admin/routes.js'"],
      ["from './routes/menu.js'", "from './modules/menu/routes.js'"],
      ["from './routes/public.js'", "from './modules/public/routes.js'"],
      ["from './routes/identity.js'", "from './modules/identity/routes.js'"],
      ["from './routes/products.js'", "from './modules/identity/productRoutes.js'"],
      ["from './routes/notifications.js'", "from './modules/notifications/routes.js'"],
    ])
  ) {
    count += 1
    console.log('top', name)
  }
}

console.log('updated', count)
