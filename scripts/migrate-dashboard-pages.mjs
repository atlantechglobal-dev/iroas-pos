/**
 * One-time migration helper: strip duplicated shell JSX from dashboard pages.
 * Run: node scripts/migrate-dashboard-pages.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pagesDir = path.join(__dirname, '..', 'src', 'pages')

const PAGES = [
  { file: 'Orders/Orders.jsx', pageClass: 'orders-page', activeNav: 'incoming-orders' },
  { file: 'Tables/Tables.jsx', pageClass: 'tables-page', activeNav: 'tables' },
  { file: 'Staff/Staff.jsx', pageClass: 'staff-page', activeNav: 'staff' },
  { file: 'Settings/Settings.jsx', pageClass: 'settings-page', activeNav: 'settings' },
  { file: 'Reviews/Reviews.jsx', pageClass: 'reviews-page', activeNav: 'reviews' },
  { file: 'Reservations/Reservations.jsx', pageClass: 'reservations-page', activeNav: 'reservations' },
  { file: 'PosIntegration/PosIntegration.jsx', pageClass: 'pos-page', activeNav: 'pos' },
  { file: 'Payments/Payments.jsx', pageClass: 'payments-page', activeNav: 'payments' },
  { file: 'Analytics/Analytics.jsx', pageClass: 'analytics-page', activeNav: 'analytics' },
  { file: 'Marketing/Marketing.jsx', pageClass: 'marketing-page', activeNav: 'marketing' },
  { file: 'Notifications/Notifications.jsx', pageClass: 'notifications-page', activeNav: 'notifications' },
  { file: 'OneLink/OneLink.jsx', pageClass: 'one-link-page', activeNav: 'one-link' },
  { file: 'DirectoryListings/DirectoryListings.jsx', pageClass: 'directory-page', activeNav: 'directory-listings' },
  { file: 'DigitalBusinessCard/DigitalBusinessCard.jsx', pageClass: 'business-card-page', activeNav: 'digital-business-card' },
]

function extractMainContent(source) {
  const startMarkers = [
    '<main className="content" id="top">',
    "<main className=\"content\" id=\"top\">",
  ]
  let startIdx = -1
  let markerLen = 0
  for (const m of startMarkers) {
    const idx = source.indexOf(m)
    if (idx !== -1) {
      startIdx = idx
      markerLen = m.length
      break
    }
  }
  if (startIdx === -1) return null

  const contentStart = startIdx + markerLen
  const endTag = '</main>'
  const endIdx = source.indexOf(endTag, contentStart)
  if (endIdx === -1) return null

  return source.slice(contentStart, endIdx).trim()
}

function stripImports(source) {
  return source
    .split('\n')
    .filter((line) => {
      if (line.includes("from 'react-router-dom'") && line.includes('useNavigate')) return false
      if (line.includes("from '../../lib/api'")) return false
      if (line.includes("from '../../lib/navGroups'")) return false
      if (line.trim() === "import { useState, useEffect } from 'react'" && source.includes('useEffect')) {
        return false
      }
      if (line.trim() === "import { useEffect, useState } from 'react'") return false
      return true
    })
    .join('\n')
}

function ensureImports(source) {
  let out = source
  if (!out.includes('DashboardLayout')) {
    out = out.replace(
      /^(import .+\n)/,
      "$1import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'\nimport { useToast } from '../../components/feedback/ToastProvider.jsx'\nimport { MESSAGES } from '../../constants/messages.js'\n",
    )
  }
  if (!out.includes('useState')) {
    out = "import { useState } from 'react'\n" + out
  } else if (!out.match(/^import \{[^}]+\} from 'react'/m)) {
    out = "import { useState } from 'react'\n" + out
  } else if (!out.includes('useState') && out.includes('from \'react\'')) {
    out = out.replace(/from 'react'/, ", useState } from 'react'").replace('import {', 'import { useState')
  }
  return out
}

function removeShellState(source) {
  let out = source
  const blocks = [
    /const navigate = useNavigate\(\)\n/g,
    /const currentUser = getStoredUser\(\)\n/g,
    /const \[profileOpen, setProfileOpen\] = useState\(false\)\n/g,
    /const \[restaurantName, setRestaurantName\] = useState\(''\)\n/g,
    /const \[restaurantStatus, setRestaurantStatus\] = useState\(''\)\n/g,
    /  useEffect\(\(\) => \{\n    api\.getRestaurant\(\)[\s\S]*?\n  \}, \[\]\)\n\n/g,
    /  const displayRestaurant = restaurantName\.trim\(\) \|\| 'Your restaurant'\n\n/g,
    /  const handleLogout = \(\) => \{[\s\S]*?\n  \}\n/g,
    /  const handleNavClick = \(item\) => \{[\s\S]*?\n  \}\n/g,
  ]
  for (const re of blocks) {
    out = out.replace(re, '')
  }
  return out
}

function addToastHelper(source) {
  if (source.includes('comingSoon')) return source
  return source.replace(
    /(function \w+\(\) \{\n)/,
    "$1  const toast = useToast()\n  const comingSoon = (label) => toast.info(MESSAGES.COMING_SOON(label))\n\n",
  )
}

function replaceAlerts(source) {
  return source.replace(
    /alert\(`\$\{([^}]+)\} — coming soon in this demo\.`\)/g,
    'comingSoon($1)',
  ).replace(
    /alert\('([^']+) — coming soon in this demo\.'\)/g,
    "comingSoon('$1')",
  ).replace(
    /alert\(`([^`]+)`\)/g,
    'comingSoon(`$1`)',
  )
}

for (const { file, pageClass, activeNav } of PAGES) {
  const filePath = path.join(pagesDir, file)
  if (!fs.existsSync(filePath)) {
    console.warn('Skip missing:', file)
    continue
  }

  let source = fs.readFileSync(filePath, 'utf8')
  const content = extractMainContent(source)
  if (!content) {
    console.warn('No main content found:', file)
    continue
  }

  const fnMatch = source.match(/function (\w+)\(\)/)
  const fnName = fnMatch?.[1] || 'Page'

  let body = source.slice(0, source.indexOf('function ' + fnName))
  body = ensureImports(body)
  body += `function ${fnName}() {\n  const toast = useToast()\n  const comingSoon = (label) => toast.info(MESSAGES.COMING_SOON(label))\n`

  const stateMatch = source.match(
    new RegExp(`function ${fnName}\\(\\) \\{([\\s\\S]*?)(return \\()`),
  )
  if (stateMatch) {
    let inner = stateMatch[1]
    inner = removeShellState('function x() {' + inner).slice('function x() {'.length)
    body += inner
  }

  let pageContent = replaceAlerts(content)

  body += `\n  return (\n    <DashboardLayout pageClassName="${pageClass}" activeNav="${activeNav}">\n${pageContent}\n    </DashboardLayout>\n  )\n}\n\nexport default ${fnName}\n`

  fs.writeFileSync(filePath, body)
  console.log('Migrated:', file)
}

console.log('Done.')
