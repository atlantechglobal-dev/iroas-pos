# IROAS POS

Restaurant onboarding + operations platform for IROAS. React (Vite) frontend
with a Node/Express + SQLite backend, covering the full customer journey:
sign up → restaurant setup wizard (profile → domain → brand → launch) →
go-live → operations dashboard, plus a separate Platform Admin console.

## Project structure

```
iroas-pos/
├── src/                # React frontend (Vite)
├── public/images/      # Static assets
├── server/             # Express + SQLite backend
│   ├── src/
│   │   ├── db.js        # SQLite schema + connection
│   │   ├── seed.js      # Creates admin + sample tenants
│   │   ├── middleware/   # JWT auth
│   │   └── routes/       # auth, restaurant, admin APIs
│   └── data/iroas.db     # SQLite file (gitignored, created on first run)
└── DEPLOY.md            # Droplet deployment runbook
```

## Local development

**1. Backend**

```bash
cd server
cp .env.example .env      # edit JWT_SECRET / admin credentials if you want
npm install
npm run seed               # creates the admin account + 3 sample tenants
npm run dev                 # http://localhost:4000
```

**2. Frontend** (separate terminal, from the project root)

```bash
npm install
npm run dev                 # http://localhost:5173, proxies /api to :4000
```

## Logging in

**Platform Admin** (operator dashboard — tenant list, feature flags, system health):

```
URL:      /login
Email:    admin@iroas.com
Password: IroasAdmin@123
```

(Change these before a real deployment — see `server/.env.example`.)

**Restaurant owner** — sign up fresh via `/create-account`, or use one of the
seeded demo tenants (password `Demo@1234` for all three):

```
ananya@saffronandfig.in   (Saffron & Fig — already live)
rohit@baorepublic.in      (Bao Republic — already live)
priya@coastandco.in       (Coast & Co. — still onboarding)
```

## The journey this wires up

1. `/create-account` → `/api/auth/signup` creates the owner + a blank restaurant row, returns a session
2. `/login` → `/api/auth/login`, routes admins to `/platform-admin` and owners to `/restaurant-setup`
3. `/forgot-password` → `/new-password` → real token-based reset (`/api/auth/forgot-password`, `/api/auth/reset-password`). No email provider is wired up — the reset token is returned directly in the API response so the flow is fully testable without one.
4. Onboarding wizard (`/restaurant-setup` → `/domain` → `/brand` → `/launch`) persists to the `restaurants` table via `PUT /api/restaurant/*`
5. `/go-live` → operations dashboard (`/directory-listings`, `/digital-business-card`, `/one-link`) — these remain interactive UI demos (Phase 2/3 scope per the SOW), not backed by real integrations
6. `/platform-admin` reads real tenant data from the database (admin-only route)

All wizard/dashboard/admin routes are protected — no token means a redirect to `/login`; non-admins are redirected out of `/platform-admin` and vice versa. Click the profile chip on any dashboard page to log out.

## Building for production

```bash
npm run build      # outputs to dist/
```

In production (`NODE_ENV=production`), the Express server itself serves the
built frontend from `dist/` alongside the API, so a single Node process
handles everything. See `DEPLOY.md` for the full droplet setup.
