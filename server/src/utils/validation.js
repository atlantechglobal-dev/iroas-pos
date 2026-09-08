const PERSON_NAME_RE = /^[\p{L}][\p{L}\s'.-]*$/u

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
  return String(value || '').replace(/\D/g, '')
}

export function isValidMobile(value) {
  return normalizeMobileDigits(value).length === 10
}