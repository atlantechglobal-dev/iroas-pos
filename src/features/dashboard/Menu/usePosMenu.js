import { useCallback, useEffect, useState } from 'react'
import { api } from '@/shared/lib/api'

/**
 * Loads the POS menu. `status` is one of:
 * loading | ready | not_connected | mapping_invalid | error
 */
export function usePosMenu() {
  const [state, setState] = useState({ status: 'loading', data: null })

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((prev) => ({ ...prev, status: 'loading' }))
    try {
      const res = await api.getPosMenu()
      setState({ status: 'ready', data: res?.data || null })
    } catch (err) {
      if (silent) return
      const status =
        err?.code === 'pos_not_connected'
          ? 'not_connected'
          : err?.code === 'pos_mapping_invalid'
            ? 'mapping_invalid'
            : 'error'
      setState({ status, data: null })
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => load({ silent: true }), 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const replaceData = useCallback((data) => setState({ status: 'ready', data }), [])

  return { ...state, reload: load, replaceData }
}
