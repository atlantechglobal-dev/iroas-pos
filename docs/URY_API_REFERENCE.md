# URY API Reference — functions, parameters, status

Date: 2026-10-15 · Every exported function in `server/src/integrations/ury/*.js`,
the exact URY (Frappe) API it calls, its parameters, the IROAS route that
exposes it, and its real status (live-tested today, code-complete-but-untested,
not built, or blocked on URY). Companion to `docs/URY_API_STATUS.md` (that one
is the short summary + onboarding checklist; this one is the full function-level
reference).

**Status key:** 🟢 Live-verified today · 🟡 Code complete, not live-tested ·
🔴 Not built in IROAS · ⛔ Blocked — URY doesn't support it on the deployed server

---

## 0. Core client — `uryClient.js`

Every call below goes through one of these. Base URL + credential come from
`server/.env` (operator) or the per-tenant `URY_CRED_<REF>_*` vars (tenant
requests). Auth: API key/secret → `Authorization: token <key>:<secret>` header;
username/password → session cookie via `POST /api/method/login`.

| Function | Parameters | Calls |
|---|---|---|
| `getLoggedUser()` | — | `GET frappe.auth.get_logged_user` |
| `getDocType(doctype)` | `doctype: string` | `GET frappe.desk.form.load.getdoctype?doctype=&with_parent=1` |
| `getDoc(doctype, name)` | `doctype: string, name: string` | `GET frappe.desk.form.load.getdoc?doctype=&name=` — throws `not_found` if the record doesn't exist |
| `getList(doctype, opts)` | `opts: { fields?: string[], filters?: object, limit?: number (default 10000), orderBy?: string }` | `GET frappe.desk.reportview.get_list?doctype=&fields=&filters=&limit=&order_by=` |
| `get(methodPath, params)` | any whitelisted Frappe method + query params | `GET /api/method/<methodPath>?...` |
| `post(methodPath, body)` | any whitelisted Frappe method + JSON body | `POST /api/method/<methodPath>` |

---

## 1. Tenant verification — `uryTenant.js`

| Function | Parameters | What it checks | Status |
|---|---|---|---|
| `verifyUryMapping(mapping, client, { restaurantId })` | `mapping: { external_restaurant, ury_branch, ury_pos_profile, ury_self_ordering_profile?, credential_ref }` | Calls `getLoggedUser()`, rejects `Administrator` (unless `URY_ALLOW_ADMINISTRATOR_CREDENTIAL=true` and not prod), rejects a credential already verified for another restaurant, `getDoc('URY Restaurant', ...)`, `getDoc('Branch', ...)` + confirms the user is in `Branch.user[]`, `get('ury.ury_pos.api.getPosProfile')` + confirms `branch`/`pos_profile` match, `getList('POS Profile', ...)`, and (if a self-ordering profile is set) `getList('URY Self Ordering Profile', ...)` | 🟢 Used on every link (Saffron & Fig linked successfully today) |
| `resolveUryTenant(restaurantId)` | `restaurantId: number` | Reads `restaurant_integrations`, re-verifies via `verifyUryMapping` (5 min in-memory cache, `VERIFY_TTL_MS`), returns `{ restaurantId, uryRestaurant, branch, posProfile, selfOrderingProfile, integrationUser, client }` | 🟢 Every POS route calls this first |
| `linkUryRestaurant(restaurantId, mapping, { verifiedUser })` | operator-only | Upserts `restaurant_integrations`, `status = 'active'` | 🟢 Used by `ury-link-restaurant.js link` |
| `disableUryRestaurant(restaurantId)` | operator-only | Sets `status = 'disabled'` | 🟢 Used by `ury-link-restaurant.js disable` |
| `getUryIntegration(restaurantId)` | `restaurantId: number` | Raw `restaurant_integrations` row read | 🟢 |

---

## 2. Dashboard POS (authenticated owner) — IROAS routes `/api/restaurant/pos-*`

| IROAS route | Module function | URY API | Parameters | Status |
|---|---|---|---|---|
| `GET /pos-tables` | `listUryTables(tenant)` (`uryTables.js`) | `get_list URY Table` | `fields: [name, occupied, latest_invoice_time, restaurant, restaurant_room, no_of_seats, is_take_away]`, `filters: { restaurant }` | 🟢 Live — 12 tables, T1–T12, free/occupied |
| `GET /pos-menu` | `getUryMenu(tenant)` (`uryMenu.js`) | `getdoc URY Restaurant` → `getdoc URY Menu <active_menu>` → `getdoc Price List <price_list>` | none (resolved from the mapping) | 🟢 Live — 1 category, 7 items, ZAR. 60 s in-process cache |
| `GET /pos-orders` | `listUryOrders(tenant)` (`uryOrders.js`) | `get_list POS Invoice` (+ `getdoc POS Invoice` for each open/unpaid row's items) | `fields: [name, status, docstatus, order_type, restaurant, restaurant_table, customer, customer_name, mobile_number, grand_total, rounded_total, currency, posting_date, posting_time, total_qty, waiter, modified]`, `filters: { restaurant }`, `order_by: 'modified desc'`, `limit: 100` (item detail fetched for up to 30 open/unpaid rows) | 🟡 Code complete, dashboard tab renders; not exercised with real orders yet |
| `GET /pos-order-menu?table=` | `getUryOrderMenu(tenant, tableName)` (`uryOrdering.js`) | `get ury.ury_pos.api.getPosProfile`, `get ury.ury_pos.api.getModeOfPayment`, `get erpnext...check_opening_entry?user=`, `getdoc URY Table`, `get ury.ury_pos.api.getRestaurantMenu?pos_profile=&room=&order_type=` | `table: string (URY Table name)` | 🟡 Code complete; requires an **open POS shift** on the URY branch to pass `check_opening_entry` |
| `POST /pos-orders` | `placeUryOrder(tenant, {table, customer, items, pax, comments})` (`uryOrdering.js`) | Same context calls as above, then `getDoc('Customer', customerId)`, then `POST ury.ury.doctype.ury_order.ury_order.sync_order` | `table: string`, `customer: string (URY Customer id)`, `items: [{item, qty}]` (≤50 lines, qty 1–99), `pax: number (1–50)`, `comments?: string (≤300 chars)` | 🟡 **Built 2026-10-12, never confirmed to succeed live** (per discovery notes) — needs a fresh POS Opening Entry to retest. Rejects if the table is already occupied |
| `POST /pos-customers` | `findOrCreateUryCustomer(tenant, {name, phone})` (`uryOrdering.js`) | `get_list Customer` (lookup by `mobile_number`) → `POST ury.ury_pos.api.create_customer` if not found | `name: string (≤140 chars)`, `phone: string` (normalized to digits/+, ≥7 digits) | 🟡 Code complete, untested live |
| `GET /pos-customers` | `listUryCustomers(tenant)` (`uryOrders.js`) | `get_list POS Invoice` (derives customers — URY customers have no restaurant field, so this groups by `customer` across that restaurant's invoices) | `fields: [name, restaurant, status, docstatus, customer, customer_name, mobile_number, grand_total, rounded_total, currency, posting_date]`, `filters: { restaurant }` | 🟡 Code complete, dashboard tab renders |
| `GET /pos-staff` | `listUryStaff(tenant)` (`uryStaff.js`) | `getdoc Branch` (→ `user[]`), `get_list Employee` (×2: by branch, by user_id), `get_list User`, `get_list POS Profile` (+ `getdoc POS Profile` per active profile for `applicable_for_users`) | none (resolved from the mapping) | 🟡 Code complete, dashboard tab renders |

**Not called anywhere in IROAS code** (URY supports them, per discovery, but no route/function uses them yet):
- `ury.ury.doctype.ury_order.ury_order.cancel_order` — no "cancel order" action in the Dashboard
- `ury.ury.doctype.ury_order.ury_order.get_table_order_context` / `get_order_invoice` — no "what's on this table right now" or live-bill view

---

## 3. Public guest site — `GET /api/public/:slug`

| Field in response | Module function | URY API | Status |
|---|---|---|---|
| `ury.menu` | `getUryMenu(tenant)` (same as dashboard) | see §2 | 🟢 Live — `status: "ok"`, matches dashboard menu |
| `ury.hours` | `getUryHours(tenant)` (`uryHours.js`) | `getdoc URY Branch Operating Schedule <branch>` (fields: `enabled`, `timezone`, `monday`…`sunday` child tables of `URY Branch Service Window`) + `get_list URY Branch Operating Exception` filtered `{branch, exception_date: ['>=', yesterday]}`, `limit: 60` | 🟡 Code complete — returns `not_configured` until the branch has a schedule in URY desk. 15 min cache, serves last-good copy (flagged `stale: true`) for up to 24 h on URY failure |
| `ury.contact` | `getUryContact(tenant)` (`uryContact.js`) | `getdoc URY Restaurant` → `getdoc Address <restaurant.address>` | 🟡 Code complete — returns `not_configured` until the restaurant has an Address linked in URY desk. Same 15 min / 24 h stale-cache pattern |
| `ury.guestOrdering.enabled` | `getUryFeatures` + tenant check (`uryPublic.js`) | derived — `true` only if the `guest-ordering` feature switch is on **and** a self-ordering profile is mapped **and** `menu.status === 'ok'` | 🟢 Live — `true` on Saffron & Fig |
| local `menu` field (top-level, not `ury.menu`) | `mapPublicMenu()` (`public/routes.js`) | — IROAS's own `menu_items`/`menu_categories` tables, **always** local, never overridden by URY even when `feature_menu` is on | — by design: the frontend (`GuestSite.jsx`) picks `ury.menu` over local `menu` when `uryMenuActive` is true, so this is a fallback, not a bug |

---

## 4. Guest self-ordering (QR / pickup) — `urySelfOrdering.js`

Base method prefix `M = 'ury.ury.api.self_ordering'`. One URY "Ordering Session"
per IROAS `submission_id` (`ury_guest_orders` table); retries reuse the session,
never double-submit.

| IROAS route | Function | URY API | Parameters | Status |
|---|---|---|---|---|
| (internal) | `pickupToken(tenant)` | `POST <M>.generate_qr_token` | `{ profile: selfOrderingProfile }` — cached in-process per restaurant | 🟢 |
| `POST /:slug/ury-orders` | `submitGuestOrder(tenant, {submissionId, items, guestName, guestPhone})` | `POST <M>.get_ordering_context` `{ token }` → session; then `POST <M>.add_customer_items` `{ session, items: [{item, qty, comment?}] }` | `submissionId: string (16–64 chars, client-generated idempotency key)`, `items: [{code, qty (1–20), comment?}]` (≤50 lines), `guestName: string (≤80 chars)`, `guestPhone: string (≥7 digits)` — **note:** URY's API has no field for guest name/phone; they're stored IROAS-side only, the invoice uses the self-ordering profile's default customer | 🟢 Live — `guestOrdering.enabled: true` confirmed on Saffron & Fig (not yet tested with a real placed order through to invoice) |
| `GET /:slug/ury-orders/:submissionId` | `getGuestOrder(tenant, submissionId)` | `GET <M>.get_order_status?session=` → if an invoice exists, `GET <M>.get_customer_order?session=`, then `getDoc('POS Invoice', invoice)` for live status | `submissionId: string` | 🟢 Live-wired, same as above |

**Not called** (URY supports them per discovery, not built):
- `<M>.get_customer_menu?session=` / `<M>.get_customer_product?session=&item_code=` — IROAS reuses the generic `uryMenu.js` getdoc chain instead of these session-scoped endpoints (works, but skips URY's own stock-at-order-time check)
- `<M>.request_bill` — no "request the bill" step after a guest order is placed

---

## 5. Opening hours / contact — see §3 (same functions back public site and could back a future Dashboard "Hours & Contact" settings tab; no such tab exists yet, read-only everywhere today)

---

## 6. Blocked — URY doesn't expose these on the deployed server (v16, `http://34.35.106.93` / `https://iroas.atlantechglobal.com`)

| API | Parameters (per discovery) | Why blocked |
|---|---|---|
| `ury.ury.api.table_reservation.get_branch_reservation_settings?branch=` | `branch: string` | Module `ury.ury.api.table_reservation` returns **417 "No module named..."** — not deployed |
| `ury.ury.api.table_reservation.get_available_tables_for_reservation?branch=&reserved_at=` | `branch, reserved_at, exclude_reservation?` | Same — module missing |
| `ury.ury.api.table_reservation.create_table_reservation` | `table, customer, reserved_at, customer_name?, customer_phone?, no_of_pax, notes?, branch?` | Same — source exists only on URY's unreleased `pre-develop`/`feat/reservations` branches |
| `ury.ury.api.table_reservation.update_table_reservation` | — | Same |
| `ury.ury.api.table_reservation.update_reservation_status` | `reservation_name, status, pos_invoice?` | Same |
| Kitchen display / dedicated KOT status API | — | **Not found** in discovery at all — only the generic `URY KOT` doctype exists (zero live records seen), no purpose-built endpoint |

**Consequence:** reservations run entirely on IROAS's own local system
(`server/src/services/reservationAvailability.js`, `restaurants.operating_hours`)
for every tenant, URY-linked or not. This is confirmed, not a guess — the
reservation endpoint makes zero calls into the `ury/*` modules.

---

## 7. Reliability gaps (not an endpoint, but worth tracking)

| Gap | Where | Risk |
|---|---|---|
| No idempotency key on **staff** order submission | `placeUryOrder` (`uryOrdering.js`) — guest ordering already has one (`submissionId` + `ury_guest_orders`) | A retried `POST /pos-orders` request (e.g. a flaky connection) could create two orders for one table |
| Guest identity not sent to URY | `submitGuestOrder` | Every self-order lands in URY under the profile's generic default customer, not the actual guest — fine for kitchen ops, loses guest-level CRM data in URY itself |
