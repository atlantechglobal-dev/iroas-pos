const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PERSON_NAME_RE = /^[\p{L}][\p{L}\s'.-]*$/u

export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim())
}

export function isValidPassword(value) {
  const password = String(value || '')
  return password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password)
}

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
  return mobileDigitsOnly(value).slice(0, 10)
}

export function isValidMobile(value) {
  return mobileDigitsOnly(value).length === 10
}
