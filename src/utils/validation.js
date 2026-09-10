const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PERSON_NAME_RE = /^[\p{L}][\p{L}\s'.-]*$/u

export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim())
}

export function isValidPassword(value) {
  const password = String(value || '')
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  )
}

export const passwordRequirements =
  'Use at least 8 characters, including uppercase, lowercase, and a number.'

export function passwordsMatch(password, confirmPassword) {
  return password === confirmPassword && password.length > 0
}

export function required(value) {
  return String(value || '').trim().length > 0
}

/** Rejects empty, numeric-only, and special-character-only names. */
export function isValidPersonName(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return false
  if (/^\d+$/.test(trimmed)) return false
  if (!/\p{L}/u.test(trimmed)) return false
  return PERSON_NAME_RE.test(trimmed)
}

export function mobileDigitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

export function normalizeMobileDigits(value) {
  return mobileDigitsOnly(value).slice(0, 15)
}

export function formatE164(dialCode, nationalNumber) {
  const code = mobileDigitsOnly(dialCode)
  const national = mobileDigitsOnly(nationalNumber)
  if (!code || !national) return ''
  return `+${code}${national}`
}

/** E.164: country code 1–3 digits, subscriber 4–14, total 8–15. */
export function isValidInternationalMobile(dialCode, nationalNumber) {
  const code = mobileDigitsOnly(dialCode)
  const national = mobileDigitsOnly(nationalNumber)
  if (code.length < 1 || code.length > 3) return false
  if (national.length < 4 || national.length > 14) return false
  const total = code.length + national.length
  return total >= 8 && total <= 15
}

export function isValidMobile(value) {
  const digits = mobileDigitsOnly(value)
  return digits.length >= 8 && digits.length <= 15
}
