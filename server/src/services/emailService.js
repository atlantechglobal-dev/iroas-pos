import { db } from '../db.js'

const EMAIL_KEY = 'email'

const DEFAULT_FEATURES = {
  welcomeMail: true,
  adminVerifyMail: true,
  approvalDetailsMail: true,
}

let smtpTransporter = null
let etherealAccount = null
let etherealTransporter = null

function parseJson(raw, fallback = {}) {
  try {
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function parseFromAddress(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const m = s.match(/<([^>]+)>/)
  return (m ? m[1] : s).trim()
}

function envDefaults() {
  const token = String(process.env.ZEPTOMAIL_TOKEN || process.env.ZEPTOMAIL_API_TOKEN || '').trim()
  const fromEmail = parseFromAddress(
    process.env.ZEPTOMAIL_FROM_EMAIL ||
      process.env.SMTP_FROM ||
      process.env.SMTP_FROM_EMAIL ||
      process.env.SMTP_USER ||
      '',
  )
  const fromName =
    String(process.env.ZEPTOMAIL_FROM_NAME || '').trim() ||
    (String(process.env.SMTP_FROM || '').match(/^"?([^"<]+)"?\s*</)?.[1]?.trim() || 'IROAS')
  const smtpUser = String(process.env.SMTP_USER || '').trim()
  const smtpPass = String(process.env.SMTP_PASS || '').trim().replace(/\s+/g, '')
  return {
    token,
    fromEmail,
    fromName: fromName || 'IROAS',
    smtpUser,
    smtpPass,
    smtpHost: String(process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpSecure:
      process.env.SMTP_SECURE === 'true' ||
      process.env.SMTP_SECURE === '1' ||
      Number(process.env.SMTP_PORT || 587) === 465,
  }
}

function allowDevCatcher() {
  const flag = String(process.env.EMAIL_DEV_CATCHER || '').trim().toLowerCase()
  if (flag === '0' || flag === 'false' || flag === 'off') return false
  if (flag === '1' || flag === 'true' || flag === 'on') return true
  return process.env.NODE_ENV !== 'production'
}

/**
 * Load platform email settings (DB overrides .env for Zepto token / From).
 */
export function getEmailSettings() {
  const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get(EMAIL_KEY)
  const stored = parseJson(row?.value_json, {})
  const env = envDefaults()

  const apiToken = String(stored.apiToken || env.token || '').trim()
  const fromEmail = String(stored.fromEmail || env.fromEmail || '').trim()
  const fromName = String(stored.fromName || env.fromName || 'IROAS').trim() || 'IROAS'

  let provider = 'none'
  if (apiToken && fromEmail) provider = 'zeptomail'
  else if (env.smtpUser && env.smtpPass && fromEmail) provider = 'smtp'
  else if (allowDevCatcher() && fromEmail) provider = 'ethereal'
  else if (stored.provider) provider = stored.provider

  return {
    provider,
    apiToken,
    fromEmail,
    fromName,
    apiUrl: String(
      stored.apiUrl || process.env.ZEPTOMAIL_API_URL || 'https://api.zeptomail.com/v1.1/email',
    ).trim(),
    smtp: {
      user: env.smtpUser,
      pass: env.smtpPass,
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
    },
    features: {
      ...DEFAULT_FEATURES,
      ...(stored.features && typeof stored.features === 'object' ? stored.features : {}),
    },
  }
}

export function maskToken(token) {
  const t = String(token || '')
  if (!t) return ''
  if (t.length <= 10) return `${t.slice(0, 2)}${'•'.repeat(Math.max(4, t.length - 2))}`
  return `${t.slice(0, 4)}${'•'.repeat(Math.min(48, t.length - 8))}${t.slice(-4)}`
}

export function getPublicEmailSettings() {
  const s = getEmailSettings()
  const configured = isEmailConfigured()
  return {
    provider: s.provider,
    fromEmail: s.fromEmail,
    fromName: s.fromName,
    apiUrl: s.apiUrl,
    configured,
    tokenSet: Boolean(s.apiToken),
    smtpConfigured: Boolean(s.smtp.user && s.smtp.pass),
    devCatcher: s.provider === 'ethereal',
    apiTokenMasked: s.apiToken ? maskToken(s.apiToken) : '',
    features: s.features,
  }
}

export function saveEmailSettings(payload = {}) {
  const current = getEmailSettings()
  const nextToken = String(payload.apiToken ?? '').trim()
  const featuresIn = payload.features && typeof payload.features === 'object' ? payload.features : {}

  const next = {
    provider: nextToken || current.apiToken ? 'zeptomail' : current.provider,
    apiToken: nextToken || current.apiToken,
    fromEmail: String(payload.fromEmail ?? current.fromEmail).trim(),
    fromName: String(payload.fromName ?? current.fromName).trim() || 'IROAS',
    apiUrl: current.apiUrl,
    features: {
      welcomeMail:
        featuresIn.welcomeMail !== undefined
          ? Boolean(featuresIn.welcomeMail)
          : current.features.welcomeMail,
      adminVerifyMail:
        featuresIn.adminVerifyMail !== undefined
          ? Boolean(featuresIn.adminVerifyMail)
          : current.features.adminVerifyMail,
      approvalDetailsMail:
        featuresIn.approvalDetailsMail !== undefined
          ? Boolean(featuresIn.approvalDetailsMail)
          : current.features.approvalDetailsMail,
    },
  }

  if (!next.fromEmail) {
    throw Object.assign(new Error('From email is required.'), { status: 400 })
  }

  db.prepare(
    `INSERT INTO platform_settings (key, value_json, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = datetime('now')`,
  ).run(EMAIL_KEY, JSON.stringify(next))

  return getPublicEmailSettings()
}

/** Bootstrap DB settings from .env so first boot has From email + features enabled. */
export function ensureEmailSettingsBootstrapped() {
  const row = db.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get(EMAIL_KEY)
  if (row?.value_json) return getPublicEmailSettings()
  const env = envDefaults()
  if (!env.fromEmail && !env.token) return getPublicEmailSettings()
  try {
    return saveEmailSettings({
      apiToken: env.token || '',
      fromEmail: env.fromEmail,
      fromName: env.fromName,
      features: { ...DEFAULT_FEATURES },
    })
  } catch {
    return getPublicEmailSettings()
  }
}

export function isEmailConfigured() {
  const s = getEmailSettings()
  if (s.apiToken && s.fromEmail) return true
  if (s.smtp.user && s.smtp.pass && s.fromEmail) return true
  if (s.provider === 'ethereal' && s.fromEmail) return true
  return false
}

/** @deprecated use isEmailConfigured */
export function isSmtpConfigured() {
  return isEmailConfigured()
}

function textToHtml(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    .join('<br>\n')
}

async function getSmtpTransporter(cfg) {
  if (!cfg.smtp.user || !cfg.smtp.pass) return null
  if (smtpTransporter) return smtpTransporter
  const nodemailer = await import('nodemailer')
  smtpTransporter = nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.secure,
    auth: {
      user: cfg.smtp.user,
      pass: cfg.smtp.pass,
    },
  })
  return smtpTransporter
}

async function getEtherealTransporter() {
  if (etherealTransporter) return etherealTransporter
  const nodemailer = await import('nodemailer')
  if (!etherealAccount) {
    etherealAccount = await nodemailer.createTestAccount()
    console.log(
      `[email] Dev catcher (Ethereal) ready — user ${etherealAccount.user}. Preview links print after each send.`,
    )
  }
  etherealTransporter = nodemailer.createTransport({
    host: etherealAccount.smtp.host,
    port: etherealAccount.smtp.port,
    secure: etherealAccount.smtp.secure,
    auth: {
      user: etherealAccount.user,
      pass: etherealAccount.pass,
    },
  })
  return etherealTransporter
}

async function sendViaZeptoMail(cfg, { to, toName, subject, text, htmlBody }) {
  const payload = {
    from: {
      address: cfg.fromEmail,
      name: cfg.fromName,
    },
    to: [
      {
        email_address: {
          address: to,
          name: toName || to,
        },
      },
    ],
    subject,
    htmlbody: htmlBody,
    textbody: text || undefined,
  }

  const authValue = cfg.apiToken.toLowerCase().startsWith('zoho-enczapikey')
    ? cfg.apiToken
    : `Zoho-enczapikey ${cfg.apiToken}`

  const res = await fetch(cfg.apiUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authValue,
    },
    body: JSON.stringify(payload),
  })

  const raw = await res.text()
  let data = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = { raw }
  }

  if (!res.ok) {
    const msg =
      data?.error?.message || data?.message || data?.raw || `ZeptoMail HTTP ${res.status}`
    throw new Error(String(msg))
  }
  return { provider: 'zeptomail', data }
}

async function sendViaSmtp(cfg, { to, toName, subject, text, htmlBody }) {
  const transport = await getSmtpTransporter(cfg)
  if (!transport) {
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS).')
  }
  const info = await transport.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    to: toName ? `"${toName}" <${to}>` : to,
    subject,
    text,
    html: htmlBody,
  })
  return { provider: 'smtp', data: info }
}

async function sendViaEthereal(cfg, { to, toName, subject, text, htmlBody }) {
  const transport = await getEtherealTransporter()
  const info = await transport.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    to: toName ? `"${toName}" <${to}>` : to,
    subject,
    text,
    html: htmlBody,
  })
  const nodemailer = await import('nodemailer')
  const preview = nodemailer.getTestMessageUrl(info)
  if (preview) {
    console.log(`[email] Ethereal preview → ${preview}`)
  }
  return { provider: 'ethereal', data: info, previewUrl: preview || null }
}

/**
 * Send transactional email.
 * Order: ZeptoMail → SMTP → Ethereal (dev catcher).
 */
export async function sendEmail({ to, subject, body, html, toName }) {
  const cfg = getEmailSettings()
  const text = String(body || '').trim()
  const htmlBody = html || textToHtml(text)
  const recipient = String(to || '').trim()
  if (!recipient) throw new Error('Recipient email is required.')
  if (!cfg.fromEmail) {
    throw new Error('From email is missing. Set it in Email settings or .env.')
  }

  const mail = {
    to: recipient,
    toName,
    subject: String(subject || 'IROAS notification').trim(),
    text,
    htmlBody,
  }

  if (cfg.apiToken) {
    try {
      return await sendViaZeptoMail(cfg, mail)
    } catch (zeptoErr) {
      if (cfg.smtp.user && cfg.smtp.pass) {
        console.warn(`[email] ZeptoMail failed (${zeptoErr.message}); falling back to SMTP`)
        try {
          return await sendViaSmtp(cfg, mail)
        } catch (smtpErr) {
          if (allowDevCatcher()) {
            console.warn(`[email] SMTP failed (${smtpErr.message}); falling back to Ethereal`)
            return sendViaEthereal(cfg, mail)
          }
          throw smtpErr
        }
      }
      if (allowDevCatcher()) {
        console.warn(`[email] ZeptoMail failed (${zeptoErr.message}); falling back to Ethereal`)
        return sendViaEthereal(cfg, mail)
      }
      throw zeptoErr
    }
  }

  if (cfg.smtp.user && cfg.smtp.pass) {
    try {
      return await sendViaSmtp(cfg, mail)
    } catch (smtpErr) {
      if (allowDevCatcher()) {
        console.warn(`[email] SMTP failed (${smtpErr.message}); falling back to Ethereal`)
        return sendViaEthereal(cfg, mail)
      }
      throw smtpErr
    }
  }

  if (allowDevCatcher()) {
    return sendViaEthereal(cfg, mail)
  }

  throw new Error(
    'Email is not configured. Add ZeptoMail token in Settings → Email, or set SMTP_USER / SMTP_PASS (Gmail App Password) in server/.env.',
  )
}

export async function verifySmtpConnection() {
  if (!isEmailConfigured()) return { ok: false, reason: 'not_configured' }
  const cfg = getEmailSettings()
  if (cfg.apiToken) return { ok: true, provider: 'zeptomail' }
  if (cfg.smtp.user && cfg.smtp.pass) {
    try {
      const transport = await getSmtpTransporter(cfg)
      await transport.verify()
      return { ok: true, provider: 'smtp' }
    } catch (err) {
      if (allowDevCatcher()) {
        return { ok: true, provider: 'ethereal', reason: err.message || String(err) }
      }
      return { ok: false, reason: err.message || String(err), provider: 'smtp' }
    }
  }
  if (cfg.provider === 'ethereal') {
    try {
      await getEtherealTransporter()
      return { ok: true, provider: 'ethereal' }
    } catch (err) {
      return { ok: false, reason: err.message || String(err), provider: 'ethereal' }
    }
  }
  return { ok: false, reason: 'not_configured' }
}

export async function verifyEmailConnection() {
  return verifySmtpConnection()
}

export function getAdminNotifyEmail() {
  return (
    String(process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || '').trim() ||
    getEmailSettings().fromEmail ||
    String(process.env.SMTP_USER || '').trim() ||
    ''
  )
}
