# IROAS POS

Restaurant onboarding + operations platform for IROAS. React (Vite) frontend with a Node/Express + SQLite backend.

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | React 19, Vite 8, React Router 7 |
| Backend | Express 4, SQLite (`better-sqlite3`), JWT |
| Auth | Bearer tokens in localStorage, role-based routes |

## Features

- Owner signup → onboarding wizard → go-live → operations dashboard
- Platform admin console (tenants, stats)
- Password reset flow (token returned in API for demo/testing)
- Protected routes with admin-only access

## Project structure

```
iroas-pos/
├── src/
│   ├── app/                 # App shell, providers, routes
│   ├── components/          # Shared UI (layout, feedback)
│   ├── config/              # Environment config
│   ├── constants/           # Routes, roles, messages
│   ├── context/             # Auth provider
│   ├── hooks/               # useAuth, useRestaurant, useDebounce
│   ├── lib/                 # Back-compat re-exports (api, navGroups)
│   ├── pages/               # Route pages (UI preserved per screen)
│   ├── services/            # API client + auth storage
│   └── utils/               # Validation, helpers
├── public/images/
├── server/                  # Express API + SQLite
│   ├── src/
│   └── data/iroas.db
├── .env.example             # Frontend env template
└── DEPLOY.md
```

## Installation

### Backend

```bash
cd server
cp .env.example .env
npm install
npm run seed
npm run dev    # http://localhost:4000
```

### Frontend

```bash
cp .env.example .env
npm install
npm run dev    # http://localhost:5173
```

## Environment variables

### Frontend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `/api` | API base path |
| `VITE_APP_DOMAIN` | `iroas.com` | Brand domain suffix |
| `VITE_DEV_API_PROXY` | `http://localhost:4000` | Vite dev proxy target |

### Backend (`server/.env`)

See `server/.env.example` — **JWT_SECRET is required**.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | Run oxlint |

## Authentication

1. Login → JWT stored in localStorage (`iroas_token`, `iroas_user`)
2. Session validated via `GET /api/auth/me` on app load
3. `401` responses clear session and redirect to login
4. Admin routes require `role === 'admin'` (frontend + backend)

### Demo accounts

**Platform Admin:** `admin@iroas.com` / `IroasAdmin@123`

**Owners** (password `Demo@1234`):

- `ananya@saffronandfig.in` — live
- `rohit@baorepublic.in` — live
- `priya@coastandco.in` — onboarding

## Production build

```bash
npm run build
```

With `NODE_ENV=production`, Express serves `dist/` alongside the API. See `DEPLOY.md`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `'vite' is not recognized` | Run `npm install` in project root |
| API `ECONNREFUSED` on login | Start backend: `cd server && npm run dev` |
| JWT error on server start | Set `JWT_SECRET` in `server/.env` |

## Architecture notes

- **DashboardLayout** — shared sidebar/topbar for dashboard pages (migration in progress)
- **services/api** — centralized fetch client with 401 handling
- **Lazy-loaded routes** — code-splitting per page
- **ToastProvider** — replaces browser `alert()` for user feedback (migration in progress)
