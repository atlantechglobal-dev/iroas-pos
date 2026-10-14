import { useCallback, useEffect, useState } from 'react'

/**
 * Loads a read-only POS resource. `fetcher` must be a stable function (e.g. `api.getPosOrders`).
 * `status` is one of: loading | ready | not_connected | mapping_invalid | error
 * `refreshMs` re-fetches silently (keeps the last data on screen).
 */
export function usePosResource(fetcher, { refreshMs = 0 } = {}) {
  const [state, setState] = useState({ status: 'loading', data: null })

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((prev) => ({ ...prev, status: 'loading' }))
    try {
      const res = await fetcher()
      setState({ status: 'ready', data: res?.data || null })
    } catch (err) {
      const status =
        err?.code === 'pos_not_connected'
          ? 'not_connected'
          : err?.code === 'pos_mapping_invalid'
            ? 'mapping_invalid'
            : 'error'
      setState((prev) => (silent && prev.status === 'ready' ? prev : { status, data: null }))
    }
  }, [fetcher])

  useEffect(() => {
    load()
    if (!refreshMs) return undefined
    const timer = setInterval(() => load({ silent: true }), refreshMs)
    return () => clearInterval(timer)
  }, [load, refreshMs])

  const reload = useCallback(() => load(), [load])
  return { ...state, reload }
}
