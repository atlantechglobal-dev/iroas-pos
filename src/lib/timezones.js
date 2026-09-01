// Full IANA timezone list, pulled from the browser's own tz database when
// available (Intl.supportedValuesOf), so it always covers every working
// timezone with zero maintenance. Falls back to a hand-picked list spanning
// every continent (including Africa) for older browsers that lack the API.
const FALLBACK_ZONES = [
  'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers',
  'Africa/Cairo', 'Africa/Casablanca', 'Africa/Dakar', 'Africa/Dar_es_Salaam',
  'Africa/Johannesburg', 'Africa/Kampala', 'Africa/Khartoum', 'Africa/Kigali',
  'Africa/Lagos', 'Africa/Luanda', 'Africa/Maputo', 'Africa/Nairobi',
  'Africa/Tunis', 'Africa/Windhoek',
  'America/Anchorage', 'America/Argentina/Buenos_Aires', 'America/Bogota',
  'America/Chicago', 'America/Denver', 'America/Lima', 'America/Los_Angeles',
  'America/Mexico_City', 'America/New_York', 'America/Santiago',
  'America/Sao_Paulo', 'America/Toronto', 'America/Vancouver',
  'Asia/Baghdad', 'Asia/Bangkok', 'Asia/Dhaka', 'Asia/Dubai', 'Asia/Hong_Kong',
  'Asia/Jakarta', 'Asia/Jerusalem', 'Asia/Kabul', 'Asia/Karachi',
  'Asia/Kolkata', 'Asia/Kuala_Lumpur', 'Asia/Kuwait', 'Asia/Manila',
  'Asia/Riyadh', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore',
  'Asia/Tehran', 'Asia/Tokyo', 'Asia/Yangon',
  'Atlantic/Reykjavik', 'Atlantic/Cape_Verde',
  'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam', 'Europe/Athens', 'Europe/Berlin', 'Europe/Dublin',
  'Europe/Istanbul', 'Europe/Lisbon', 'Europe/London', 'Europe/Madrid',
  'Europe/Moscow', 'Europe/Paris', 'Europe/Rome', 'Europe/Warsaw',
  'Europe/Zurich',
  'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Honolulu',
  'UTC',
]

function getZoneList() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      const zones = Intl.supportedValuesOf('timeZone')
      if (zones && zones.length) return zones
    }
  } catch {
    // fall through to the fallback list
  }
  return FALLBACK_ZONES
}

function offsetLabel(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date())
    return parts.find((p) => p.type === 'timeZoneName')?.value || ''
  } catch {
    return ''
  }
}

export const TIMEZONES = getZoneList()
  .map((tz) => ({
    value: tz,
    label: `${tz.replace(/_/g, ' ')}${offsetLabel(tz) ? ` (${offsetLabel(tz)})` : ''}`,
  }))
  .sort((a, b) => a.value.localeCompare(b.value))
