import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * Generate a PNG data URL for a QR code (client-side, no CDN).
 */
export async function qrDataUrl(value, { width = 300, margin = 2 } = {}) {
  if (!value) return ''
  const toDataURL = QRCode?.toDataURL || QRCode?.default?.toDataURL
  if (typeof toDataURL !== 'function') {
    throw new Error('QR library unavailable')
  }
  return toDataURL.call(QRCode.default || QRCode, String(value), {
    width,
    margin,
    errorCorrectionLevel: 'M',
    color: { dark: '#17171a', light: '#ffffff' },
  })
}

export async function downloadQrPng(value, filename = 'qr-code.png', options) {
  const dataUrl = await qrDataUrl(value, options)
  if (!dataUrl) return false
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  return true
}

/**
 * Renders a client-generated QR image for `value`.
 * Shows emptyMessage when value is missing.
 * When `blurred`, the code is visually obscured until unlocked (e.g. after admin approval).
 */
export function QrCodePreview({
  value,
  size = 160,
  alt = 'QR code',
  className = '',
  emptyMessage = 'Set your web address to preview the QR code.',
  style,
  blurred = false,
  blurMessage = 'Unlocks after approval',
}) {
  const [src, setSrc] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    if (!value) {
      setSrc('')
      setError('')
      return
    }

    qrDataUrl(value, { width: Math.max(size, 128) })
      .then((dataUrl) => {
        if (!cancelled) {
          setSrc(dataUrl)
          setError('')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc('')
          setError('Unable to generate QR code.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!value) {
    return (
      <div
        className={`qr-preview-empty ${className}`.trim()}
        style={{
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          padding: 8,
          fontSize: 12,
          color: '#8b8b8f',
          background: '#f4f4f5',
          borderRadius: 8,
          ...style,
        }}
      >
        {emptyMessage}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`qr-preview-empty ${className}`.trim()}
        style={{ width: size, height: size, ...style }}
      >
        {error}
      </div>
    )
  }

  if (!src) {
    return (
      <div
        className={`qr-preview-loading ${className}`.trim()}
        style={{
          width: size,
          height: size,
          background: '#f4f4f5',
          borderRadius: 8,
          ...style,
        }}
        aria-busy="true"
      />
    )
  }

  return (
    <div
      className={`qr-preview-wrap${blurred ? ' is-blurred' : ''} ${className}`.trim()}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: 8,
        overflow: 'hidden',
        ...style,
      }}
    >
      <img
        src={src}
        alt={blurred ? `${alt} (locked until approval)` : alt}
        width={size}
        height={size}
        style={{
          display: 'block',
          width: size,
          height: size,
          filter: blurred ? 'blur(7px)' : undefined,
          transform: blurred ? 'scale(1.08)' : undefined,
          userSelect: 'none',
          pointerEvents: blurred ? 'none' : undefined,
        }}
        draggable={!blurred}
      />
      {blurred ? (
        <div
          className="qr-preview-lock"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: 10,
            textAlign: 'center',
            background: 'rgba(255,255,255,0.42)',
            fontSize: Math.max(10, Math.round(size * 0.075)),
            fontWeight: 700,
            lineHeight: 1.25,
            color: '#3f3f46',
            letterSpacing: '0.01em',
          }}
          aria-hidden="true"
        >
          {blurMessage}
        </div>
      ) : null}
    </div>
  )
}
