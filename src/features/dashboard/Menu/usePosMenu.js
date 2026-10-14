import { useCallback, useEffect, useState } from 'react'
import { api } from '@/shared/lib/api'

/**
 * Loads the read-only POS menu. `status` is one of:
 * loading | ready | not_connected | mapping_invalid | error
 */
export function usePosMenu() {
  const [state, setState] = useState({ status: 'loading', data: null })

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading' }))
    try {
      const res = await api.getPosMenu()
      setState({ status: 'ready', data: res?.data || null })
    } catch (err) {
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
  }, [load])

  return { ...state, reload: load }
}
