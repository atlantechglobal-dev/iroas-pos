# Architecture

IROAS POS is a Vite + React client with an Express + SQLite API.

## Frontend (`src/`)

```text
src/
  app/                 # bootstrap, providers, route table
  features/
    auth/              # login, signup, password recovery, thanks
    onboarding/        # setup wizard, launch, payment
    dashboard/         # live tenant product surfaces
    platform-admin/    # platform operator console
    guest/             # public guest site / card / one-link
    system/            # 404 / 403
  shared/
    api/               # HTTP clients
    storage/           # session persistence
    ui/                # layout, feedback, shared widgets
    hooks/
    constants/
    utils/
    lib/               # nav + prefetch helpers
    context/           # AuthProvider
  styles/
  main.jsx
```

Use the `@/` alias (configured in `vite.config.js`) for imports.

## Backend (`server/src/`)

```text
server/src/
  index.js             # process boot
  app.js               # Express app factory
  config/              # env + CORS
  middleware/          # auth, rate limit, security headers, errors
  modules/             # domain route modules (auth, tenants, admin, …)
  services/            # business/services used by modules
  infra/db.js          # SQLite
  shared/validation.js
```

Public API prefixes are unchanged (`/api/auth`, `/api/restaurant`, `/api/admin`, …).
