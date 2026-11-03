// POS shift open/close, using the same URY methods as the POS settings screen:
//   GET  ury.ury_pos.api.get_pos_opening_screen_data
//   GET  ury.ury_pos.api.get_open_pos_opening_entries
//   GET  ury.ury_pos.api.get_checklist
//   GET  erpnext...check_opening_entry
//   POST ury.ury_pos.api.create_pos_opening_entry
//   GET  erpnext...pos_closing_entry.get_invoices (fallback get_pos_invoices)
//   POST /api/resource/POS Closing Entry then submit (docstatus 1)
// The opening entry is created for the POS profile cashier (Administrator on
// the demo profile) so URY POS shows the same session. A profile-level open
// entry is enough for IROAS to accept orders.

import { db } from '../../infra/db.js'
import { zonedNow } from '../../services/reservationAvailability.js'
import { UryError } from './uryClient.js'
import { OrderingError } from './uryOrdering.js'

/** URY accepts orders only on a shift opened today, in the restaurant's timezone. */
export function isShiftOutdated(startedAt, timezone, now = new Date()) {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(String(startedAt || ''))
  return Boolean(day) && day[0] < zonedNow(timezone, now).date
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function money(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

async function screenData(client, posProfile) {
  const body = await client.get('ury.ury_pos.api.get_pos_opening_screen_data', { pos_profile: posProfile })
  return body?.message || {}
}

async function openEntries(client, posProfile) {
  const [listed, reported] = await Promise.all([
    client.getList('POS Opening Entry', {
      fields: ['name', 'user', 'status', 'period_start_date', 'pos_profile', 'docstatus'],
      filters: [
        ['pos_profile', '=', posProfile],
        ['status', '=', 'Open'],
      ],
      limit: 20,
    }),
    client
      .get('ury.ury_pos.api.get_open_pos_opening_entries', { pos_profile: posProfile })
      .then((body) => asArray(body?.message))
      .catch((err) => {
        if (err instanceof UryError) return []
        throw err
      }),
  ])
  const rows = [...listed, ...reported].filter((row) => row?.name && (!row.pos_profile || row.pos_profile === posProfile))
  const byName = new Map(rows.map((row) => [row.name, row]))
  return [...byName.values()]
}

async function userEntries(client, user) {
  const body = await client.get('erpnext.selling.page.point_of_sale.point_of_sale.check_opening_entry', { user })
  return asArray(body?.message)
}

function mapEntry(row, user) {
  if (!row?.name) return null
  return {
    name: row.name,
    startedAt: row.period_start_date || null,
    user: row.user || user || '',
    posProfile: row.pos_profile || '',
  }
}

/**
 * User that owns the opening entry. URY POS Open Session checks the logged-in
 * user (Administrator on this profile). Prefer that user when the profile
 * allows them, otherwise the profile cashier.
 */
async function resolveCashier(client, posProfile) {
  const doc = (await client.getDoc('POS Profile', posProfile)).docs[0]
  const users = asArray(doc.applicable_for_users)
    .map((row) => row.user)
    .filter(Boolean)
  if (users.includes('Administrator')) return 'Administrator'
  try {
    const limited = (await client.get('ury.ury_pos.api.getPosProfile'))?.message || {}
    if (limited.pos_profile === posProfile && limited.cashier) return limited.cashier
  } catch (err) {
    if (!(err instanceof UryError)) throw err
  }
  const main = asArray(doc.applicable_for_users).find((row) => row.custom_main_cashier === 1)
  return main?.user || users[0] || ''
}

function restaurantTimezone(restaurantId) {
  return db.prepare('SELECT timezone FROM restaurants WHERE id = ?').get(restaurantId)?.timezone || ''
}

/** Current shift for this restaurant's POS profile. The cashier is the POS profile cashier. */
export async function getUryShift(tenant) {
  const { client, posProfile, integrationUser } = tenant
  const [screen, entries, checked, cashier, profileDoc] = await Promise.all([
    screenData(client, posProfile),
    openEntries(client, posProfile),
    userEntries(client, integrationUser),
    resolveCashier(client, posProfile),
    client.getDoc('POS Profile', posProfile).then((body) => body.docs[0]),
  ])
  const mine =
    entries.find((row) => row.user === cashier) ||
    entries.find((row) => row.user === integrationUser) ||
    checked.find((row) => !row.pos_profile || row.pos_profile === posProfile) ||
    entries[0] ||
    null
  return {
    open: Boolean(mine),
    posProfile,
    company: screen.company || profileDoc.company || '',
    branch: screen.branch || profileDoc.branch || '',
    restaurant: profileDoc.restaurant || screen.restaurant || '',
    cashier,
    currency: screen.company_currency || '',
    currencySymbol: screen.currency_symbol || '',
    user: integrationUser,
    entry: mapEntry(mine, cashier),
    outdated: Boolean(mine) && isShiftOutdated(mine.period_start_date, restaurantTimezone(tenant.restaurantId)),
    paymentModes: asArray(screen.payment_modes).map((mode) => ({
      mode: mode.mode_of_payment,
      openingAmount: money(mode.opening_amount),
    })),
    dailyClosePending: Boolean(screen.daily_close_pending),
    sessionStart: mine?.period_start_date || null,
  }
}

async function assertChecklist(client, posProfile, checklistType) {
  let body
  try {
    body = await client.get('ury.ury_pos.api.get_checklist', {
      pos_profile: posProfile,
      checklist_type: checklistType,
    })
  } catch (err) {
    if (err instanceof UryError && (err.code === 'not_found' || err.status === 404)) return
    throw err
  }
  const blocked = body?.message?.blocked_by
  if (blocked) {
    throw new OrderingError(
      'shift_blocked',
      `Complete the POS ${checklistType.toLowerCase()} checklist before continuing.`,
      { status: 409 },
    )
  }
}

function balanceDetails(current, input) {
  const supplied = asArray(input.balanceDetails)
    .map((row) => ({
      mode_of_payment: String(row?.mode_of_payment || row?.mode || '').trim(),
      opening_amount: money(row?.opening_amount ?? row?.openingAmount),
    }))
    .filter((row) => row.mode_of_payment)
  if (supplied.length) return supplied
  const openingAmount = input.openingAmount == null ? null : money(input.openingAmount)
  const modes = current.paymentModes.length ? current.paymentModes : [{ mode: 'Cash', openingAmount: 0 }]
  return modes.map((mode, index) => ({
    mode_of_payment: mode.mode,
    opening_amount: openingAmount != null && index === 0 ? openingAmount : mode.openingAmount,
  }))
}

/** Create the opening entry as the POS cashier so URY POS (Administrator) sees the same session. */
async function createCashierOpening(tenant, { company, branch, restaurant, cashier, balance_details }) {
  const now = await serverNow(tenant.client)
  const doc = {
    period_start_date: now,
    posting_date: String(now).slice(0, 10),
    user: cashier,
    company,
    pos_profile: tenant.posProfile,
    balance_details,
  }
  if (branch) doc.branch = branch
  if (restaurant) doc.restaurant = restaurant
  let created
  try {
    created = await tenant.client.writeResource('POST', encodeURIComponent('POS Opening Entry'), doc)
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') {
      throw new OrderingError('shift_rejected', err.message, { status: 422 })
    }
    throw err
  }
  const name = created?.data?.name
  if (!name) throw new OrderingError('shift_rejected', 'The POS did not create an opening entry.', { status: 502 })

  const draft = (await tenant.client.getDoc('POS Opening Entry', name)).docs[0]
  if (draft.user !== cashier) {
    try {
      await tenant.client.post('frappe.client.set_value', {
        doctype: 'POS Opening Entry',
        name,
        fieldname: 'user',
        value: cashier,
      })
    } catch (err) {
      if (err instanceof UryError && err.code === 'validation') {
        throw new OrderingError('shift_rejected', err.message, { status: 422 })
      }
      throw err
    }
  }

  try {
    await tenant.client.writeResource(
      'PUT',
      `${encodeURIComponent('POS Opening Entry')}/${encodeURIComponent(name)}`,
      { docstatus: 1 },
    )
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') {
      throw new OrderingError('shift_rejected', err.message, { status: 422 })
    }
    throw err
  }

  const saved = (await tenant.client.getDoc('POS Opening Entry', name)).docs[0]
  if (saved.user !== cashier) {
    throw new OrderingError(
      'shift_rejected',
      `The shift was saved for ${saved.user || 'another user'} instead of ${cashier}.`,
      { status: 422 },
    )
  }
  return name
}

/** Opens today's POS shift for the POS cashier. A cashier shift that is already open is left as-is. */
export async function openUryShift(tenant, input = {}) {
  let current = await getUryShift(tenant)
  if (current.open && current.entry?.user === current.cashier) return { ...current, alreadyOpen: true }
  if (!current.company) {
    throw new OrderingError('pos_closed', 'The POS profile has no company, so a shift cannot be opened.', { status: 409 })
  }
  if (!current.cashier) {
    throw new OrderingError('shift_rejected', 'This POS profile has no cashier, so URY POS cannot show the session.', { status: 409 })
  }
  if (current.dailyClosePending) {
    throw new OrderingError('pos_close_required', 'Close the previous POS shift before opening a new one.', { status: 409 })
  }
  if (current.open) await closeUryShift(tenant)
  await assertChecklist(tenant.client, tenant.posProfile, 'Opening')
  current = await getUryShift(tenant)

  await createCashierOpening(tenant, {
    company: current.company,
    branch: current.branch,
    restaurant: current.restaurant,
    cashier: current.cashier,
    balance_details: balanceDetails(current, input),
  })

  const next = await getUryShift(tenant)
  if (!next.open || next.entry?.user !== next.cashier) {
    throw new OrderingError('shift_rejected', 'The POS did not open a shift for the cashier.', { status: 502 })
  }
  return { ...next, alreadyOpen: false }
}

async function serverNow(client) {
  try {
    const body = await client.get('ury.ury.api.ury_server_time.get_server_time')
    const message = body?.message
    if (typeof message === 'string' && message.trim()) return message.trim()
    if (message?.datetime) return String(message.datetime)
  } catch (err) {
    if (!(err instanceof UryError)) throw err
  }
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

async function shiftInvoices(client, { start, end, posProfile, user }) {
  const methods = [
    'erpnext.accounts.doctype.pos_closing_entry.pos_closing_entry.get_invoices',
    'erpnext.accounts.doctype.pos_closing_entry.pos_closing_entry.get_pos_invoices',
  ]
  let lastError = null
  for (const method of methods) {
    try {
      const body = await client.get(method, { start, end, pos_profile: posProfile, user })
      return asArray(body?.message)
    } catch (err) {
      lastError = err
      if (!(err instanceof UryError) || err.status !== 404) throw err
    }
  }
  if (lastError) throw lastError
  return []
}

/** Closes the integration user's open shift and submits the POS Closing Entry. */
export async function closeUryShift(tenant) {
  const current = await getUryShift(tenant)
  if (!current.open || !current.entry?.name) {
    return { ...current, alreadyClosed: true }
  }
  await assertChecklist(tenant.client, tenant.posProfile, 'Closing')

  const opening = (await tenant.client.getDoc('POS Opening Entry', current.entry.name)).docs[0]
  if (opening.pos_profile !== tenant.posProfile) {
    throw new OrderingError('shift_rejected', 'The open shift does not belong to this POS profile.', { status: 409 })
  }
  const end = await serverNow(tenant.client)
  const start = opening.period_start_date || current.entry.startedAt
  const invoices = await shiftInvoices(tenant.client, {
    start,
    end,
    posProfile: tenant.posProfile,
    user: opening.user || tenant.integrationUser,
  })

  const paidByMode = new Map()
  for (const invoice of invoices) {
    for (const payment of asArray(invoice.payments)) {
      const mode = payment.mode_of_payment
      if (!mode) continue
      paidByMode.set(mode, money((paidByMode.get(mode) || 0) + money(payment.amount)))
    }
  }
  const openingModes = asArray(opening.balance_details)
  const modes = openingModes.length
    ? openingModes
    : current.paymentModes.map((mode) => ({ mode_of_payment: mode.mode, opening_amount: mode.openingAmount }))
  const payment_reconciliation = modes.map((mode) => {
    const openingAmount = money(mode.opening_amount)
    const expected = money(openingAmount + (paidByMode.get(mode.mode_of_payment) || 0))
    return {
      mode_of_payment: mode.mode_of_payment,
      opening_amount: openingAmount,
      expected_amount: expected,
      closing_amount: expected,
    }
  })

  const doc = {
    pos_opening_entry: opening.name,
    period_start_date: start,
    period_end_date: end,
    posting_date: String(end).slice(0, 10),
    pos_profile: tenant.posProfile,
    user: opening.user || tenant.integrationUser,
    company: opening.company || current.company,
    pos_transactions: invoices
      .filter((invoice) => invoice.name)
      .map((invoice) => ({
        pos_invoice: invoice.name,
        customer: invoice.customer || undefined,
        posting_date: invoice.posting_date || undefined,
        grand_total: money(invoice.grand_total),
      })),
    payment_reconciliation,
  }

  let created
  try {
    created = await tenant.client.writeResource('POST', encodeURIComponent('POS Closing Entry'), doc)
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') {
      throw new OrderingError('shift_rejected', err.message, { status: 422 })
    }
    throw err
  }
  const name = created?.data?.name
  if (!name) throw new OrderingError('shift_rejected', 'The POS did not create a closing entry.', { status: 502 })

  try {
    await tenant.client.writeResource('PUT', `${encodeURIComponent('POS Closing Entry')}/${encodeURIComponent(name)}`, {
      docstatus: 1,
    })
  } catch (err) {
    if (err instanceof UryError && err.code === 'validation') {
      throw new OrderingError('shift_rejected', err.message, { status: 422 })
    }
    throw err
  }

  const next = await getUryShift(tenant)
  return { ...next, closedEntry: name, alreadyClosed: false }
}
