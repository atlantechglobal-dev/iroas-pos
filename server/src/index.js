import 'dotenv/config'
import { requireEnv, port } from './config/env.js'
import { createApp } from './app.js'
import { startMessageJobWorker } from './services/reservationMessaging.js'
import {
  ensureEmailSettingsBootstrapped,
  getPublicEmailSettings,
  isEmailConfigured,
  verifyEmailConnection,
} from './services/emailService.js'
import { ensureGoogleAuthSettingsBootstrapped } from './services/googleAuthSettings.js'
import { ensureBusinessCategoriesBootstrapped } from './services/businessCategories.js'

try {
  requireEnv('JWT_SECRET')
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

const app = createApp()
const PORT = port()

app.listen(PORT, async () => {
  console.log(`IROAS API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`)
  const boot = ensureEmailSettingsBootstrapped()
  ensureGoogleAuthSettingsBootstrapped()
  ensureBusinessCategoriesBootstrapped()
  if (isEmailConfigured()) {
    const check = await verifyEmailConnection()
    const provider = check.provider || boot.provider || 'email'
    if (check.ok) {
      if (provider === 'ethereal') {
        console.log(
          'Email ready via Ethereal (dev catcher). Preview URLs are logged after each send. Add ZeptoMail token or Gmail App Password for real delivery.',
        )
      } else if (provider === 'smtp') {
        console.log('Email ready via SMTP.')
      } else {
        console.log('Email ready via ZeptoMail (HTTPS).')
      }
    } else {
      console.warn(`Email configured but verify failed (${provider}): ${check.reason}`)
    }
  } else {
    console.log(
      'Email not configured — set ZeptoMail in Admin Email settings, or SMTP_USER/SMTP_PASS in server/.env.',
    )
  }
  const pub = getPublicEmailSettings()
  console.log(
    `Email settings: provider=${pub.provider} configured=${pub.configured} from=${pub.fromEmail || '(none)'}`,
  )
})

startMessageJobWorker({ intervalMs: 60_000 })
