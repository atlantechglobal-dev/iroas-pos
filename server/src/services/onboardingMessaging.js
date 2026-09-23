import { db } from '../infra/db.js'
import { createNotification, queueEmailAndWait } from './identityService.js'
import {
  applyEmailTemplate,
  getAdminNotifyEmail,
  getEmailSettings,
  getEmailTemplate,
  isEmailConfigured,
  textToSimpleHtml,
} from './emailService.js'
import { getPlanAmount } from './platformAdminService.js'

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
  return getPlanAmount(plan)
}

function formatMoney(amount) {
  const n = Math.round(Number(amount) || 0)
  return `R${n.toLocaleString('en-ZA')}`
}

function templateVars({
  owner,
  restaurant,
  professionalEmail,
  links,
  payment,
  reviewedByAdminEmail,
}) {
  return {
    ownerName: owner?.name || 'there',
    ownerEmail: owner?.email || '',
    ownerPhone: owner?.phone || '',
    businessName: restaurant?.name || 'your business',
    city: restaurant?.city || '',
    userId: formatUserId(owner?.id || restaurant?.owner_id),
    professionalEmail: professionalEmail || '',
    loginUrl: links?.loginUrl || '',
    onboardingUrl: links?.onboardingUrl || '',
    siteUrl: links?.siteUrl || '',
    cardUrl: links?.cardUrl || '',
    bookUrl: links?.bookUrl || '',
    menuUrl: links?.menuUrl || '',
    host: links?.host ? `https://${links.host}` : '',
    plan: String(restaurant?.plan || 'starter'),
    amount: payment ? formatMoney(payment.amount) : '',
    method: payment ? String(payment.method || '').toUpperCase() : '',
    reference: payment?.reference || '',
    reviewedBy: reviewedByAdminEmail || '',
  }
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
  const onboardingUrl = `${base}/restaurant-setup`
  return { base, slug, host, siteUrl, cardUrl, bookUrl, menuUrl, loginUrl, onboardingUrl }
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
 * After Create Account: thank-you / under-review to owner + notify admins.
 */
export async function sendSignupReviewEmails({ restaurant, owner }) {
  const features = getEmailSettings().features || {}
  const ownerRowData =
    owner?.email
      ? owner
      : ownerRow(restaurant.owner_id)
  if (!ownerRowData?.email) {
    return { user: false, admin: false, configured: isEmailConfigured() }
  }

  const professionalEmail = professionalEmailForRestaurant(restaurant)
  const links = publicLinks(restaurant)
  const userId = formatUserId(ownerRowData.id || restaurant.owner_id)
  const vars = templateVars({
    owner: ownerRowData,
    restaurant,
    professionalEmail,
    links,
  })
  const result = {
    user: false,
    admin: false,
    adminNotified: 0,
    configured: isEmailConfigured(),
    errors: [],
  }

  createNotification({
    userId: ownerRowData.id,
    type: 'restaurant',
    title: 'Account under review',
    body: `Thank you — ${restaurant.name || 'your account'} is waiting for admin approval. We will email ${ownerRowData.email} when it is approved.`,
    meta: { restaurantId: restaurant.id, status: 'pending_approval', userId },
  })

  const admins = db
    .prepare(`SELECT id, email, name FROM users WHERE role = 'admin' ORDER BY id ASC`)
    .all()
  for (const admin of admins) {
    createNotification({
      userId: admin.id,
      type: 'approval',
      title: `${restaurant.name || 'New signup'} awaits Account approve`,
      body: `${ownerRowData.name || 'Owner'} · ${ownerRowData.email}`,
      meta: { tenantId: restaurant.id, restaurantId: restaurant.id },
    })
    result.adminNotified += 1
  }

  if (features.signupThankYouMail !== false) {
    const rendered = applyEmailTemplate(getEmailTemplate('signupThankYouMail'), vars)
    try {
      await queueEmailAndWait({
        to: ownerRowData.email,
        subject: rendered.subject,
        body: rendered.body,
        html: textToSimpleHtml(rendered.body),
      })
      result.user = true
    } catch (err) {
      result.errors.push(`signup-thank-you: ${err.message || err}`)
      console.error('[signup email] thank-you failed:', err.message || err)
    }
  }

  const adminTo = adminInbox()
  if (adminTo && features.signupAdminNotifyMail !== false) {
    const rendered = applyEmailTemplate(getEmailTemplate('signupAdminNotifyMail'), vars)
    try {
      await queueEmailAndWait({
        to: adminTo,
        subject: rendered.subject,
        body: rendered.body,
        html: textToSimpleHtml(rendered.body),
      })
      result.admin = true
    } catch (err) {
      result.errors.push(`signup-admin: ${err.message || err}`)
      console.error('[signup email] admin notify failed:', err.message || err)
    }
  }

  return result
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
    const rendered = applyEmailTemplate(
      getEmailTemplate('welcomeMail'),
      templateVars({
        owner,
        restaurant,
        professionalEmail,
        links,
        payment: { amount, method, reference },
      }),
    )
    try {
      await queueEmailAndWait({
        to: owner.email,
        subject: rendered.subject,
        body: rendered.body,
        html: `${textToSimpleHtml(rendered.body)}${detailsHtmlBlock({
          userId,
          owner,
          professionalEmail,
          links,
          restaurant,
          payment: { amount, method, reference },
        })}`,
      })
      result.user = true
    } catch (err) {
      result.errors.push(`welcome: ${err.message || err}`)
      console.error('[onboarding email] welcome failed:', err.message || err)
    }
  }

  const adminTo = adminInbox()
  if (adminTo && features.adminVerifyMail !== false) {
    const rendered = applyEmailTemplate(
      getEmailTemplate('adminVerifyMail'),
      templateVars({
        owner,
        restaurant,
        professionalEmail,
        links,
        payment: { amount, method, reference },
      }),
    )
    try {
      await queueEmailAndWait({
        to: adminTo,
        subject: rendered.subject,
        body: rendered.body,
        html: textToSimpleHtml(rendered.body),
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
 * On approve: email the owner (signup form email) + confirmation to admin.
 * accountApproval: new signup — unlock setup (no QR/live links yet).
 */
export async function sendApprovalEmails({
  restaurant,
  reviewedByAdminEmail,
  accountApproval = false,
}) {
  const features = getEmailSettings().features || {}
  const owner = ownerRow(restaurant.owner_id)
  const userId = formatUserId(restaurant.owner_id)
  const professionalEmail = professionalEmailForRestaurant(restaurant)
  const links = publicLinks(restaurant)
  const ownerEmail = String(restaurant.email || owner?.email || '')
    .trim()
    .toLowerCase()
  const result = {
    user: false,
    admin: false,
    configured: isEmailConfigured(),
    errors: [],
  }

  if (ownerEmail && (accountApproval ? features.accountApprovedMail !== false : features.approvalDetailsMail !== false)) {
    const vars = templateVars({
      owner: { ...owner, email: ownerEmail },
      restaurant,
      professionalEmail,
      links,
      reviewedByAdminEmail,
    })

    if (accountApproval) {
      const rendered = applyEmailTemplate(getEmailTemplate('accountApprovedMail'), vars)
      try {
        await queueEmailAndWait({
          to: ownerEmail,
          subject: rendered.subject,
          body: rendered.body,
          html: `
          <div style="font-family:Plus Jakarta Sans,Segoe UI,sans-serif;color:#17171a;line-height:1.5;max-width:640px;margin:0 auto;">
            ${textToSimpleHtml(rendered.body)}
            <p><a href="${escapeHtml(links.onboardingUrl || links.loginUrl)}" style="display:inline-block;background:#8bc53f;color:#16210a;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:999px;">Start onboarding</a></p>
          </div>
        `,
        })
        result.user = true
      } catch (err) {
        result.errors.push(`approval: ${err.message || err}`)
        console.error('[approval email] user failed:', err.message || err)
      }
    } else {
      const rendered = applyEmailTemplate(getEmailTemplate('approvalDetailsMail'), vars)
      try {
        await queueEmailAndWait({
          to: ownerEmail,
          subject: rendered.subject,
          body: rendered.body,
          html: `
          <div style="font-family:Plus Jakarta Sans,Segoe UI,sans-serif;color:#17171a;line-height:1.5;max-width:640px;margin:0 auto;">
            ${textToSimpleHtml(rendered.body)}
            ${detailsHtmlBlock({
              userId,
              owner: { ...owner, email: ownerEmail },
              professionalEmail,
              links,
              restaurant,
            })}
            <p><a href="${escapeHtml(links.loginUrl)}" style="display:inline-block;background:#8bc53f;color:#16210a;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:999px;">Open dashboard login</a></p>
          </div>
        `,
        })
        result.user = true
      } catch (err) {
        result.errors.push(`approval: ${err.message || err}`)
        console.error('[approval email] user failed:', err.message || err)
      }
    }
  }

  const adminTo = adminInbox()
  if (adminTo && features.adminVerifyMail !== false) {
    const rendered = applyEmailTemplate(
      getEmailTemplate('adminApprovedMail'),
      templateVars({
        owner: { ...owner, email: ownerEmail || owner?.email },
        restaurant,
        professionalEmail,
        links,
        reviewedByAdminEmail,
      }),
    )
    const subject = accountApproval
      ? `[Account approved] ${restaurant.name || 'Business'} — ${userId}`
      : rendered.subject
    const body = accountApproval
      ? [
          'New account approval confirmation',
          '',
          `• Business: ${restaurant.name || '—'}`,
          `• User ID: ${userId}`,
          `• Owner: ${owner?.name || '—'} <${ownerEmail}>`,
          `• Approved by: ${reviewedByAdminEmail || 'admin'}`,
          '• Status: onboarding (setup unlocked)',
          '',
          'An approval email was sent to the owner.',
          '',
          '— IROAS system',
        ].join('\n')
      : rendered.body
    try {
      await queueEmailAndWait({
        to: adminTo,
        subject,
        body,
        html: textToSimpleHtml(body),
      })
      result.admin = true
    } catch (err) {
      result.errors.push(`admin-approved: ${err.message || err}`)
      console.error('[approval email] admin failed:', err.message || err)
    }
  }

  return result
}
