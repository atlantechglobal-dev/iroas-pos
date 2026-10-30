// Pushes hours and contact from the owner's profile to their URY site when the
// matching feature switch is on. Never throws: each part reports
// synced | unchanged | skipped | failed.

import { UryError } from './uryClient.js'
import { IntegrationError, resolveUryTenant } from './uryTenant.js'
import { getUryFeatures } from './uryPublic.js'
import { PosEditError } from './uryEdit.js'
import { pushUryHours } from './uryHours.js'
import { pushUryContact } from './uryContact.js'

const BUDGET_MS = 8000

function describe(err, what) {
  if (err instanceof PosEditError) return { status: err.code === 'incomplete_address' ? 'skipped' : 'failed', message: err.message }
  if (err instanceof IntegrationError) return { status: 'failed', message: 'Your POS connection needs to be checked.' }
  if (err instanceof UryError) return { status: 'failed', message: `The POS could not be reached, so ${what} was not updated there.` }
  console.error('[pos-sync]', err)
  return { status: 'failed', message: `${what} could not be updated in the POS.` }
}

async function run(what, fn) {
  try {
    const { changed } = await fn()
    return { status: changed ? 'synced' : 'unchanged' }
  } catch (err) {
    return describe(err, what)
  }
}

function withBudget(promise) {
  let timer
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve({ timedOut: true }), BUDGET_MS)
    }),
  ]).finally(() => clearTimeout(timer))
}

export async function syncProfileToPos(restaurantId, profile = {}) {
  const features = getUryFeatures(restaurantId)
  if (!features || (!features.hours && !features.contact)) return null

  const result = await withBudget(
    (async () => {
      let tenant
      try {
        tenant = await resolveUryTenant(restaurantId)
      } catch (err) {
        const failed = describe(err, 'your details')
        return {
          ...(features.hours ? { hours: failed } : {}),
          ...(features.contact ? { contact: failed } : {}),
        }
      }
      const out = {}
      if (features.hours && Array.isArray(profile.hours)) {
        out.hours = await run('your opening hours', () => pushUryHours(tenant, { hours: profile.hours, timezone: profile.timezone }))
      }
      if (features.contact) {
        out.contact = await run('your contact details', () =>
          pushUryContact(tenant, {
            phone: profile.phone,
            email: profile.email,
            address: profile.address,
            city: profile.city,
            country: profile.country,
          }),
        )
      }
      return out
    })(),
  )

  if (result.timedOut) {
    const failed = { status: 'failed', message: 'The POS took too long to respond. Save again to retry.' }
    return { ...(features.hours ? { hours: failed } : {}), ...(features.contact ? { contact: failed } : {}) }
  }
  return result
}
