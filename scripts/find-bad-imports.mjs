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

const patterns = [
  '../services/',
  '../../components/',
  '../../constants/',
  '../../utils/',
  '../../hooks/',
  '../constants/',
  '../../lib/',
  '../DigitalBusinessCard',
  "from '../../utils/",
  "from '../../constants/",
  "from '../../components/",
]

const bad = []
for (const f of walk('src')) {
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (patterns.some((p) => line.includes(p))) {
      bad.push(`${f}:${i + 1}: ${line.trim()}`)
    }
  })
}
console.log(bad.join('\n') || 'none')
