const escapeText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')

/** Folds a vCard line at 75 characters, continuing on lines that start with a space. */
function fold(line) {
  if (line.length <= 75) return line
  const parts = [line.slice(0, 75)]
  for (let i = 75; i < line.length; i += 74) parts.push(` ${line.slice(i, i + 74)}`)
  return parts.join('\r\n')
}

/** Digits only, in international form. A leading 0 is read as South Africa (27). */
export function internationalDigits(phone) {
  let digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = `27${digits.slice(1)}`
  return digits
}

export function telHref(phone) {
  const digits = String(phone ?? '').replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : ''
}

export function whatsappHref(phone, text = '') {
  const digits = internationalDigits(phone)
  if (digits.length < 8) return ''
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function mapsHref(address) {
  const query = String(address ?? '').trim()
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : ''
}

/** vCard 3.0 contact for the restaurant (CRLF lines, escaped values, N and FN present). */
export function buildVCard({ name, tagline, phone, email, website, pageUrl, street, city, country }) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeText(name)};;;;`,
    `FN:${escapeText(name)}`,
    `ORG:${escapeText(name)}`,
    phone ? `TEL;TYPE=WORK,VOICE:${String(phone).replace(/[^\d+]/g, '')}` : '',
    email ? `EMAIL;TYPE=INTERNET,WORK:${escapeText(email)}` : '',
    website ? `URL:${String(website).replace(/\s/g, '')}` : '',
    pageUrl ? `URL:${String(pageUrl).replace(/\s/g, '')}` : '',
    street || city || country ? `ADR;TYPE=WORK:;;${escapeText(street)};${escapeText(city)};;;${escapeText(country)}` : '',
    tagline ? `NOTE:${escapeText(tagline)}` : '',
    'END:VCARD',
  ].filter(Boolean)
  return `${lines.map(fold).join('\r\n')}\r\n`
}

export function downloadVCard(vcard, filename) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([vcard], { type: 'text/vcard;charset=utf-8' }))
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
