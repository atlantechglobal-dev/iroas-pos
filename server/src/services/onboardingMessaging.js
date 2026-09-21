import { db } from '../db.js'
import { createNotification, queueEmailAndWait } from './identityService.js'
import { getAdminNotifyEmail, getEmailSettings, isEmailConfigured } from './emailService.js'

function adminInbox() {
  return getAdminNotifyEmail()
}

function appBaseUrl() {
  return String(process.env.PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:5173')
    .trim()
    .replace(/\/$/, '')
}

function restaurantHost(restaurant) {
  if (restaurant.custom_domain) return String(restaurant.custom_domain).replace(/^https?:\/\//i, '').replace(/\/$/, '')
  const slug = String(restaurant.subdomain || '').trim()
  if (!slug) return ''
  const suffix = String(restaurant.domain_suffix || 'iroas.com').replace(/^\./, '')
  return `${slug}.${suffix}`
}

function qrImageUrl(value, size = 180) {
  const data = encodeURIComponent(String(value || ''))
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function formatUserId(ownerId) {
  const n = Number(ownerId) || 0
  return `IROAS-${String(n).padStart(5, '0')}`
}

export function professionalEmailForRestaurant(restaurant) {
  if (!restaurant) return ''
  const slug = String(restaurant.subdomain || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
  if (slug) {
    const suffix = String(restaurant.domain_suffix || 'iroas.com').replace(/^\./, '')
    return `hello@${slug}.${suffix}`
  }
  return String(restaurant.email || '').trim()
}

export function onboardingPlanAmount(plan) {
  const key = String(plan || 'starter').toLowerCase()
  if (key === 'growth' || key === 'pro') return 2499
  if (key === 'enterprise') return 4999
  return 1
}

export function formatMoney(amount) {
  const n = Math.round(Number(amount) || 0)
  return `R${n.toLocaleString('en-ZA')}`
}

function ownerRow(ownerId) {
  return db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(ownerId)
}

function publicLinks(restaurant) {
  const base = appBaseUrl()
  const slug = String(restaurant.subdomain || '').trim()
  const host = restaurantHost(restaurant)
  const siteUrl = slug ? `${base}/s/${slug}/website` : host ? `https://${host}` : base
  const cardUrl = slug ? `${base}/c/${slug}` : ''
  const bookUrl = slug ? `${base}/s/${slug}/book` : ''
  const menuUrl = slug ? `${base}/s/${slug}/menu` : ''
  const loginUrl = `${base}/login`
  return { base, slug, host, siteUrl, cardUrl, bookUrl, menuUrl, loginUrl }
}

function detailsHtmlBlock({ userId, owner, professionalEmail, links, restaurant, payment }) {
  const rows = [
    ['User ID', userId],
    ['Sign-in email', owner.email],
    ['Professional email', professionalEmail],
    ['Business', restaurant.name || '—'],
    ['Plan', restaurant.plan || 'starter'],
    links.host ? ['Website host', links.host] : null,
    links.siteUrl ? ['Public website', links.siteUrl] : null,
    links.cardUrl ? ['Digital business card', links.cardUrl] : null,
    links.bookUrl ? ['Reservations', links.bookUrl] : null,
    links.menuUrl ? ['Menu', links.menuUrl] : null,
    ['Dashboard login', links.loginUrl],
  ].filter(Boolean)

  if (payment) {
    rows.push(
      ["Amount paid", formatMoney(payment.amount)],
      ['Payment method', String(payment.method || '').toUpperCase()],
      ['Payment reference', payment.reference || '—'],
    )
  }

  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 10px;color:#6b6b73;font-size:13px;">${escapeHtml(label)}</td><td style="padding:6px 10px;font-size:13px;font-weight:700;">${escapeHtml(value)}</td></tr>`,
    )
    .join('')

  const qrs = [
    links.siteUrl
      ? `<div style="text-align:center;"><img src="${qrImageUrl(links.siteUrl)}" width="140" height="140" alt="Website QR"/><div style="font-size:12px;color:#6b6b73;margin-top:6px;">Website QR</div></div>`
      : '',
    links.cardUrl
      ? `<div style="text-align:center;"><img src="${qrImageUrl(links.cardUrl)}" width="140" height="140" alt="Business ID QR"/><div style="font-size:12px;color:#6b6b73;margin-top:6px;">Business ID QR</div></div>`
      : '',
    links.loginUrl
      ? `<div style="text-align:center;"><img src="${qrImageUrl(links.loginUrl)}" width="140" height="140" alt="Login QR"/><div style="font-size:12px;color:#6b6b73;margin-top:6px;">Login QR</div></div>`
      : '',
  ]
    .filter(Boolean)
    .join('')

  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#faf8f4;border-radius:12px;">${table}</table>
    <div style="display:flex;flex-wrap:wrap;gap:18px;justify-content:center;margin:20px 0;">${qrs}</div>
  `
}

/**
 * After onboarding payment: welcome the owner + notify admin to review.
 */
export async function sendOnboardingPaymentEmails({ restaurant, payment }) {
  const features = getEmailSettings().features || {}
  const owner = ownerRow(restaurant.owner_id)
  if (!owner?.email) return { user: false, admin: false, configured: isEmailConfigured() }

  const userId = formatUserId(owner.id)
  const professionalEmail = professionalEmailForRestaurant(restaurant)
  const links = publicLinks(restaurant)
  const amount = payment?.amount ?? onboardingPlanAmount(restaurant.plan)
  const method = payment?.method || 'upi'
  const reference = payment?.reference || '—'
  const result = {
    user: false,
    admin: false,
    userId,
    professionalEmail,
    configured: isEmailConfigured(),
    errors: [],
  }

  createNotification({
    userId: owner.id,
    type: 'restaurant',
    title: 'Welcome to IROAS',
    body: `Payment received. Your User ID is ${userId}. Professional email: ${professionalEmail}. An admin will review your application shortly.`,
    meta: {
      restaurantId: restaurant.id,
      userId,
      professionalEmail,
      paymentReference: reference,
    },
  })

  if (features.welcomeMail !== false) {
    const text = [
      `Hi ${owner.name || 'there'},`,
      '',
      `Thank you for your payment. Your IROAS digital store application is now in the review queue.`,
      '',
      'Your account details',
      `• User ID: ${userId}`,
      `• Sign-in email: ${owner.email}`,
      `• Professional email: ${professionalEmail}`,
      links.host ? `• Website: https://${links.host}` : null,
      `• Login: ${links.loginUrl}`,
      links.siteUrl ? `• Public site: ${links.siteUrl}` : null,
      links.cardUrl ? `• Business card: ${links.cardUrl}` : null,
      `• Plan: ${restaurant.plan || 'starter'}`,
      `• Amount paid: ${formatMoney(amount)} (${String(method).toUpperCase()})`,
      `• Payment reference: ${reference}`,
      '',
      'What happens next',
      '1. Our team verifies your profile, domain, and branding.',
      '2. When approved, your site goes live and your QR codes unlock.',
      '3. You will receive a full approval email with login + QR details.',
      '',
      '— Team IROAS',
    ]
      .filter((line) => line !== null)
      .join('\n')

    try {
      await queueEmailAndWait({
        to: owner.email,
        subject: `Welcome to IROAS — ${restaurant.name || 'your business'}`,
        body: text,
        html: `
        <div style="font-family:Plus Jakarta Sans,Segoe UI,sans-serif;color:#17171a;line-height:1.5;max-width:640px;margin:0 auto;">
          <h1 style="font-size:22px;">Welcome to IROAS</h1>
          <p>Hi ${escapeHtml(owner.name || 'there')},</p>
          <p>Thank you for your payment. Your application is in the review queue.</p>
          ${detailsHtmlBlock({ userId, owner, professionalEmail, links, restaurant, payment: { amount, method, reference } })}
          <p style="color:#6b6b73;font-size:13px;">QR codes unlock fully after admin approval. You will get another email with everything unlocked.</p>
          <p>— Team IROAS</p>
        </div>
      `,
      })
      result.user = true
    } catch (err) {
      result.errors.push(`welcome: ${err.message || err}`)
      console.error('[onboarding email] welcome failed:', err.message || err)
    }
  }

  const adminTo = adminInbox()
  if (adminTo && features.adminVerifyMail !== false) {
    try {
      await queueEmailAndWait({
        to: adminTo,
        subject: `[Review] ${restaurant.name || 'New business'} — User ${userId}`,
        body: [
          'A new business completed onboarding payment and awaits verification.',
          '',
          `• Name: ${restaurant.name || '—'}`,
          `• City: ${restaurant.city || '—'}`,
          `• Plan: ${restaurant.plan || 'starter'}`,
          links.host ? `• Domain: ${links.host}` : null,
          `• Professional email: ${professionalEmail}`,
          `• User ID: ${userId}`,
          `• Owner: ${owner.name || '—'} <${owner.email}>`,
          `• Phone: ${owner.phone || '—'}`,
          `• Amount: ${formatMoney(amount)} / ${String(method).toUpperCase()} / ${reference}`,
          '',
          'Action: Platform Admin → Review tenant → verify checklist → Approve or Reject.',
          '',
          '— IROAS system',
        ]
          .filter((line) => line !== null)
          .join('\n'),
      })
      result.admin = true
    } catch (err) {
      result.errors.push(`admin-review: ${err.message || err}`)
      console.error('[onboarding email] admin review failed:', err.message || err)
    }
  }

  return result
}

/**
 * On approve: full details + QR + login to user; confirmation to admin.
 */
export async function sendApprovalEmails({ restaurant, reviewedByAdminEmail }) {
  const features = getEmailSettings().features || {}
  const owner = ownerRow(restaurant.owner_id)
  const userId = formatUserId(restaurant.owner_id)
  const professionalEmail = professionalEmailForRestaurant(restaurant)
  const links = publicLinks(restaurant)
  const result = {
    user: false,
    admin: false,
    configured: isEmailConfigured(),
    errors: [],
  }

  if (owner?.email && features.approvalDetailsMail !== false) {
    const text = [
      `Hi ${owner.name || 'there'},`,
      '',
      `Great news — ${restaurant.name || 'your business'} has been verified and published.`,
      '',
      'Your live credentials',
      `• User ID: ${userId}`,
      `• Sign-in email: ${owner.email}`,
      `• Professional email: ${professionalEmail}`,
      `• Login: ${links.loginUrl}`,
      links.siteUrl ? `• Live website: ${links.siteUrl}` : null,
      links.cardUrl ? `• Business card: ${links.cardUrl}` : null,
      links.bookUrl ? `• Reservations: ${links.bookUrl}` : null,
      links.menuUrl ? `• Menu: ${links.menuUrl}` : null,
      '',
      'Your QR codes are unlocked (see images in this email). Sign in to manage menu, orders, and reservations.',
      '',
      '— Team IROAS',
    ]
      .filter((line) => line !== null)
      .join('\n')

    try {
      await queueEmailAndWait({
        to: owner.email,
        subject: `${restaurant.name || 'Your business'} is approved — login, QR & details`,
        body: text,
        html: `
        <div style="font-family:Plus Jakarta Sans,Segoe UI,sans-serif;color:#17171a;line-height:1.5;max-width:640px;margin:0 auto;">
          <h1 style="font-size:22px;">You're approved and live</h1>
          <p>Hi ${escapeHtml(owner.name || 'there')},</p>
          <p><strong>${escapeHtml(restaurant.name || 'Your business')}</strong> has been verified and published. Below is everything you need — login, links, and QR codes.</p>
          ${detailsHtmlBlock({ userId, owner, professionalEmail, links, restaurant })}
          <p><a href="${escapeHtml(links.loginUrl)}" style="display:inline-block;background:#8bc53f;color:#16210a;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:999px;">Open dashboard login</a></p>
          <p>— Team IROAS</p>
        </div>
      `,
      })
      result.user = true
    } catch (err) {
      result.errors.push(`approval: ${err.message || err}`)
      console.error('[approval email] user failed:', err.message || err)
    }
  }

  const adminTo = adminInbox()
  if (adminTo && features.adminVerifyMail !== false) {
    try {
      await queueEmailAndWait({
        to: adminTo,
        subject: `[Approved] ${restaurant.name || 'Business'} — ${userId}`,
        body: [
          'Tenant approval confirmation',
          '',
          `• Business: ${restaurant.name || '—'}`,
          `• User ID: ${userId}`,
          `• Owner: ${owner?.name || '—'} <${owner?.email || '—'}>`,
          `• Professional email: ${professionalEmail}`,
          links.siteUrl ? `• Live site: ${links.siteUrl}` : null,
          reviewedByAdminEmail ? `• Approved by: ${reviewedByAdminEmail}` : null,
          '• Status: live',
          '',
          'Full account details and QR codes were emailed to the owner.',
          '',
          '— IROAS system',
        ]
          .filter((line) => line !== null)
          .join('\n'),
      })
      result.admin = true
    } catch (err) {
      result.errors.push(`admin-approved: ${err.message || err}`)
      console.error('[approval email] admin failed:', err.message || err)
    }
  }

  return result
}
