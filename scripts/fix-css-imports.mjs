import fs from 'node:fs'

const fixes = [
  [
    'src/features/platform-admin/PlatformAdmin/PlatformAdmin.jsx',
    "import '../Dashboard/Dashboard.css'",
    "import '@/features/dashboard/Dashboard/Dashboard.css'",
  ],
  [
    'src/features/platform-admin/PlatformAdmin/BusinessCategoriesSettings.jsx',
    "import '../Settings/EmailSettings.css'",
    "import '@/features/dashboard/Settings/EmailSettings.css'",
  ],
]

for (const [f, a, b] of fixes) {
  let t = fs.readFileSync(f, 'utf8')
  if (!t.includes(a)) {
    console.log('missing', f)
    continue
  }
  fs.writeFileSync(f, t.split(a).join(b))
  console.log('ok', f)
}
