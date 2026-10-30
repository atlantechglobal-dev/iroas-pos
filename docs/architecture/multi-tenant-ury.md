# Multi-tenant model: one IROAS app, one URY site per restaurant

Status: agreed design (Oct 2026). The code path for per-tenant URY sites is
built and tested against a fake bench; the first real second site is created
after client approval (see "Rollout").

## Goal

Every time IROAS onboards a restaurant, that restaurant gets a fresh, isolated
operational setup (its own POS, tables, menu, staff, invoices) with only its
branding and data different. The IROAS admin and owner panels are the only
places people work; URY desk is never used by IROAS staff or restaurant owners.

## Components

```
                         ┌───────────────────────────────┐
 IROAS admin  ─────────► │                               │
 Restaurant owner ─────► │  IROAS app (React + Express)  │──► SQLite (tenants, mappings, local data)
 Restaurant guests ────► │                               │
                         └───────────────┬───────────────┘
                                         │ per-tenant mapping:
                                         │ ury_base_url + ury_site_name + credential_ref
                  ┌──────────────────────┼──────────────────────┐
                  ▼                      ▼                      ▼
            URY site A             URY site B             URY site C
         (own database)         (own database)         (own database)
```

- **One IROAS app and database** for all tenants. Tenant data is scoped by
  `restaurant_id`; the tenant always comes from the authenticated owner's JWT,
  never from a request parameter.
- **One URY (Frappe) site per restaurant**, all on a shared bench. A Frappe site
  has its own database, so isolation of POS data is by construction.
- **The mapping** lives in `restaurant_integrations`:
  `external_restaurant`, `ury_branch`, `ury_pos_profile`,
  `ury_self_ordering_profile`, `credential_ref`, `ury_base_url`, `ury_site_name`.
- **Secrets** are never in the database. `credential_ref` names environment
  variables `URY_CRED_<REF>_API_KEY` / `_API_SECRET` in `server/.env`.

## How a request reaches the right site

1. Owner calls `/api/restaurant/...` with a JWT. The restaurant id is taken from
   the JWT, not from the request.
2. `resolveUryTenant(restaurantId)` loads the mapping row, builds a client for
   `ury_base_url` + `ury_site_name` with that tenant's own credential, and
   verifies on every cache expiry that the URY restaurant, branch, POS profile
   and integration user match the mapping.
3. The client connects to the bench address and sends the site name as the
   `Host` header (a multi-site bench routes by `server_name`), so it works with
   or without DNS per site.
4. Mismatch gives `409 pos_mapping_invalid`; no mapping gives `409 pos_not_connected`.

Without `ury_base_url` / `ury_site_name` (single-site demo) the global
`URY_BASE_URL` is used, so existing setups keep working.

## Isolation rules (tested)

- A tenant's client authenticates as that tenant's own integration user, never
  `Administrator`, and a URY user may belong to only one tenant on a site.
- A restaurant or user name is only unique within one URY site.
- Responses are checked against the mapped restaurant and branch.
- Tests: `server/test/uryTenantIsolation.test.js`, `uryMultiSite.test.js`.

## Adding a restaurant

1. Approve the tenant in the IROAS admin console.
2. Create its URY site: `ury/provision/provision_tenant.sh` (dry run by default).
3. Put its credential in `server/.env` as `URY_CRED_<REF>_*`.
4. Link: `node scripts/ury-link-restaurant.js link ... --base-url ... --site-name ...`.
5. Turn on features: `node scripts/ury-link-restaurant.js features <owner> --menu on ...`.

Steps 2 to 5 are scripted today; the admin console button that runs them is an
M1/M3 task. The "golden template" applied to every new site (ZAR, VAT 15%,
payment modes, tables, POS and self-ordering profiles, integration user) is
built as a Frappe app in M5.

## Rollout

The current environment is a test environment on one URY site. After client
approval of M1 to M5 the code is finalised on GitHub, test data and the test
URY site are removed, and every new customer's site is created from this repo.

## Known limits

- IROAS keeps its own reservations (URY v16 has no reservation module).
- Guest name and phone cannot be attached to URY self-orders yet.
- No idempotency key on URY order submission; IROAS uses its own submission id.
- SQLite is sufficient for the pilot (5 to 10 restaurants). Revisit PostgreSQL
  if the IROAS app is scaled to many tenants or several app servers.
