/** ISO 3166-1 alpha-2 codes — used when Intl.supportedValuesOf('region') is unavailable. */
const FALLBACK_REGION_CODES = [
  'AF','AL','DZ','AD','AO','AG','AR','AM','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BT',
  'BO','BA','BW','BR','BN','BG','BF','BI','CV','KH','CM','CA','CF','TD','CL','CN','CO','KM','CG','CD',
  'CR','CI','HR','CU','CY','CZ','DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FJ','FI',
  'FR','GA','GM','GE','DE','GH','GR','GD','GT','GN','GW','GY','HT','HN','HU','IS','IN','ID','IR','IQ',
  'IE','IL','IT','JM','JP','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY','LI',
  'LT','LU','MG','MW','MY','MV','ML','MT','MH','MR','MU','MX','FM','MD','MC','MN','ME','MA','MZ','MM',
  'NA','NR','NP','NL','NZ','NI','NE','NG','MK','NO','OM','PK','PW','PS','PA','PG','PY','PE','PH','PL',
  'PT','QA','RO','RU','RW','KN','LC','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SK','SI','SB',
  'SO','ZA','SS','ES','LK','SD','SR','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TO','TT','TN','TR',
  'TM','TV','UG','UA','AE','GB','US','UY','UZ','VU','VA','VE','VN','YE','ZM','ZW',
]

function getRegionCodes() {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
      const regions = Intl.supportedValuesOf('region')
      if (Array.isArray(regions) && regions.length > 50) return regions
    }
  } catch {
    // fall through
  }
  return FALLBACK_REGION_CODES
}

function buildCountryOptions() {
  const display = new Intl.DisplayNames(['en'], { type: 'region' })
  return getRegionCodes()
    .map((code) => {
      try {
        const name = display.of(code)
        if (!name || name === code) return null
        return { code, name }
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const COUNTRY_OPTIONS = buildCountryOptions()

function timezoneOffsetLabel(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date())
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value || ''
    return offset
  } catch {
    return ''
  }
}

function buildTimezoneOptions() {
  let zones = []
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
      zones = Intl.supportedValuesOf('timeZone')
    }
  } catch {
    zones = []
  }

  if (!zones.length) {
    zones = [
      'Africa/Johannesburg',
      'Africa/Lagos',
      'Africa/Nairobi',
      'Africa/Cairo',
      'Africa/Casablanca',
      'Asia/Kolkata',
      'Asia/Dubai',
      'Europe/London',
      'America/New_York',
      'America/Los_Angeles',
    ]
  }

  return zones.map((value) => {
    const offset = timezoneOffsetLabel(value)
    return {
      value,
      label: offset ? `${value} (${offset})` : value,
    }
  })
}

export const TIMEZONE_OPTIONS = buildTimezoneOptions()
