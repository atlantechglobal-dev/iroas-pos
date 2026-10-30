// Currency display for guest-facing prices. IROAS targets South Africa (ZAR);
// override per deployment with VITE_CURRENCY_SYMBOL.
export const CURRENCY_SYMBOL = import.meta.env.VITE_CURRENCY_SYMBOL || 'R'

export function formatMoney(n) {
  return `${CURRENCY_SYMBOL}${Math.round(Number(n) || 0)}`
}
