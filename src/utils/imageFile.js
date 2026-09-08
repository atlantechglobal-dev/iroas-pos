const MAX_BYTES = 2 * 1024 * 1024
const MAX_DIMENSION = 512
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
])

const ALLOWED_EXTENSIONS = /\.(png|jpe?g|svg)$/i

function isAllowedFile(file) {
  if (ALLOWED_TYPES.has(file.type)) return true
  return ALLOWED_EXTENSIONS.test(file.name || '')
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image. Try another file.'))
    img.src = dataUrl
  })
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read that image. Try another file.'))
    reader.readAsDataURL(file)
  })
}

async function resizeRaster(dataUrl, mimeType, maxDimension = MAX_DIMENSION) {
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl

  ctx.drawImage(img, 0, 0, width, height)

  const outputType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg'
  const quality = outputType === 'image/jpeg' ? 0.85 : undefined
  return canvas.toDataURL(outputType, quality)
}

/**
 * Validate and prepare an image file for JSON storage as a data URL.
 * Rejects oversize / wrong type; resizes rasters so the payload stays under the API body limit.
 * @returns {Promise<{ dataUrl: string } | { error: string }>}
 */
export async function prepareImageDataUrl(
  file,
  { maxBytes = MAX_BYTES, maxDimension = MAX_DIMENSION } = {},
) {
  if (!file) return { error: 'No file selected.' }

  if (!isAllowedFile(file)) {
    return { error: 'Please upload a PNG, JPG, or SVG file.' }
  }

  if (file.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0)
    return { error: `Image must be ${mb} MB or smaller.` }
  }

  try {
    const raw = await readAsDataUrl(file)
    const isSvg =
      file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '')

    if (isSvg) {
      return { dataUrl: raw }
    }

    const dataUrl = await resizeRaster(raw, file.type || 'image/jpeg', maxDimension)
    return { dataUrl }
  } catch (err) {
    return { error: err.message || 'Could not process that image.' }
  }
}
