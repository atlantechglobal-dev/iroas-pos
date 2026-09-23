import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('server/src')

function ensure(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function cpMove(fromRel, toRel) {
  const from = path.join(root, fromRel)
  const to = path.join(root, toRel)
  if (!fs.existsSync(from)) {
    console.warn('missing', fromRel)
    return
  }
  ensure(path.dirname(to))
  fs.cpSync(from, to, { recursive: true, force: true })
  fs.rmSync(from, { recursive: true, force: true })
  console.log('moved', fromRel, '->', toRel)
}

ensure(path.join(root, 'config'))
ensure(path.join(root, 'modules'))
ensure(path.join(root, 'infra'))
ensure(path.join(root, 'shared'))

// Move db + utils
cpMove('db.js', 'infra/db.js')
cpMove('utils/validation.js', 'shared/validation.js')
try {
  fs.rmdirSync(path.join(root, 'utils'))
} catch {
  /* ignore */
}

// Move routes into modules
cpMove('routes/auth.js', 'modules/auth/routes.js')
cpMove('routes/restaurant.js', 'modules/tenants/routes.js')
cpMove('routes/admin.js', 'modules/admin/routes.js')
cpMove('routes/menu.js', 'modules/menu/routes.js')
cpMove('routes/public.js', 'modules/public/routes.js')
cpMove('routes/identity.js', 'modules/identity/routes.js')
cpMove('routes/products.js', 'modules/identity/productRoutes.js')
cpMove('routes/notifications.js', 'modules/notifications/routes.js')
try {
  fs.rmdirSync(path.join(root, 'routes'))
} catch {
  /* ignore */
}

console.log('backend moves done')
