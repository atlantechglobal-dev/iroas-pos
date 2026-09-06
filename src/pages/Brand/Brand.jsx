import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import BrandWizard from './BrandWizard.jsx'
import BrandStudio from './BrandStudio.jsx'

/**
 * /brand serves two connected experiences:
 * - Onboarding / register flow → BrandWizard (setup chrome)
 * - Live restaurant (dashboard Branding nav) → BrandStudio
 */
function Brand() {
  const [mode, setMode] = useState('loading') // loading | wizard | studio

  useEffect(() => {
    let cancelled = false
    api
      .getRestaurant()
      .then(({ restaurant }) => {
        if (cancelled) return
        setMode(restaurant?.status === 'live' ? 'studio' : 'wizard')
      })
      .catch(() => {
        if (!cancelled) setMode('wizard')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (mode === 'loading') {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        Loading…
      </div>
    )
  }

  return mode === 'studio' ? <BrandStudio /> : <BrandWizard />
}

export default Brand
