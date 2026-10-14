/** Price in the POS price list's currency; no symbol is guessed when the POS gives none. */
export function formatPosPrice(n, currency) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  if (!currency) return String(n)
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(n))
  } catch {
    return `${currency} ${n}`
  }
}

/** "2026-10-20" -> "Tue, 20 Oct" in the guest's locale. */
export function formatPosDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}
