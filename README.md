# IROAS POS

Restaurant onboarding and operations platform for IROAS (South Africa and
neighbouring countries). One IROAS app serves the platform admin console, every
restaurant's owner panel and every restaurant's branded guest website. Each
restaurant's POS runs in its own URY (Frappe/ERPNext) site, managed from the
IROAS owner panel, so restaurant owners never open URY directly.

```
IROAS app (this repo)  ──►  URY site per restaurant (own database)
React + Express + SQLite     Frappe v16 + ERPNext + URY
```

See [docs/architecture/multi-tenant-ury.md](docs/architecture/multi-tenant-ury.md).

## Who uses what

| Who | Uses | Never needs |
|---|---|---|
| IROAS (client) admin | Platform admin console: approve tenants, plans, flags, audit | URY |
| Restaurant owner | Owner panel: menu, tables, staff, orders, reservations, branding | URY desk |
| Restaurant guests | Branded website: menu, QR ordering, booking, One Link, business card | none |

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite 8, React Router 7 |
| Backend | Express 4, SQLite (`better-sqlite3`), JWT |
| POS / operations | URY on Frappe/ERPNext v16 (see `ury/`) |

## Repository layout

```
iroas-pos/
├── src/                      # Frontend (Vite + React)
│   ├── app/                  #   shell, providers, route table
│   ├── features/
│   │   ├── auth/             #   login, signup, password recovery
│   │   ├── onboarding/       #   setup wizard, launch, onboarding payment
│   │   ├── dashboard/        #   restaurant owner panel
│   │   ├── platform-admin/   #   IROAS admin console
│   │   ├── guest/            #   public restaurant site, card, One Link
│   │   └── system/           #   404 / 403
│   └── shared/               #   api clients, ui, hooks, utils, constants
├── public/                   # Static assets
├── server/                   # Backend (Express + SQLite)
│   ├── src/
│   │   ├── modules/          #   routes per domain (auth, tenants, admin, public, ...)
│   │   ├── services/         #   business services (orders, reservations, messaging, ...)
│   │   ├── integrations/ury/ #   URY client + per-feature modules
│   │   ├── middleware/       #   auth, rate limit, security headers, errors
│   │   └── infra/db.js       #   SQLite schema + migrations
│   ├── scripts/              #   operator scripts (link a restaurant to its URY site, ...)
│   └── test/                 #   node:test suites
├── ury/                      # URY side: deployed versions, patches, provisioning
│   ├── patches/              #   local patch to URY 3.0.0-beta.1
│   └── provision/            #   provision_tenant.sh, seed_branch_profile.py
└── docs/
    ├── architecture/         #   multi-tenant model, app structure, deploy guide
    └── ury/                  #   URY API discovery, reference, status, gap analysis
```

## Run locally

```bash
# backend
cd server && cp .env.example .env     # set JWT_SECRET and ADMIN_PASSWORD
npm install && npm run seed && npm run dev      # http://localhost:4000

# frontend (repo root)
cp .env.example .env
npm install && npm run dev                      # http://localhost:5173
```

`npm run seed` creates the platform admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`; a
random password is printed if none is set) and sample tenants.

## Scripts

| Command | Where | Description |
|---|---|---|
| `npm run dev` | root | Vite dev server |
| `npm run build` | root | Production build to `dist/` |
| `npm run lint` | root | oxlint |
| `npm test` | `server/` | Backend tests (URY isolation, multi-site, demo journey) |

## Environment variables

- Frontend (`.env`): `VITE_API_BASE_URL`, `VITE_APP_DOMAIN`, `VITE_DEV_API_PROXY`,
  `VITE_CURRENCY_SYMBOL` (default `R`).
- Backend (`server/.env`): see `server/.env.example`. `JWT_SECRET` is required.
  Per-restaurant URY credentials are `URY_CRED_<REF>_API_KEY` / `_API_SECRET`.

Never commit `.env` files, API keys, SQLite files or Frappe `site_config.json`.

## Connecting a restaurant to its URY site

```bash
cd server
node scripts/ury-link-restaurant.js link <owner-email> \
  --restaurant "<URY Restaurant>" --branch "<Branch>" --pos-profile "<POS Profile>" \
  --credential-ref <REF> --base-url http://<bench-address> --site-name <frappe-site>
```

Full onboarding steps: [ury/README.md](ury/README.md) and
[docs/ury/URY_API_STATUS.md](docs/ury/URY_API_STATUS.md).

## Production

`NODE_ENV=production` makes Express serve `dist/` with the API. Deploy guide:
[docs/architecture/deploy.md](docs/architecture/deploy.md).

## Documentation

[docs/README.md](docs/README.md)
