import fs from 'fs'

const path = 'src/pages/RestaurantProfile/RestaurantProfile.jsx'
let s = fs.readFileSync(path, 'utf8')

const mainOpen = '<main className="content" id="top">'
const start = s.indexOf(mainOpen)
const end = s.indexOf('</main>', start)
if (start === -1 || end === -1) {
  console.error('Could not find main content')
  process.exit(1)
}

const content = s.slice(start + mainOpen.length, end).trim()

if (!s.includes('DashboardLayout')) {
  s = s.replace(
    "import './RestaurantProfile.css'",
    "import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'\nimport './RestaurantProfile.css'",
  )
}

s = s.replace(/import \{ useNavigate \}[^\n]+\n/, '')
s = s.replace(/  const navigate = useNavigate\(\)\n/, '')
s = s.replace(/  const \[profileOpen, setProfileOpen\] = useState\(false\)\n/, '')
s = s.replace(/  const handleLogout = \(\) => \{[\s\S]*?\n  \}\n\n/, '')
s = s.replace(/  const handleNavClick = \(item\) => \{[\s\S]*?\n  \}\n\n/, '')

const fnStart = s.indexOf('  return (')
const before = s.slice(0, fnStart)

const after = `
  return (
    <DashboardLayout pageClassName="restaurant-profile-page" activeNav="restaurant-profile">
${content}
    </DashboardLayout>
  )
}

export default RestaurantProfile
`

fs.writeFileSync(path, before + after)
console.log('Migrated RestaurantProfile, content length:', content.length)
