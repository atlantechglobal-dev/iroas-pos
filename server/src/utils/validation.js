const PERSON_NAME_RE = /^[\p{L}][\p{L}\s'.-]*$/u
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function isValidEmail(value) {
  return EMAIL_RE.test(normalizeEmail(value))
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

export function isValidPersonName(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return false
  if (/^\d+$/.test(trimmed)) return false
  if (!/\p{L}/u.test(trimmed)) return false
  return PERSON_NAME_RE.test(trimmed)
}

export function isValidSignupName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length < 2) return false
  return parts.every(isValidPersonName)
}

export function normalizeMobileDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 15)
}

export function isValidMobile(value) {
  const digits = normalizeMobileDigits(value)
  return digits.length >= 8 && digits.length <= 15
}
