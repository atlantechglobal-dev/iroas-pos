import { useEffect, useState } from 'react'
import { restaurantApi } from '../services/api/restaurantApi.js'

export function useRestaurant({ enabled = true } = {}) {
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantStatus, setRestaurantStatus] = useState('')
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let cancelled = false

    restaurantApi
      .get()
      .then(({ restaurant }) => {
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
