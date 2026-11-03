import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { db } from '../../infra/db.js'
import { requireAuth } from '../../middleware/auth.js'
import {
  ACTIVE_RESERVATION_STATUSES,
  ACTIVE_STATUS_SQL,
  RESERVATION_STATUSES,
  assertBookable,
  checkStatusChange,
  zonedNow,
  bookingRules,
  listSlots,
  maxCoversFromSettings,
  normalizeOperatingHours,
  parseHoursJson,
} from '../../services/reservationAvailability.js'
import {
  onReservationCreated,
  onReservationStatusChange,
} from '../../services/reservationMessaging.js'
import { listGuests, upsertGuest } from '../../services/guestRecords.js'
import { loadOnboardingProgress } from '../../services/onboardingProgress.js'
import {
  assignTableForParty,
  assertTableAvailable,
  listDiningTables,
  syncDiningTablesFromPos,
  upsertDiningTable,
} from '../../services/diningTables.js'
import {
  getOrderById,
  listOrders,
  markOrderPaid,
  updateOrderStatus,
} from '../../services/orders.js'
import {
  formatUserId,
  onboardingPlanAmount,
  professionalEmailForRestaurant,
} from '../../services/onboardingMessaging.js'
import { listPlans, getPlan, getPlanAmount } from '../../services/platformAdminService.js'
import { addpayRequest } from '../../services/addpayClient.js'
import { getPaymentSettings, isPaymentConfigured } from '../../services/paymentSettings.js'
import {
  apiPublicUrl,
  appPublicUrl,
  finalizeOnboardingPayment,
  parseRestaurantSettings,
  syncPendingOnboardingPayment,
} from '../../services/onboardingPayment.js'
import { UryError } from '../../integrations/ury/uryClient.js'
import { IntegrationError, invalidateUryTenant, resolveUryTenant } from '../../integrations/ury/uryTenant.js'
import { TableEditError, createUryTable, getUryTableOptions, listUryTables } from '../../integrations/ury/uryTables.js'
import { MenuEditError, addUryItemStock, createUryCourse, createUryMenuDoc, createUryMenuItem, getUryMenu, getUryMenuOptions, updateUryMenuItem } from '../../integrations/ury/uryMenu.js'
import { listUryTableQrCodes } from '../../integrations/ury/uryTableQr.js'
import { getUryFeatures } from '../../integrations/ury/uryPublic.js'
import { buildDashboardSummary } from '../../services/dashboardSummary.js'
import { placeOnce } from '../../integrations/ury/staffOrderGuard.js'
import { getPosProfileOverlay, syncProfileToPos } from '../../integrations/ury/uryProfileSync.js'
import { cancelUryInvoice, getUryInvoiceBill, listUryCustomers, listUryOrders, payUryInvoice, printUryInvoice } from '../../integrations/ury/uryOrders.js'
import { attachKitchenProgress, setKitchenStep } from '../../integrations/ury/uryKitchenFlow.js'
import { listUryStaff } from '../../integrations/ury/uryStaff.js'
import {
  OrderingError,
  findOrCreateUryCustomer,
  getUryOrderMenu,
  placeUryOrder,
} from '../../integrations/ury/uryOrdering.js'
import { closeUryShift, getUryShift, openUryShift } from '../../integrations/ury/uryShift.js'

const router = Router()

function getOwnRestaurant(ownerId) {
  return db.prepare('SELECT * FROM restaurants WHERE owner_id = ?').get(ownerId)
}

router.use(requireAuth)

function parseSettings(restaurant) {
  return parseRestaurantSettings(restaurant)
}

function assertNotAwaitingAccountApproval(restaurant, res) {
  const settings = parseSettings(restaurant)
  if (settings.awaitingAccountApproval) {
    res.status(403).json({
      error: 'Your account is still awaiting admin approval. You will receive an email when you can sign in.',
    })
    return false
  }
  return true
}

router.get('/', async (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  if (restaurant.status === 'deleted') {
    return res.status(403).json({ error: 'This account has been closed.' })
  }
  const posProfile = await getPosProfileOverlay(restaurant.id)
  res.json({ restaurant: { ...restaurant, ...(posProfile || {}), settings: parseSettings(restaurant) } })
})

router.put('/profile', async (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  if (!assertNotAwaitingAccountApproval(restaurant, res)) return

  const {
    restaurantName,
    cuisine,
    description,
    phone,
    website,
    email,
    city,
    country,
    timezone,
    address,
    hours,
  } = req.body || {}

  db.prepare(
    `UPDATE restaurants
     SET name = ?, cuisine = ?, description = ?, phone = ?, website = ?, email = ?,
         city = ?, country = ?, timezone = ?, address = ?,
         operating_hours = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    restaurantName ?? restaurant.name,
    cuisine ?? restaurant.cuisine,
    description ?? restaurant.description,
    phone ?? restaurant.phone,
    website ?? restaurant.website,
    email ?? restaurant.email,
    city ?? restaurant.city,
    country ?? restaurant.country,
    timezone ?? restaurant.timezone,
    address ?? restaurant.address,
    hours
      ? JSON.stringify(normalizeOperatingHours(hours))
      : restaurant.operating_hours,
    restaurant.id,
  )

  // Opening hours and contact live in the customer's POS when those features are on.
  const posSync = await syncProfileToPos(restaurant.id, {
    hours: hours ? normalizeOperatingHours(hours) : undefined,
    timezone: timezone ?? restaurant.timezone,
    phone: phone ?? restaurant.phone,
    email: email ?? restaurant.email,
    address: address ?? restaurant.address,
    city: city ?? restaurant.city,
    country: country ?? restaurant.country,
  })

  res.json({ ok: true, ...(posSync ? { posSync } : {}) })
})

router.put('/domain', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const { subdomain, customDomain, domainSuffix } = req.body || {}

  if (subdomain) {
    const taken = db
      .prepare('SELECT id FROM restaurants WHERE subdomain = ? AND id != ?')
      .get(subdomain, restaurant.id)
    if (taken) {
      return res.status(409).json({ error: 'That subdomain is already taken.' })
    }
  }

  const allowedSuffixes = new Set(['iroas.com', 'com', 'co.za'])
  const nextSuffix =
    domainSuffix && allowedSuffixes.has(String(domainSuffix).replace(/^\./, ''))
      ? String(domainSuffix).replace(/^\./, '')
      : restaurant.domain_suffix || 'iroas.com'

  db.prepare(
    `UPDATE restaurants SET subdomain = ?, custom_domain = ?, domain_suffix = ?,
     updated_at = datetime('now') WHERE id = ?`,
  ).run(subdomain ?? null, customDomain ?? null, nextSuffix, restaurant.id)

  res.json({ ok: true })
})

router.put('/brand', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const { primaryColor, secondaryColor, accentColor, font, theme, logoDataUrl } =
    req.body || {}

  db.prepare(
    `UPDATE restaurants
     SET primary_color = ?, secondary_color = ?, accent_color = ?, font = ?, theme = ?,
         logo_data_url = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    primaryColor ?? restaurant.primary_color,
    secondaryColor ?? restaurant.secondary_color,
    accentColor ?? restaurant.accent_color,
    font ?? restaurant.font,
    theme ?? restaurant.theme,
    logoDataUrl ?? restaurant.logo_data_url,
    restaurant.id,
  )

  res.json({ ok: true })
})

router.put('/settings', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const current = parseSettings(restaurant)
  const patch = { ...(req.body || {}) }
  // Business category is fixed at Create Account — change requires deleting the account.
  delete patch.businessCategory
  delete patch.category
  const merged = { ...current, ...patch }
  if (current.businessCategory) merged.businessCategory = current.businessCategory
  else if (current.category) merged.category = current.category

  db.prepare(
    `UPDATE restaurants SET settings_json = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(JSON.stringify(merged), restaurant.id)

  res.json({ ok: true, settings: merged })
})

router.post('/launch', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  if (restaurant.status === 'live') {
    return res.json({ ok: true, status: 'live' })
  }

  if (restaurant.status === 'pending_approval') {
    return res.json({ ok: true, status: 'pending_approval' })
  }

  if (restaurant.status === 'deleted') {
    return res.status(403).json({ error: 'This account has been closed.' })
  }

  if (!restaurant.name) {
    return res.status(400).json({ error: 'Complete the restaurant profile before submitting.' })
  }

  if (!restaurant.subdomain && !restaurant.custom_domain) {
    return res.status(400).json({ error: 'Choose a web address before submitting.' })
  }

  db.prepare(
    `UPDATE restaurants SET status = 'pending_approval',
     submitted_at = datetime('now'),
     rejection_reason = NULL,
     rejected_at = NULL,
     updated_at = datetime('now') WHERE id = ?`,
  ).run(restaurant.id)

  const settings = parseSettings(restaurant)
  const professionalEmail = professionalEmailForRestaurant(restaurant)
  if (professionalEmail && !restaurant.email) {
    db.prepare(`UPDATE restaurants SET email = ? WHERE id = ?`).run(professionalEmail, restaurant.id)
  }

  res.json({
    ok: true,
    status: 'pending_approval',
    userId: formatUserId(req.user.id),
    professionalEmail,
    paymentRequired: !settings?.onboardingPayment?.paid,
    amount: onboardingPlanAmount(restaurant.plan),
  })
})

router.get('/onboarding-payment', async (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  if (restaurant.status === 'deleted') {
    return res.status(403).json({ error: 'This account has been closed.' })
  }

  // When returning from AddPay (or polling), actively query the gateway —
  // webhooks cannot reach localhost and can be delayed in production.
  let live = restaurant
  try {
    const sync = await syncPendingOnboardingPayment(restaurant)
    if (sync.synced) {
      live = getOwnRestaurant(req.user.id) || restaurant
    }
  } catch (err) {
    console.warn('[onboarding-payment] sync failed:', err.message || err)
  }

  const settings = parseSettings(live)
  const paid = Boolean(settings?.onboardingPayment?.paid)

  // Paid stores go live immediately — no post-payment review gate
  if (paid && live.status !== 'live' && live.status !== 'deleted') {
    db.prepare(
      `UPDATE restaurants SET status = 'live', launched_at = COALESCE(launched_at, datetime('now')),
       updated_at = datetime('now') WHERE id = ?`,
    ).run(live.id)
    live = { ...live, status: 'live' }
  }

  const professionalEmail =
    professionalEmailForRestaurant(live) || String(live.email || '').trim()
  const planKey = String(live.plan || 'starter').toLowerCase()
  const planAmount = onboardingPlanAmount(planKey)
  const amount = Number(settings?.onboardingPayment?.amount) > 0
    ? Number(settings.onboardingPayment.amount)
    : planAmount

  const owner = db
    .prepare('SELECT name, email, phone FROM users WHERE id = ?')
    .get(req.user.id)

  const plans = listPlans().map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    priceZar: p.priceZar,
    billing: p.billing,
    popular: p.popular,
    features: p.features,
  }))

  res.json({
    restaurantName: live.name,
    plan: planKey,
    status: live.status,
    amount,
    currency: 'ZAR',
    userId: formatUserId(req.user.id),
    professionalEmail,
    ownerEmail: owner?.email || req.user.email || '',
    ownerName: owner?.name || '',
    ownerPhone: owner?.phone || '',
    city: live.city || '',
    category: settings.businessCategory || settings.category || '',
    plans,
    paid,
    payment: settings?.onboardingPayment || null,
    addpayConfigured: isPaymentConfigured(),
  })
})

/**
 * Start a hosted AddPay checkout. When AddPay credentials are missing,
 * complete a local demo payment so onboarding can continue in development.
 * Body: { planId?: string }
 */
router.post('/onboarding-payment', async (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  if (restaurant.status === 'deleted') {
    return res.status(403).json({ error: 'This account has been closed.' })
  }
  if (restaurant.status === 'onboarding') {
    return res.status(400).json({ error: 'Submit your store from Launch before paying.' })
  }

  const settings = parseSettings(restaurant)
  if (settings?.onboardingPayment?.paid) {
    const professionalEmail =
      professionalEmailForRestaurant(restaurant) || String(restaurant.email || '').trim()
    return res.json({
      ok: true,
      alreadyPaid: true,
      userId: formatUserId(req.user.id),
      professionalEmail,
      ownerEmail: req.user.email || '',
      restaurantName: restaurant.name,
      payment: settings.onboardingPayment,
    })
  }

  // Re-check gateway in case the owner paid and webhook already landed
  try {
    const sync = await syncPendingOnboardingPayment(restaurant)
    if (sync.paid) {
      const professionalEmail =
        professionalEmailForRestaurant(restaurant) || String(restaurant.email || '').trim()
      return res.json({
        ok: true,
        alreadyPaid: true,
        userId: formatUserId(req.user.id),
        professionalEmail,
        ownerEmail: req.user.email || '',
        restaurantName: restaurant.name,
        payment: sync.payment,
      })
    }
  } catch {
    /* continue to start a new checkout */
  }

  const requestedPlan = String(req.body?.planId || req.body?.plan || '').trim().toLowerCase()
  let planId = String(restaurant.plan || 'starter').toLowerCase().trim()
  if (requestedPlan) {
    const catalog = listPlans()
    const match = catalog.find((p) => p.id === requestedPlan)
    if (!match) {
      return res.status(400).json({ error: 'Choose a valid launch plan.' })
    }
    planId = match.id
    if (planId !== String(restaurant.plan || '').toLowerCase()) {
      db.prepare(
        `UPDATE restaurants SET plan = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(planId, restaurant.id)
    }
  }

  const amount = getPlanAmount(planId)
  if (!amount || amount < 1) {
    return res.status(400).json({
      error: 'This plan has no launch price. Ask an admin to set the plan amount first.',
    })
  }
  const professionalEmail = professionalEmailForRestaurant(restaurant)
  const planMeta = getPlan(planId)

  // Demo path — AddPay not configured yet
  if (!isPaymentConfigured()) {
    const reference = `DEMO-${Date.now().toString(36).toUpperCase()}-${restaurant.id}`
    // Seed professional email before finalize so emails use it
    const seeded = {
      ...settings,
      professionalEmail,
      onboardingPayment: {
        paid: false,
        pending: true,
        reference,
        amount,
        currency: 'ZAR',
        method: 'demo',
        gateway: 'iroas_demo',
        planId,
        planName: planMeta?.name || planId,
      },
    }
    db.prepare(
      `UPDATE restaurants SET settings_json = ?, plan = ?, email = COALESCE(NULLIF(email, ''), ?),
       status = CASE WHEN status = 'onboarding' THEN 'pending_approval' ELSE status END,
       updated_at = datetime('now') WHERE id = ?`,
    ).run(JSON.stringify(seeded), planId, professionalEmail || null, restaurant.id)

    const seededRow = getOwnRestaurant(req.user.id) || { ...restaurant, plan: planId, ...seeded }
    const finalized = await finalizeOnboardingPayment(seededRow, {
      reference,
      amount,
      currency: 'ZAR',
      method: 'demo',
      gateway: 'iroas_demo',
    })

    return res.json({
      ok: true,
      alreadyPaid: true,
      demo: true,
      status: 'live',
      userId: formatUserId(req.user.id),
      professionalEmail,
      ownerEmail: req.user.email || '',
      restaurantName: restaurant.name,
      plan: planId,
      payment: finalized.payment,
      emails: finalized.emails,
    })
  }

  const reference = `ONB-${restaurant.id}-${Date.now().toString(36).toUpperCase()}`
  const appBase = appPublicUrl()
  const apiBase = apiPublicUrl()

  let checkout
  try {
    checkout = await addpayRequest(
      '/api/entry',
      {
        method: 'pay.paycloud.checkout',
        merchant_order_no: reference,
        order_amount: amount,
        price_currency: 'ZAR',
        notify_url: `${apiBase}/api/public/payments/addpay/webhook`,
        return_url: `${appBase}/onboarding/payment?paid=return`,
        description: `IROAS ${planMeta?.name || planId} launch — ${restaurant.name || 'your business'}`,
        expires: 300,
        term_ip: '127.0.0.1',
      },
      getPaymentSettings(),
    )
  } catch (err) {
    return res.status(err.status || 502).json({
      error: err.message || 'Unable to start payment with AddPay.',
    })
  }

  let data = checkout.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      data = null
    }
  }
  const payUrl = data?.pay_url || data?.payUrl || data?.checkout_url
  if (!payUrl) {
    console.error('[addpay] checkout response missing pay_url:', JSON.stringify(checkout).slice(0, 800))
    return res.status(502).json({
      error: 'AddPay did not return a payment URL. Check Payment settings / sandbox credentials.',
    })
  }

  const nextSettings = {
    ...settings,
    onboardingPayment: {
      paid: false,
      pending: true,
      reference,
      amount,
      currency: 'ZAR',
      gateway: 'addpay',
      method: 'addpay',
      planId,
      planName: planMeta?.name || planId,
      createdAt: new Date().toISOString(),
    },
    professionalEmail,
  }

  db.prepare(
    `UPDATE restaurants SET settings_json = ?, plan = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(JSON.stringify(nextSettings), planId, restaurant.id)

  res.json({ ok: true, payUrl, reference, amount, currency: 'ZAR', plan: planId })
})

function mapReservation(row) {
  return {
    id: row.id,
    guestName: row.guest_name,
    phone: row.phone,
    email: row.guest_email || '',
    guests: row.guests,
    date: row.date,
    time: row.time,
    notes: row.notes || '',
    status: row.status,
    tableId: row.table_id || null,
    createdAt: row.created_at,
  }
}

function mapReview(row) {
  return {
    id: row.id,
    author: row.author,
    rating: row.rating,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
  }
}

router.get('/reservations', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const rows = db
    .prepare(
      `SELECT * FROM reservations
       WHERE restaurant_id = ?
       ORDER BY date ASC, time ASC, id DESC`,
    )
    .all(restaurant.id)

  res.json({ reservations: rows.map(mapReservation) })
})

router.get('/onboarding-progress', async (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  res.json({ progress: await loadOnboardingProgress(restaurant.id) })
})

router.get('/one-link/stats', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const rows = db
    .prepare(
      `SELECT kind, dest_key AS key, COUNT(*) AS n FROM link_events
       WHERE restaurant_id = ? AND created_at >= datetime('now', '-30 days')
       GROUP BY kind, dest_key`,
    )
    .all(restaurant.id)
  const byKey = {}
  let views = 0
  let clicks = 0
  for (const r of rows) {
    if (r.kind === 'view') views += r.n
    else {
      clicks += r.n
      byKey[r.key] = r.n
    }
  }
  res.json({ views, clicks, byKey })
})

router.get('/guests', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  res.json({ guests: listGuests(restaurant.id) })
})

router.get('/availability', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const date = String(req.query.date || '').trim()
  const guests = Math.max(1, Math.min(20, Number(req.query.guests) || 2))
  if (!date) return res.status(400).json({ error: 'date query parameter is required.' })

  const settings = parseSettings(restaurant)
  const hours = parseHoursJson(restaurant.operating_hours)
  const existing = db
    .prepare(
      `SELECT id, date, time, guests, status FROM reservations
       WHERE restaurant_id = ? AND date = ? AND status IN (${ACTIVE_STATUS_SQL})`,
    )
    .all(restaurant.id, date)

  const includePast =
    String(req.query.includePast || '') === '1' || String(req.query.includePast || '') === 'true'

  const result = listSlots({
    hours,
    date,
    guests,
    existingRows: existing,
    maxCovers: maxCoversFromSettings(settings),
    includePast,
    ...bookingRules(restaurant, settings),
  })

  res.json({
    date,
    guests,
    maxCovers: maxCoversFromSettings(settings),
    closed: result.closed,
    reason: result.reason || null,
    slots: result.slots,
  })
})

router.post('/reservations', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const { guestName, name, phone, email, guests, date, time, notes, status, tableId } =
    req.body || {}
  const guest = String(guestName || name || '').trim()
  if (!guest || !String(phone || '').trim() || !date || !time) {
    return res.status(400).json({ error: 'Guest name, phone, date and time are required.' })
  }

  const guestCount = Math.max(1, Math.min(20, Number(guests) || 2))
  const guestEmail = String(email || '').trim() || null
  const settings = parseSettings(restaurant)
  const hours = parseHoursJson(restaurant.operating_hours)
  const desiredStatus = ['pending', 'confirmed', 'cancelled'].includes(status)
    ? status
    : 'confirmed'

  let insertedId = null
  try {
    const run = db.transaction(() => {
      const existing = db
        .prepare(
          `SELECT id, date, time, guests, status FROM reservations
           WHERE restaurant_id = ? AND date = ? AND status IN (${ACTIVE_STATUS_SQL})`,
        )
        .all(restaurant.id, String(date))

      const check = assertBookable({
        hours,
        date: String(date),
        time: String(time),
        guests: guestCount,
        existingRows: existing,
        maxCovers: maxCoversFromSettings(settings),
        ...bookingRules(restaurant, settings),
      })
      if (!check.ok) {
        const err = new Error(check.error)
        err.status = check.status
        throw err
      }

      let assignedTable =
        tableId != null && tableId !== ''
          ? Number(tableId)
          : assignTableForParty({
              restaurantId: restaurant.id,
              date: String(date),
              time: String(time),
              guests: guestCount,
            })

      if (tableId != null && tableId !== '') {
        const tableCheck = assertTableAvailable({
          restaurantId: restaurant.id,
          tableId: assignedTable,
          date: String(date),
          time: String(time),
          guests: guestCount,
        })
        if (!tableCheck.ok) {
          const err = new Error(tableCheck.error)
          err.status = tableCheck.status
          throw err
        }
      }

      const result = db
        .prepare(
          `INSERT INTO reservations
            (restaurant_id, guest_name, phone, guest_email, guests, date, time, notes, status, table_id, cancel_token)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          restaurant.id,
          guest,
          String(phone).trim(),
          guestEmail,
          guestCount,
          String(date),
          String(time),
          String(notes || '').trim() || null,
          desiredStatus,
          assignedTable || null,
          randomBytes(16).toString('hex'),
        )
      insertedId = result.lastInsertRowid
    })
    run.immediate()
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Unable to create booking.' })
  }

  const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(insertedId)
  upsertGuest(restaurant.id, { name: row.guest_name, phone: row.phone, email: row.guest_email })
  onReservationCreated(restaurant, row, { source: 'staff' })
  res.status(201).json({ reservation: mapReservation(row) })
})

router.patch('/reservations/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const row = db
    .prepare('SELECT * FROM reservations WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, restaurant.id)
  if (!row) return res.status(404).json({ error: 'Reservation not found.' })

  const { status, guestName, phone, email, guests, date, time, notes, tableId } = req.body || {}
  if (status && !RESERVATION_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Unknown booking status.' })
  }
  const nextStatus = status || row.status
  const statusProblem = checkStatusChange(row.status, nextStatus, {
    date: row.date,
    today: zonedNow(restaurant.timezone).date,
  })
  if (statusProblem) return res.status(409).json({ error: statusProblem })
  const nextActive = ACTIVE_RESERVATION_STATUSES.includes(nextStatus)
  const nextGuests =
    guests != null ? Math.max(1, Math.min(20, Number(guests) || 2)) : row.guests
  const nextDate = date != null ? String(date) : row.date
  const nextTime = time != null ? String(time) : row.time
  const nextName = guestName != null ? String(guestName).trim() : row.guest_name
  const nextPhone = phone != null ? String(phone).trim() : row.phone
  const nextEmail =
    email !== undefined ? String(email || '').trim() || null : row.guest_email
  const nextNotes =
    notes !== undefined ? String(notes || '').trim() || null : row.notes

  const needsCapacityCheck =
    nextActive &&
    (nextDate !== row.date ||
      nextTime !== row.time ||
      nextGuests !== row.guests ||
      (row.status === 'pending' && nextStatus === 'confirmed') ||
      row.status === 'cancelled')

  try {
    const run = db.transaction(() => {
      if (needsCapacityCheck) {
        const settings = parseSettings(restaurant)
        const hours = parseHoursJson(restaurant.operating_hours)
        const existing = db
          .prepare(
            `SELECT id, date, time, guests, status FROM reservations
             WHERE restaurant_id = ? AND date = ? AND status IN (${ACTIVE_STATUS_SQL})`,
          )
          .all(restaurant.id, nextDate)

        const check = assertBookable({
          hours,
          date: nextDate,
          time: nextTime,
          guests: nextGuests,
          existingRows: existing,
          maxCovers: maxCoversFromSettings(settings),
          excludeReservationId: row.id,
          ...bookingRules(restaurant, settings),
        })
        if (!check.ok) {
          const err = new Error(check.error)
          err.status = check.status
          throw err
        }
      }

      let nextTableId =
        tableId !== undefined
          ? tableId === null || tableId === ''
            ? null
            : Number(tableId)
          : row.table_id

      if (
        nextTableId == null &&
        nextActive &&
        (nextDate !== row.date || nextTime !== row.time || nextGuests !== row.guests)
      ) {
        nextTableId = assignTableForParty({
          restaurantId: restaurant.id,
          date: nextDate,
          time: nextTime,
          guests: nextGuests,
          excludeReservationId: row.id,
        })
      }

      if (nextTableId != null && nextActive) {
        const tableCheck = assertTableAvailable({
          restaurantId: restaurant.id,
          tableId: nextTableId,
          date: nextDate,
          time: nextTime,
          guests: nextGuests,
          excludeReservationId: row.id,
        })
        if (!tableCheck.ok) {
          const err = new Error(tableCheck.error)
          err.status = tableCheck.status
          throw err
        }
      }

      db.prepare(
        `UPDATE reservations
         SET guest_name = ?, phone = ?, guest_email = ?, guests = ?, date = ?, time = ?,
             notes = ?, status = ?, table_id = ?
         WHERE id = ?`,
      ).run(
        nextName,
        nextPhone,
        nextEmail,
        nextGuests,
        nextDate,
        nextTime,
        nextNotes,
        nextStatus,
        nextTableId,
        row.id,
      )
    })
    run.immediate()
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Unable to update booking.' })
  }

  const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(row.id)
  onReservationStatusChange(restaurant, row, updated)
  res.json({ reservation: mapReservation(updated) })
})

router.get('/tables', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  res.json({ tables: listDiningTables(restaurant.id) })
})

/** Pull dine-in tables from URY POS into dining_tables (dedupe T8/t08, keep POS names). */
router.post('/tables/sync-from-pos', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const posTables = await listUryTables(tenant)
    const tables = syncDiningTablesFromPos(restaurant.id, posTables)
    console.info(`[tables:sync-pos] restaurant=${restaurant.id} synced=${tables.length}`)
    res.json({ success: true, tables, synced: tables.length })
  } catch (err) {
    sendPosError(res, err, {
      label: 'tables:sync-pos',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not sync tables from the POS. Please try again.',
    })
  }
})

function getPosRestaurant(req, res) {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) {
    res.status(404).json({ success: false, error: 'No restaurant found.' })
    return null
  }
  if (restaurant.status === 'deleted') {
    res.status(403).json({ success: false, error: 'This account has been closed.' })
    return null
  }
  if (!assertNotAwaitingAccountApproval(restaurant, res)) return null
  return restaurant
}

function sendPosError(res, err, { label, restaurantId, unavailableMessage }) {
  if (err instanceof OrderingError) {
    console.warn(`[${label}] restaurant=${restaurantId} ordering=${err.code}`)
    return res.status(err.status).json({ success: false, code: err.code, error: err.message })
  }
  if (err instanceof IntegrationError) {
    if (err.code === 'mapping_invalid') {
      invalidateUryTenant(restaurantId)
      console.warn(`[${label}] restaurant=${restaurantId} mapping_invalid reason=${err.reason || 'unknown'}`)
      return res.status(409).json({
        success: false,
        code: 'pos_mapping_invalid',
        error: 'Your POS connection needs to be checked. Please contact IROAS support.',
      })
    }
    return res.status(409).json({
      success: false,
      code: 'pos_not_connected',
      error: 'Your POS is not connected yet.',
    })
  }
  if (err instanceof UryError) {
    if (err.code === 'auth_failed' || err.code === 'forbidden') invalidateUryTenant(restaurantId)
    console.warn(`[${label}] restaurant=${restaurantId} ury_error=${err.code}`)
    return res.status(502).json({ success: false, code: 'pos_unavailable', error: unavailableMessage })
  }
  console.error(`[${label}]`, err)
  return res.status(500).json({ success: false, error: unavailableMessage })
}

router.get('/pos-tables/options', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await getUryTableOptions(tenant)
    res.json({ success: true, data })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-tables:options',
      restaurantId: restaurant.id,
      unavailableMessage: 'Table service is temporarily unavailable. Please try again.',
    })
  }
})

router.post('/pos-tables', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const tables = await createUryTable(tenant, req.body || {})
    console.info(`[pos-tables:create] restaurant=${restaurant.id} table=${req.body?.name || ''}`)
    res.status(201).json({ success: true, data: { tables } })
  } catch (err) {
    if (err instanceof TableEditError) return res.status(err.status).json({ success: false, code: err.code, error: err.message })
    sendPosError(res, err, {
      label: 'pos-tables:create',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not add the table. Please try again.',
    })
  }
})

router.get('/pos-tables', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const tables = await listUryTables(tenant)
    res.json({ success: true, data: { tables } })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-tables',
      restaurantId: restaurant.id,
      unavailableMessage: 'Table service is temporarily unavailable. Please try again.',
    })
  }
})

router.get('/dashboard', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const [orders, tables, menu] = await Promise.all([
      listUryOrders(tenant),
      listUryTables(tenant),
      getUryMenu(tenant).catch(() => null),
    ])
    const items = (menu?.categories || []).flatMap((category) => category.items || [])
    const currency = menu?.currency || orders.find((order) => order.currency)?.currency || ''
    res.json({ success: true, data: buildDashboardSummary({ orders, tables, items, currency, timezone: restaurant.timezone }) })
  } catch (err) {
    sendPosError(res, err, {
      label: 'dashboard',
      restaurantId: restaurant.id,
      unavailableMessage: 'The dashboard is temporarily unavailable. Please try again.',
    })
  }
})

router.get('/pos-menu', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await getUryMenu(tenant)
    res.json({ success: true, data })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-menu',
      restaurantId: restaurant.id,
      unavailableMessage: 'Menu service is temporarily unavailable. Please try again.',
    })
  }
})

router.get('/pos-menu/options', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await getUryMenuOptions(tenant)
    res.json({ success: true, data })
  } catch (err) {
    if (err instanceof MenuEditError) return res.status(err.status).json({ success: false, code: err.code, error: err.message })
    sendPosError(res, err, {
      label: 'pos-menu:options',
      restaurantId: restaurant.id,
      unavailableMessage: 'Menu service is temporarily unavailable. Please try again.',
    })
  }
})

router.post('/pos-menu/items', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await createUryMenuItem(tenant, req.body || {})
    console.info(`[pos-menu:create-item] restaurant=${restaurant.id} menu=${req.body?.menu || ''}`)
    res.status(201).json({ success: true, data })
  } catch (err) {
    if (err instanceof MenuEditError) return res.status(err.status).json({ success: false, code: err.code, error: err.message })
    sendPosError(res, err, {
      label: 'pos-menu:create-item',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not add the menu item. Please try again.',
    })
  }
})

router.post('/pos-menu/courses', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await createUryCourse(tenant, req.body || {})
    res.status(201).json({ success: true, data })
  } catch (err) {
    if (err instanceof MenuEditError) return res.status(err.status).json({ success: false, code: err.code, error: err.message })
    sendPosError(res, err, {
      label: 'pos-menu:create-course',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not add the course. Please try again.',
    })
  }
})

router.post('/pos-menu/menus', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await createUryMenuDoc(tenant, req.body || {})
    res.status(201).json({ success: true, data })
  } catch (err) {
    if (err instanceof MenuEditError) return res.status(err.status).json({ success: false, code: err.code, error: err.message })
    sendPosError(res, err, {
      label: 'pos-menu:create-menu',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not add the menu. Please try again.',
    })
  }
})

router.post('/pos-menu/items/:code/stock', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await addUryItemStock(tenant, req.params.code, req.body?.qty)
    console.info(`[pos-menu:stock] restaurant=${restaurant.id} item=${req.params.code}`)
    res.json({ success: true, data })
  } catch (err) {
    if (err instanceof MenuEditError) return res.status(err.status).json({ success: false, code: err.code, error: err.message })
    sendPosError(res, err, {
      label: 'pos-menu:stock',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not update stock. Nothing was changed.',
    })
  }
})

router.patch('/pos-menu/items/:id', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const { available, price } = req.body || {}
    const data = await updateUryMenuItem(tenant, req.params.id, { available, price })
    console.info(`[pos-menu:update] restaurant=${restaurant.id} row=${req.params.id}`)
    res.json({ success: true, data })
  } catch (err) {
    if (err instanceof MenuEditError) {
      return res.status(err.status).json({ success: false, code: err.code, error: err.message })
    }
    sendPosError(res, err, {
      label: 'pos-menu:update',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not reach the POS. The menu was not changed. Please try again.',
    })
  }
})

router.get('/pos-tables/qr', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const tables = await listUryTableQrCodes(tenant)
    res.json({ success: true, data: { tables, guestOrdering: Boolean(getUryFeatures(restaurant.id)?.guestOrdering) } })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-tables:qr',
      restaurantId: restaurant.id,
      unavailableMessage: 'Table service is temporarily unavailable. Please try again.',
    })
  }
})

router.get('/pos-shift', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await getUryShift(tenant)
    res.json({ success: true, data })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-shift',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not read the POS shift. Please try again.',
    })
  }
})

router.post('/pos-shift/open', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await openUryShift(tenant, {
      openingAmount: req.body?.openingAmount,
      balanceDetails: req.body?.balanceDetails,
    })
    console.info(`[pos-shift] restaurant=${restaurant.id} open entry=${data.entry?.name || '?'}`)
    res.status(data.alreadyOpen ? 200 : 201).json({ success: true, data })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-shift:open',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not open the POS shift. Please try again.',
    })
  }
})

router.post('/pos-shift/close', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await closeUryShift(tenant)
    console.info(`[pos-shift] restaurant=${restaurant.id} close entry=${data.closedEntry || 'already-closed'}`)
    res.json({ success: true, data })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-shift:close',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not close the POS shift. Please try again.',
    })
  }
})

router.get('/pos-orders', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const orders = attachKitchenProgress(restaurant.id, await listUryOrders(tenant))
    res.json({ success: true, data: { orders, fetchedAt: new Date().toISOString() } })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-orders',
      restaurantId: restaurant.id,
      unavailableMessage: 'Order service is temporarily unavailable. Please try again.',
    })
  }
})

/** Advance or set the IROAS kitchen lane for a URY invoice (does not change POS payment status). */
router.patch('/pos-orders/:invoiceId/kitchen', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const advance = req.body?.advance === true || req.body?.advance === 'true'
    const step = req.body?.step ? String(req.body.step) : undefined
    const data = setKitchenStep(restaurant.id, req.params.invoiceId, { advance, step })
    res.json({ success: true, data })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, code: err.code, error: err.message })
    sendPosError(res, err, {
      label: 'pos-orders:kitchen',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not update kitchen status.',
    })
  }
})

router.get('/pos-orders/:invoiceId/bill', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await getUryInvoiceBill(tenant, req.params.invoiceId)
    res.json({ success: true, data })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-orders:bill',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not open this order. Please try again.',
    })
  }
})

router.post('/pos-orders/:invoiceId/pay', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await payUryInvoice(tenant, req.params.invoiceId, req.body || {})
    console.info(`[pos-orders:pay] restaurant=${restaurant.id} invoice=${data.invoice}`)
    res.json({ success: true, data })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-orders:pay',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not take payment. Nothing was settled.',
    })
  }
})

router.post('/pos-orders/:invoiceId/cancel', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await cancelUryInvoice(tenant, req.params.invoiceId, req.body || {})
    console.info(`[pos-orders:cancel] restaurant=${restaurant.id} invoice=${data.invoice}`)
    res.json({ success: true, data })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-orders:cancel',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not cancel this order. Nothing was changed.',
    })
  }
})

router.post('/pos-orders/:invoiceId/print', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await printUryInvoice(tenant, req.params.invoiceId)
    res.json({ success: true, data })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-orders:print',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not print this bill. Please try again.',
    })
  }
})

router.get('/pos-order-menu', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await getUryOrderMenu(tenant, req.query.table)
    res.json({ success: true, data })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-order-menu',
      restaurantId: restaurant.id,
      unavailableMessage: 'Menu service is temporarily unavailable. Please try again.',
    })
  }
})

router.post('/pos-orders', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const { table, customer, items, pax, comments, requestId } = req.body || {}
    const data = await placeOnce(restaurant.id, requestId, () =>
      placeUryOrder(tenant, { table, customer, items, pax, comments }),
    )
    console.info(`[pos-orders] restaurant=${restaurant.id} placed invoice=${data.invoice || '?'} table=${data.table}${data.replayed ? ' replayed' : ''}`)
    res.status(data.replayed ? 200 : 201).json({ success: true, data })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-orders:create',
      restaurantId: restaurant.id,
      unavailableMessage: 'Could not reach the POS. The order was not sent. Please try again.',
    })
  }
})

router.post('/pos-customers', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const { name, phone } = req.body || {}
    const data = await findOrCreateUryCustomer(tenant, { name, phone })
    res.status(data.created ? 201 : 200).json({ success: true, data })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-customers:upsert',
      restaurantId: restaurant.id,
      unavailableMessage: 'Customer service is temporarily unavailable. Please try again.',
    })
  }
})

router.get('/pos-customers', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const customers = await listUryCustomers(tenant)
    res.json({ success: true, data: { customers } })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-customers',
      restaurantId: restaurant.id,
      unavailableMessage: 'Customer service is temporarily unavailable. Please try again.',
    })
  }
})

router.get('/pos-staff', async (req, res) => {
  const restaurant = getPosRestaurant(req, res)
  if (!restaurant) return
  try {
    const tenant = await resolveUryTenant(restaurant.id)
    const data = await listUryStaff(tenant)
    res.json({ success: true, data })
  } catch (err) {
    sendPosError(res, err, {
      label: 'pos-staff',
      restaurantId: restaurant.id,
      unavailableMessage: 'Staff service is temporarily unavailable. Please try again.',
    })
  }
})

router.post('/tables', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const result = upsertDiningTable(restaurant.id, req.body || {})
  if (!result.ok) return res.status(result.status).json({ error: result.error })
  res.status(201).json({ table: result.table })
})

router.patch('/tables/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const result = upsertDiningTable(restaurant.id, { ...(req.body || {}), id: Number(req.params.id) })
  if (!result.ok) return res.status(result.status).json({ error: result.error })
  res.json({ table: result.table })
})

router.delete('/tables/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const existing = db
    .prepare('SELECT id FROM dining_tables WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, restaurant.id)
  if (!existing) return res.status(404).json({ error: 'Table not found.' })
  db.prepare('UPDATE dining_tables SET active = 0 WHERE id = ?').run(existing.id)
  db.prepare('UPDATE reservations SET table_id = NULL WHERE table_id = ?').run(existing.id)
  res.json({ ok: true })
})

router.get('/orders', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const orders = listOrders(restaurant.id, {
    status: req.query.status,
    paymentStatus: req.query.paymentStatus,
    serviceMode: req.query.serviceMode,
  })
  res.json({ orders })
})

router.get('/orders/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const order = getOrderById(restaurant.id, Number(req.params.id))
  if (!order) return res.status(404).json({ error: 'Order not found.' })
  res.json({ order })
})

router.patch('/orders/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const { status } = req.body || {}
  if (!status) return res.status(400).json({ error: 'status is required.' })
  const result = updateOrderStatus(restaurant.id, Number(req.params.id), status)
  if (!result.ok) return res.status(result.status).json({ error: result.error })
  res.json({ order: result.order })
})

router.post('/orders/:id/mark-paid', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })
  const result = markOrderPaid(restaurant.id, Number(req.params.id), {
    paymentMethod: req.body?.paymentMethod,
  })
  if (!result.ok) return res.status(result.status).json({ error: result.error })
  res.json({ order: result.order })
})

router.get('/reviews', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const rows = db
    .prepare(
      `SELECT * FROM reviews WHERE restaurant_id = ? ORDER BY created_at DESC`,
    )
    .all(restaurant.id)

  res.json({ reviews: rows.map(mapReview) })
})

router.post('/reviews', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const { author, rating, body, status } = req.body || {}
  if (!String(author || '').trim() || !String(body || '').trim()) {
    return res.status(400).json({ error: 'Author and review text are required.' })
  }

  const result = db
    .prepare(
      `INSERT INTO reviews (restaurant_id, author, rating, body, status)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      restaurant.id,
      String(author).trim(),
      Math.max(1, Math.min(5, Number(rating) || 5)),
      String(body).trim(),
      status === 'hidden' ? 'hidden' : 'published',
    )

  const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ review: mapReview(row) })
})

router.patch('/reviews/:id', (req, res) => {
  const restaurant = getOwnRestaurant(req.user.id)
  if (!restaurant) return res.status(404).json({ error: 'No restaurant found.' })

  const row = db
    .prepare('SELECT * FROM reviews WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, restaurant.id)
  if (!row) return res.status(404).json({ error: 'Review not found.' })

  const { status, author, rating, body } = req.body || {}
  const nextStatus =
    status && ['published', 'hidden'].includes(status) ? status : row.status

  db.prepare(
    `UPDATE reviews SET author = ?, rating = ?, body = ?, status = ? WHERE id = ?`,
  ).run(
    author != null ? String(author).trim() : row.author,
    rating != null ? Math.max(1, Math.min(5, Number(rating) || 5)) : row.rating,
    body != null ? String(body).trim() : row.body,
    nextStatus,
    row.id,
  )

  const updated = db.prepare('SELECT * FROM reviews WHERE id = ?').get(row.id)
  res.json({ review: mapReview(updated) })
})

export default router
