export const DEFAULT_ACCENT = '#8bc53f'

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const bigint = parseInt(full, 16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}

function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  )
}

function mix(hex, target, amount) {
  const c = hexToRgb(hex)
  const t = hexToRgb(target)
  return rgbToHex(
    c.r + (t.r - c.r) * amount,
    c.g + (t.g - c.g) * amount,
    c.b + (t.b - c.b) * amount,
  )
}

// From one chosen accent color, derive the four shades every dashboard page's
// CSS expects: the base color, a darker hover state, a pale background tint,
// and a readable text color for use on that pale tint.
export function deriveAccentShades(hex) {
  const base = /^#[0-9a-fA-F]{3,6}$/.test(hex || '') ? hex : DEFAULT_ACCENT
  return {
    '--green': base,
    '--green-dark': mix(base, '#000000', 0.22),
    '--green-soft': mix(base, '#ffffff', 0.82),
    '--green-text': mix(base, '#000000', 0.45),
  }
}
