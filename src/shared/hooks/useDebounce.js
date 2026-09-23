import { useEffect, useState } from 'react'

export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handle)
  }, [value, delay])

  return debouncedValue
}
