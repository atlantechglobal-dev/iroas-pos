# URY (Frappe/ERPNext) side of IROAS

IROAS runs **one** app (this repo: React + Express + SQLite) for the platform
admin and every customer panel. Each customer's restaurant operations live in
**their own URY site** (a Frappe site = its own database) on a shared bench.

```
IROAS app  ──mapping row (base_url, site_name, credential_ref)──►  URY site per customer
```

The IROAS owner panel is the only UI customers use; they never open URY desk.

## What is deployed (verified 2026-10-30)

| Item | Value |
|---|---|
| OS | Ubuntu 22.04 (GCP VM, 8 GB RAM) |
| Bench | `/home/frappe/frappe-bench`, supervisor-managed |
| Apps | frappe 16.51, erpnext 16.50, hrms 16.50, ury 3.0.0-beta.1 (`version-16`, commit `1cb38f4`) |
| `ury` source | upstream `ury-erp/ury` + the local patch in `patches/` |
| Site (demo) | one site, reached over plain HTTP by IP. TLS + domain come with M5 |
| Backups | bench auto-backup, DB every 6 hours |

## Local patch to URY

`patches/0001-ury-3.0.0-beta1-hooks.patch` makes URY 3.0.0-beta.1 start:

1. fixes the `POS Invoice Merge Log` class-override path;
2. disables the two POS-closing stock-correction hooks, whose functions do not exist in this beta.

Apply it on the bench before installing `ury` on any new site:

```bash
cd ~/frappe-bench/apps/ury && git apply ../../../path/to/0001-ury-3.0.0-beta1-hooks.patch
```

## Adding a customer

`provision/provision_tenant.sh` (dry run by default; **not yet run on a fresh
site**, first real run is the M5 clean install):

1. `bench new-site` (own database)
2. install erpnext, hrms, ury
3. nginx server block for the site
4. golden template (ZAR, VAT 15%, payment modes, rooms/tables, POS and
   self-ordering profiles, integration user + API key): **still to be built**
   as a custom app (`iroas_ury_ext`)
5. link in IROAS: `node scripts/ury-link-restaurant.js link ... --base-url ... --site-name ...`

IROAS reaches a site on a multi-site bench by sending the site name as the
`Host` header (`server/src/integrations/ury/uryClient.js`), so it works against
a bench address with or without DNS.

## Known gaps (not yet built)

- table-reservation module is missing in URY v16; IROAS keeps its own
- no idempotency key on order submission (IROAS keeps its own submission id)
- guest name/phone cannot be attached to self-orders
- see `docs/URY_API_STATUS.md` for the full list

## Secrets

Never commit `server/.env`, API keys, DB files, or Frappe `site_config.json`.
Per-tenant URY credentials live in `server/.env` as `URY_CRED_<REF>_*`.
