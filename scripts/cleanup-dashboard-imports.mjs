import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pagesDir = path.join(__dirname, '..', 'src', 'pages')

const FILES = [
  'Orders/Orders.jsx',
  'Tables/Tables.jsx',
  'Staff/Staff.jsx',
  'Settings/Settings.jsx',
  'Reviews/Reviews.jsx',
  'Reservations/Reservations.jsx',
  'PosIntegration/PosIntegration.jsx',
  'Payments/Payments.jsx',
  'Analytics/Analytics.jsx',
  'Marketing/Marketing.jsx',
  'Notifications/Notifications.jsx',
  'DirectoryListings/DirectoryListings.jsx',
]

for (const file of FILES) {
  const filePath = path.join(pagesDir, file)
  let source = fs.readFileSync(filePath, 'utf8')
  const cssImport = source.match(/import '\.\/[^']+\.css'/)?.[0] || ''

  source = source.replace(/^import[\s\S]*?(?=const |function )/, '')
  source =
    `import { useState } from 'react'\n` +
    `import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx'\n` +
    `import { useToast } from '../../components/feedback/ToastProvider.jsx'\n` +
    `import { MESSAGES } from '../../constants/messages.js'\n` +
    `${cssImport}\n\n` +
    source.trimStart()

  source = source.replace(/\n\s+\n\s+const /g, '\n\n  const ')
  fs.writeFileSync(filePath, source)
  console.log('Cleaned:', file)
}
