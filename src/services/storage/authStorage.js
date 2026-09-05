import { STORAGE_KEYS } from '../../constants/storageKeys.js'

export function getToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN)
}

export function getStoredUser() {
  const raw = localStorage.getItem(STORAGE_KEYS.USER)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setSession(token, user) {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token)
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN)
  localStorage.removeItem(STORAGE_KEYS.USER)
}

export function hasSession() {
  return Boolean(getToken() && getStoredUser())
}
