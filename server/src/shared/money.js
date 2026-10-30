const SYMBOL = process.env.DEFAULT_CURRENCY_SYMBOL || 'R'

export function formatMoney(n) {
  return `${SYMBOL}${Math.round(Number(n) || 0)}`
}
