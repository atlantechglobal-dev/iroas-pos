import { CALLING_CODES } from '../constants/callingCodes.js'

const FALLBACK_COUNTRY_ISO = 'IN'

// Time zones do not always identify one country, so only use unambiguous zones.
const TIME_ZONE_COUNTRIES = {
  'Asia/Kolkata': 'IN',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Rome': 'IT',
  'Europe/Madrid': 'ES',
  'Europe/Stockholm': 'SE',
  'Europe/Zurich': 'CH',
  'Australia/Sydney': 'AU',
  'Asia/Singapore': 'SG',
  'Asia/Tokyo': 'JP',
}

function isSupportedCountry(iso) {
  return CALLING_CODES.some((country) => country.iso === iso)
}

/**
 * Selects a sensible initial calling code without requesting location permission
 * or sending the visitor's data to a third party. The user can always change it.
 */
export function getDefaultCountryIso() {
  if (typeof navigator === 'undefined') return FALLBACK_COUNTRY_ISO

  const locales = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const locale of locales) {
    try {
      const region = new Intl.Locale(locale).region?.toUpperCase()
      if (region && isSupportedCountry(region)) return region
    } catch {
      // Ignore malformed browser locale values and try the next signal.
    }
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const countryFromTimeZone = TIME_ZONE_COUNTRIES[timeZone]
  return countryFromTimeZone && isSupportedCountry(countryFromTimeZone)
    ? countryFromTimeZone
    : FALLBACK_COUNTRY_ISO
}
