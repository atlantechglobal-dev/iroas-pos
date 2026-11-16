import { useEffect, useState } from 'react'
import { restaurantApi } from '@/shared/api/restaurantApi'

const LABEL_KEY = 'iroas-restaurant-label'
const memory = { name: '', status: '' }

function readStoredLabel() {
  try {
    const raw = sessionStorage.getItem(LABEL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.name !== 'string' || !parsed.name.trim()) return null
    return { name: parsed.name.trim(), status: parsed.status || '' }
  } catch {
    return null
  }
}

function rememberLabel(name, status) {
  const next = { name: String(name || '').trim(), status: status || '' }
  if (!next.name) return
  memory.name = next.name
  memory.status = next.status
  try {
    sessionStorage.setItem(LABEL_KEY, JSON.stringify(next))
  } catch {
    /* storage can be blocked; the in-memory label still covers this tab */
  }
}

export function clearRestaurantLabelCache() {
  memory.name = ''
  memory.status = ''
  try {
    sessionStorage.removeItem(LABEL_KEY)
  } catch {
    /* ignore */
  }
}

const storedLabel = readStoredLabel()
if (storedLabel) {
  memory.name = storedLabel.name
  memory.status = storedLabel.status
}

let fetchedAt = 0
let inflight = null
const FRESH_MS = 30000

function loadRestaurant() {
  if (inflight) return inflight
  if (memory.name && Date.now() - fetchedAt < FRESH_MS) {
    return Promise.resolve({ name: memory.name, status: memory.status })
  }
  inflight = restaurantApi
    .get()
    .then(({ restaurant }) => {
      if (restaurant?.name) rememberLabel(restaurant.name, restaurant.status || '')
      fetchedAt = Date.now()
      return { name: memory.name, status: restaurant?.status || memory.status || '' }
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function useRestaurant({ enabled = true } = {}) {
  const [restaurantName, setRestaurantName] = useState(memory.name)
  const [restaurantStatus, setRestaurantStatus] = useState(memory.status)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let cancelled = false

    loadRestaurant()
      .then((restaurant) => {
        if (cancelled) return
        if (restaurant.name) setRestaurantName(restaurant.name)
        setRestaurantStatus(restaurant.status || '')
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return {
    restaurantName,
    restaurantStatus,
    displayRestaurant: restaurantName.trim() || 'Your restaurant',
    loading,
    error,
  }
}
