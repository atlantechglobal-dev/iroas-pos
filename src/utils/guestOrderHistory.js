const storageKey = (slug) => `iroas.guestOrders.${slug}`

export function loadGuestOrderHistory(slug) {
  try {
    const raw = localStorage.getItem(storageKey(slug))
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function rememberGuestOrder(slug, order) {
  if (!slug || !order) return
  const code = order.publicCode || order.id
  if (!code) return
  const entry = {
    publicCode: String(code),
    phone: order.phone || order.checkout?.phone || '',
    total: order.total,
    status: order.status || 'new',
    serviceMode: order.serviceMode || '',
    paymentTiming: order.paymentTiming || 'bill_now',
    paymentStatus: order.paymentStatus || 'payment_pending',
    tableName: order.tableName || '',
    createdAt: order.createdAt || new Date().toISOString(),
  }
  const prev = loadGuestOrderHistory(slug).filter((o) => o.publicCode !== entry.publicCode)
  localStorage.setItem(storageKey(slug), JSON.stringify([entry, ...prev].slice(0, 30)))
}

export function guestPhoneHint(slug) {
  const hist = loadGuestOrderHistory(slug)
  return hist.find((o) => o.phone)?.phone || ''
}
