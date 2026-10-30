// POS provisioning status per tenant.
//
// A tenant's URY site is created outside the app (ury/provision/provision_tenant.sh)
// and then linked (scripts/ury-link-restaurant.js). This module records the
// admin's request and derives the rest from the real integration row, so the
// status can never disagree with what is actually connected:
//
//   not_requested  no request, no integration
//   requested      admin asked for a site; waiting for the operator to run the script
//   linked         an active, verified integration exists (shown with enabled features)
//   disabled       an integration exists but is switched off

import { db } from '../infra/db.js'
import { isValidSiteName } from '../integrations/ury/uryClient.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS ury_provisioning_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
    site_name TEXT NOT NULL,
    requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

export class ProvisioningError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ProvisioningError'
    this.status = status
  }
}

function integrationRow(restaurantId) {
  return db
    .prepare(`SELECT * FROM restaurant_integrations WHERE restaurant_id = ? AND provider = 'ury'`)
    .get(restaurantId)
}

function requestRow(restaurantId) {
  return db.prepare('SELECT * FROM ury_provisioning_requests WHERE restaurant_id = ?').get(restaurantId)
}

function stateFor(request, integration) {
  if (integration) return integration.status === 'active' && integration.verified_at ? 'linked' : 'disabled'
  return request ? 'requested' : 'not_requested'
}

const STEP_LABELS = [
  ['request', 'Provisioning requested'],
  ['site', 'URY site created'],
  ['link', 'Linked and verified in IROAS'],
  ['features', 'Features switched on'],
]

function steps(state, integration) {
  const features = integration
    ? ['hours', 'contact', 'menu', 'guest_ordering'].filter((f) => integration[`feature_${f}`] === 1)
    : []
  const done = {
    request: state !== 'not_requested',
    site: state === 'linked' || state === 'disabled',
    link: state === 'linked',
    features: state === 'linked' && features.length > 0,
  }
  return { list: STEP_LABELS.map(([key, label]) => ({ key, label, done: done[key] })), features }
}

/** Commands the operator runs. Placeholders only: never secrets. */
function operatorPlan(restaurant, siteName) {
  const site = siteName || '<site-name>'
  return [
    `SITE=${site} ADMIN_PASSWORD=<set> DB_ROOT_PASSWORD=<set> ury/provision/provision_tenant.sh   # add APPLY=1 to execute`,
    `# add URY_CRED_<REF>_API_KEY / _API_SECRET to server/.env`,
    `node scripts/ury-link-restaurant.js link ${restaurant.owner_email || '<owner-email>'} --restaurant "<URY Restaurant>" --branch "<Branch>" --pos-profile "<POS Profile>" --credential-ref <REF> --base-url http://<bench-address> --site-name ${site}`,
    `node scripts/ury-link-restaurant.js features ${restaurant.owner_email || '<owner-email>'} --hours on --contact on --menu on --guest-ordering on`,
  ]
}

export function getProvisioning(restaurantId) {
  const restaurant = db
    .prepare(
      `SELECT r.id, r.name, r.status, u.email AS owner_email
       FROM restaurants r LEFT JOIN users u ON u.id = r.owner_id WHERE r.id = ?`,
    )
    .get(restaurantId)
  if (!restaurant) throw new ProvisioningError(404, 'Tenant not found.')
  const request = requestRow(restaurantId)
  const integration = integrationRow(restaurantId)
  const state = stateFor(request, integration)
  const { list, features } = steps(state, integration)
  return {
    restaurantId,
    state,
    steps: list,
    request: request
      ? { siteName: request.site_name, notes: request.notes || '', requestedAt: request.created_at }
      : null,
    integration: integration
      ? {
          siteName: integration.ury_site_name || '',
          uryRestaurant: integration.external_restaurant,
          branch: integration.ury_branch || '',
          posProfile: integration.ury_pos_profile || '',
          verifiedAt: integration.verified_at || null,
          status: integration.status,
          features,
        }
      : null,
    operatorPlan: operatorPlan(restaurant, request?.site_name || integration?.ury_site_name),
  }
}

export function listProvisioning() {
  const rows = db
    .prepare(
      `SELECT r.id, r.name, r.status FROM restaurants r WHERE r.status != 'deleted' ORDER BY r.id DESC`,
    )
    .all()
  return rows.map((r) => ({
    restaurantId: r.id,
    name: r.name || '',
    tenantStatus: r.status,
    state: stateFor(requestRow(r.id), integrationRow(r.id)),
  }))
}

export function requestProvisioning(restaurantId, { siteName, notes }, userId) {
  const restaurant = db.prepare('SELECT id, status FROM restaurants WHERE id = ?').get(restaurantId)
  if (!restaurant || restaurant.status === 'deleted') throw new ProvisioningError(404, 'Tenant not found.')
  if (restaurant.status !== 'live') {
    throw new ProvisioningError(409, 'Approve the tenant before requesting a POS site.')
  }
  const site = String(siteName || '').trim().toLowerCase()
  if (!isValidSiteName(site)) {
    throw new ProvisioningError(400, 'Site name must be a hostname such as acme.pos.example.com.')
  }
  if (integrationRow(restaurantId)) throw new ProvisioningError(409, 'This tenant is already linked to a POS site.')
  const taken = db
    .prepare('SELECT restaurant_id FROM ury_provisioning_requests WHERE site_name = ? AND restaurant_id != ?')
    .get(site, restaurantId)
  const takenByLink = db
    .prepare(`SELECT restaurant_id FROM restaurant_integrations WHERE provider = 'ury' AND lower(ury_site_name) = ? AND restaurant_id != ?`)
    .get(site, restaurantId)
  if (taken || takenByLink) throw new ProvisioningError(409, 'That site name is already used by another tenant.')

  db.prepare(
    `INSERT INTO ury_provisioning_requests (restaurant_id, site_name, requested_by, notes)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (restaurant_id) DO UPDATE SET site_name = excluded.site_name,
       notes = excluded.notes, requested_by = excluded.requested_by, updated_at = datetime('now')`,
  ).run(restaurantId, site, userId || null, notes ? String(notes).slice(0, 500) : null)
  return getProvisioning(restaurantId)
}

export function cancelProvisioning(restaurantId) {
  if (integrationRow(restaurantId)) {
    throw new ProvisioningError(409, 'A linked POS site cannot be cancelled here; disable the link instead.')
  }
  db.prepare('DELETE FROM ury_provisioning_requests WHERE restaurant_id = ?').run(restaurantId)
  return getProvisioning(restaurantId)
}
