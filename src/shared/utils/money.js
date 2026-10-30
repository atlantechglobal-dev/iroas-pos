export const CURRENCY_SYMBOL = import.meta.env.VITE_CURRENCY_SYMBOL || 'R'

export function formatMoney(n) {
  return `${CURRENCY_SYMBOL}${Math.round(Number(n) || 0)}`
}
