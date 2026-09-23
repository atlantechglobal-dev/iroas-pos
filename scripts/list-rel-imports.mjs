import fs from 'node:fs'
import path from 'node:path'

function walk(d, a = []) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n)
    if (fs.statSync(p).isDirectory()) walk(p, a)
    else if (/\.(jsx?|css)$/.test(n)) a.push(p)
  }
  return a
}

const re = /(?:import|export)\s+(?:[^'"\n]+?\s+from\s+)?['"](\.\.?\/[^'"]+)['"]/g
for (const f of walk('src')) {
  const t = fs.readFileSync(f, 'utf8')
  let m
  while ((m = re.exec(t))) {
    const spec = m[1]
    if (spec.startsWith('./') && !spec.includes('../')) continue
    if (spec.startsWith('../')) console.log(`${f}: ${spec}`)
  }
}
