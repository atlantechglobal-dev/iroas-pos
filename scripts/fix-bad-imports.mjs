import fs from 'node:fs'
import path from 'node:path'

const replacements = [
  ["from '../../constants/restaurantStatus.js'", "from '@/shared/constants/restaurantStatus'"],
  ["from '../../constants/callingCodes.js'", "from '@/shared/constants/callingCodes'"],
  ["from '../../constants/digitalIdentity.js'", "from '@/shared/constants/digitalIdentity'"],
  ["from '../../constants/businessCopy.js'", "from '@/shared/constants/businessCopy'"],
  ["from '../../utils/validation.js'", "from '@/shared/utils/validation'"],
  ["from '../../utils/guestLinks.js'", "from '@/shared/utils/guestLinks'"],
  ["from '../../utils/guestOrderHistory.js'", "from '@/shared/utils/guestOrderHistory'"],
  [
    "from '../../components/businessCard/BusinessCardVisual.jsx'",
    "from '@/shared/ui/businessCard/BusinessCardVisual'",
  ],
  ["from '../constants/restaurantStatus.js'", "from '@/shared/constants/restaurantStatus'"],
  ["from '../constants/callingCodes.js'", "from '@/shared/constants/callingCodes'"],
  ["from '../services/storage/authStorage.js'", "from '@/shared/storage/authStorage'"],
  [
    "import '../DigitalBusinessCard/DigitalBusinessCard.css'",
    "import '@/features/dashboard/DigitalBusinessCard/DigitalBusinessCard.css'",
  ],
]

function walk(d, a = []) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n)
    if (fs.statSync(p).isDirectory()) walk(p, a)
    else if (/\.(jsx?|css)$/.test(n)) a.push(p)
  }
  return a
}

let count = 0
for (const f of walk('src')) {
  let t = fs.readFileSync(f, 'utf8')
  let next = t
  for (const [a, b] of replacements) next = next.split(a).join(b)
  if (next !== t) {
    fs.writeFileSync(f, next)
    count += 1
    console.log('fixed', f)
  }
}
console.log('files', count)
