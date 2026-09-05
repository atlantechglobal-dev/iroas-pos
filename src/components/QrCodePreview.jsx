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
 */
export function QrCodePreview({
  value,
  size = 160,
  alt = 'QR code',
  className = '',
  emptyMessage = 'Set your web address to preview the QR code.',
  style,
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
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', width: size, height: size, ...style }}
    />
  )
}
