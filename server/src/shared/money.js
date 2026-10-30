// Currency display for server-generated messages. Default ZAR (South Africa);
// set DEFAULT_CURRENCY_SYMBOL in server/.env to change per deployment.
const SYMBOL = process.env.DEFAULT_CURRENCY_SYMBOL || 'R'

export function formatMoney(n) {
  return `${SYMBOL}${Math.round(Number(n) || 0)}`
}
