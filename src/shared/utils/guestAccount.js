const storageKey = (slug) => `iroas.guestAccount.${slug}`

/** Saved restaurant guest profile (linked to URY Customer after account create / sign-in). */
export function loadGuestAccount(slug) {
  try {
    const raw = localStorage.getItem(storageKey(slug))
    const data = raw ? JSON.parse(raw) : null
    if (!data || typeof data !== 'object') return null
    if (!data.phone || String(data.phone).replace(/\D/g, '').length < 7) return null
    return {
      name: String(data.name || '').trim(),
      phone: String(data.phone || '').trim(),
      customerId: data.customerId ? String(data.customerId) : '',
      savedAt: data.savedAt || null,
    }
  } catch {
    return null
  }
}

export function saveGuestAccount(slug, account) {
  if (!slug || !account?.phone) return null
  const next = {
    name: String(account.name || '').trim(),
    phone: String(account.phone || '').trim(),
    customerId: account.customerId ? String(account.customerId) : '',
    savedAt: new Date().toISOString(),
  }
  localStorage.setItem(storageKey(slug), JSON.stringify(next))
  return next
}

export function clearGuestAccount(slug) {
  try {
    localStorage.removeItem(storageKey(slug))
  } catch {
    /* ignore */
  }
}
