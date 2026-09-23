import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

function loadGoogleScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.google?.accounts?.id) return Promise.resolve()
  const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')))
      if (window.google?.accounts?.id) resolve()
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'))
    document.head.appendChild(script)
  })
}

/**
 * Loads Google Identity Services, fetches the platform's Client ID, and
 * renders the official button into a hidden host div — `trigger()` clicks
 * that real button so a custom-styled button can drive the same flow.
 */
export function useGoogleSignIn(onIdToken, { text = 'signin_with' } = {}) {
  const gisHostRef = useRef(null)
  const [googleConfig, setGoogleConfig] = useState({ enabled: false, clientId: '' })
  const [gisReady, setGisReady] = useState(false)

  const handleCredential = useCallback(
    (response) => {
      const idToken = response?.credential
      if (idToken) onIdToken(idToken)
    },
    [onIdToken],
  )

  useEffect(() => {
    let cancelled = false
    api
      .googleConfig()
      .then(async (cfg) => {
        if (cancelled) return
        const next = {
          enabled: Boolean(cfg.configured || (cfg.enabled && cfg.clientId)),
          clientId: cfg.clientId || '',
        }
        setGoogleConfig(next)
        if (!next.enabled) return
        await loadGoogleScript()
        if (cancelled || !window.google?.accounts?.id) return
        window.google.accounts.id.initialize({
          client_id: next.clientId,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        if (gisHostRef.current) {
          gisHostRef.current.innerHTML = ''
          window.google.accounts.id.renderButton(gisHostRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text,
            shape: 'pill',
            width: 280,
          })
        }
        setGisReady(true)
      })
      .catch(() => {
        if (!cancelled) setGoogleConfig({ enabled: false, clientId: '' })
      })
    return () => {
      cancelled = true
    }
  }, [handleCredential, text])

  const trigger = useCallback(
    (notify) => {
      if (!googleConfig.enabled) {
        notify?.('Google sign-in is not configured. Ask an admin to add the Client ID.')
        return
      }
      if (!gisReady) {
        notify?.('Google Sign-In is still loading. Try again in a moment.')
        return
      }
      const btn = gisHostRef.current?.querySelector('div[role="button"]')
      if (btn) {
        btn.click()
        return
      }
      window.google?.accounts?.id?.prompt()
    },
    [googleConfig.enabled, gisReady],
  )

  return { gisHostRef, googleConfig, gisReady, trigger }
}
