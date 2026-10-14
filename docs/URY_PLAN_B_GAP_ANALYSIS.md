# IROAS ↔ URY — Plan B (URY owns restaurant operations): Gap Analysis & Implementation Plan

Date: 2026-10-13 · Status: **analysis only — Plan B is NOT implemented.** No application code, mappings or URY data were changed while producing this document.

Companion documents: `docs/URY_API_DISCOVERY.md` (endpoint contracts), `docs/URY_MENU_API_DISCOVERY.md` (menu/table detail).

---

## 1. Audit baseline

### 1.1 Deployed URY (verified live, read-only)
| Item | Value |
|---|---|
| Server | `http://34.35.106.93` (`URY_BASE_URL`); plain HTTP |
| Versions (`frappe.utils.change_log.get_versions`) | frappe 16.51.0, erpnext 16.50.0, hrms 16.50.0, **ury 3.0.0-beta.1 on branch `version-16`** |
| Data | 1 URY Restaurant (`Demo Restaurant`, branch `Demo Branch`, company `Iroas Restaurant`, ZAR), 1 POS Profile (`Demo Profile`), 12 tables, 1 menu (7 items), 0 POS Invoices, 0 KOTs, 0 Self Ordering Profiles, 0 Operating Schedules, POS Opening Entry `POS-OPE-2026-00001` (opened 2026-10-09, now "outdated") |
| Integration identity | IROAS logs in as `Administrator` (session). See §4 — this must change. |

### 1.2 Verification classes used below
- **LIVE** — request made to the deployed server and the result observed.
- **LIVE-META** — DocType/method exists on the deployed server (schema or error shape proves it) but the operation itself was not executed (writes, or no data).
- **SRC-v16** — present in public source on `version-16` (what is deployed) but not exercised live.
- **SRC-unreleased** — only on `pre-develop` / `feat/reservations` (PR #357 merged to `pre-develop`; PR #358 to `develop` still open). **Not deployed.**
- **NONE** — not found anywhere.

### 1.3 Current IROAS state (what is authoritative today)
| Domain | IROAS today | Source of truth today | Plan B target |
|---|---|---|---|
| Restaurant profile, contact, branding | SQLite `restaurants` + `settings_json`; public `GET /api/public/:slug` | IROAS | Operational fields (hours, address/contact) from URY; branding/marketing stays IROAS |
| Opening hours | `restaurants.operating_hours` (`parseHours`), drives reservation slots | IROAS | URY `URY Branch Operating Schedule` |
| Menu | SQLite `menu_items` CRUD + public menu; dashboard also shows read-only URY menu (`/pos-menu`) | IROAS (website), URY (POS) | URY |
| Tables / QR | SQLite `dining_tables` (QR public codes) + read-only URY occupancy (`/pos-tables`) | IROAS (QR), URY (occupancy) | URY tables; QR tokens from URY self-ordering |
| Reservations | SQLite `reservations`, `listSlots/assertBookable`, auto table assignment, `reservationMessaging` (confirm + reminder `setInterval`) | IROAS | URY (blocked — §3) |
| Guest orders | SQLite `orders/order_items` (`createGuestOrder`), `orderMessaging` | IROAS | URY POS Invoice + KOT |
| Staff POS orders | `POST /api/restaurant/pos-orders` → `sync_order` (built 2026-10-12, never succeeded live) | URY | URY |
| Customers | Local per-order guest name/phone; dashboard reads URY customers derived from POS Invoices | mixed | URY Customer |

**Conflict with Plan B:** guest orders and reservations are currently created as authoritative IROAS records. Per the brief they are kept running until a URY replacement is tested (§6, cut-over), then disabled per tenant.

---

## 2. Feature-by-feature gap analysis

Format per feature: API · verification · URY configuration needed · IROAS code changes · tests · blocker class.
Blocker classes: **(1)** existing URY configuration · **(2)** supported URY API already deployed · **(3)** new URY backend feature · **(4)** upgrade/merge to a supported URY branch.

### F1. Restaurant metadata, address & contact
| | |
|---|---|
| API | `GET frappe.desk.form.load.getdoc?doctype=URY Restaurant&name=<mapped>` → `address`, `company`, `branch`, `image`, `tax_id`; then `getdoc Address <address>`; `getdoc Company <company>` (`phone_no`, `email`, `website`, `default_currency`) |
| Verification | URY Restaurant + Company: **LIVE**. Address: **LIVE-META** only — `Demo Restaurant.address` is empty, so Address field names are unverified on this server. |
| URY config | Create an `Address` and link it on `URY Restaurant.address`; fill Company phone/email. |
| IROAS changes | `uryRestaurant.js`: `getUryRestaurantProfile()` (read-only, cached 5–15 min). Public site: show URY address/phone when present, IROAS value as labelled fallback until cut-over. No writes to URY. |
| Tests | Unit: mapper with/without address. Live: after config, read returns linked Address; tenant B cannot read tenant A (mapping check). |
| Blocker | **(1)** configuration |

### F2. Opening hours (+ holidays/exceptions)
| | |
|---|---|
| API | `GET getdoc URY Branch Operating Schedule <branch>` (autoname = branch) → `enabled`, `timezone`, `pre_open_time`, `close_grace_minutes`, `monday…sunday` (child `URY Branch Service Window`: `service_name*`, `open_time*`, `close_time*`, `enabled`); `GET get_list URY Branch Operating Exception` filtered `{branch}` → `exception_date*`, `is_closed`, `open_time`, `close_time`, `reason` |
| Verification | DocTypes **LIVE-META** (schema read 2026-10-13); **0 records**. Present in **SRC-v16** with no whitelisted helper methods (plain DocTypes → generic Frappe read APIs). Permissions: System Manager / URY Manager read-write. |
| URY config | Create one Operating Schedule per branch (timezone + service windows per day) and exceptions for closures. |
| IROAS changes | New `uryHours.js` mapping windows → IROAS hours shape; public site + reservation slot engine read URY hours for linked tenants (fallback: show "hours unavailable", never silently use stale IROAS hours after cut-over). Cache 15 min; serve last good copy flagged `stale:true` on URY failure. |
| Tests | Mapper (multiple windows/day, overnight close < open, disabled windows, exceptions). Live read after config. Timezone handling vs restaurant timezone. |
| Blocker | **(1)** configuration (corrects the earlier "no hours in URY" finding) |

### F3. Menu, prices, availability
| | |
|---|---|
| API (display, tenant-safe) | `getdoc URY Restaurant` → `active_menu`, `room_wise_menu`, `menu_for_room`, `order_type_wise_menu`, `order_type_menu`; `getdoc URY Menu` → `items[]` (`item`, `item_name`, `rate`, `course`, `disabled`, `special_dish`), `branch`, `price_list`; `getdoc Price List` → `currency` |
| API (guest ordering) | `GET ury.ury.api.self_ordering.get_customer_menu?session=` (guest; resolves by Self Ordering Profile branch) |
| API (staff) | `GET ury.ury_pos.api.getRestaurantMenu?pos_profile=&room=&order_type=` — **branch taken from the session user** (`getBranch()`), not from `pos_profile` |
| Verification | getdoc chain **LIVE** (IROAS `/pos-menu`); getRestaurantMenu **LIVE** (7 items, all order types same menu); get_customer_menu **LIVE-META** (module present; needs a session). |
| Gaps | No item description in URY menu payload; item images come from `Item.image`; stock availability is enforced at order time (stock-reservation gate) not exposed in menu. |
| URY config | Per restaurant: active menu, price list, optional room/order-type menus. |
| IROAS changes | Public website menu for linked tenants served from URY (item **codes** retained for ordering); hide IROAS menu editor for linked tenants after cut-over; 60 s cache already in place, add `stale` flag + last-good fallback. |
| Tests | Mapper tests (room/order-type variants, disabled items); tenant isolation (`menu.branch == restaurant.branch`); failure → stale/unavailable states. |
| Blocker | none for display (**(2)**). Descriptions would need Item reads — unverified. |

### F4. POS configuration
| | |
|---|---|
| API | `get_list POS Profile` filtered `{restaurant}`; `getdoc POS Profile` (`branch`, `currency`, `payments[]`, `applicable_for_users[]`, `role_allowed_for_billing`); `ury.ury_pos.api.getPosProfile` (session-user-scoped); `ury.ury_pos.api.getModeOfPayment` |
| Verification | **LIVE** |
| IROAS changes | Store/validate `pos_profile` per tenant (§4) instead of deriving from the session user. |
| Blocker | none |

### F5. Tables & live occupancy
| | |
|---|---|
| API | `get_list URY Table` fields `name, occupied, latest_invoice_time, restaurant, restaurant_room, no_of_seats, is_take_away` filtered `{restaurant}`; `ury.ury.doctype.ury_order.ury_order.get_table_order_context?table=` |
| Verification | **LIVE** (IROAS `/pos-tables`) |
| Gaps | Guest QR codes today are IROAS `dining_tables.public_code`; URY's equivalent is a signed token from `ury.ury.api.self_ordering.generate_qr_token(profile, table)` (**SRC-v16**, staff-only, needs write on the Self Ordering Profile; not exercised). |
| IROAS changes | Map IROAS QR → URY table (or replace with URY tokens) during F8; keep existing QR flow until then. |
| Blocker | none for read; QR replacement depends on F8 |

### F6. Reservation availability
| | |
|---|---|
| API | `ury.ury.api.table_reservation.get_available_tables_for_reservation(branch, reserved_at, exclude_reservation?)`; `get_branch_reservation_settings(branch)` |
| Verification | **SRC-unreleased** only. Live: **module missing** (417 "No module named 'ury.ury.api.table_reservation'"); DocType `URY Table Reservation` 404; Branch reservation custom fields absent. |
| Source behaviour | Excludes take-away tables, occupied tables expected to run past the slot, and overlapping Confirmed/Active/Requested reservations; duration from branch average/calculated (not a parameter); **no party-size filter**. |
| Blocker | **(4)** — and effectively **(3)**: `pre-develop` is 859 commits ahead / 1902 behind `version-16`; `version-16-dev` (PR #518) contains no reservation files. Needs the URY maintainers to port `feat/reservations` to `version-16` (or a custom app), then deploy. |
| IROAS changes (after deploy) | `uryReservations.js` read; filter by `no_of_seats ≥ party`; intersect with F2 hours. Until then: IROAS engine stays authoritative (documented exception to Plan B). |
| Tests | Contract tests against the deployed module; overlapping-slot and occupied-table cases; tenant isolation via branch. |

### F7. Reservation create / modify / cancel
| | |
|---|---|
| API | `create_table_reservation(table, customer, reserved_at, customer_name?, customer_phone?, no_of_pax, notes?, branch?)`, `update_table_reservation(...)`, `update_reservation_status(reservation_name, status, pos_invoice?)` |
| Verification | **SRC-unreleased** only; live missing. |
| Source caveats | `create_table_reservation` inserts with `ignore_permissions`; conflict rules run in DocType `validate()`; no explicit row lock seen (concurrency **unverified**). `check_table_reservation` / `get_active_reservations` **mutate** (no-show processing, occupancy sync) — must not be used as passive reads. |
| Blocker | **(4)/(3)** as F6 |
| IROAS changes (after deploy) | Guest booking widget writes to URY; IROAS keeps only a non-authoritative reference (reservation name, confirmation token for the guest link). Migration of existing IROAS bookings: one-off, reviewed. |
| Tests | Create → appears in URY; double-booking rejected; concurrent creates (two parallel requests) → exactly one succeeds; cancel/modify transitions; status permissions. |

### F8. Guest order submission (website / QR)
| | |
|---|---|
| API | `ury.ury.api.self_ordering`: `get_ordering_context(token)` → session token; `get_customer_menu(session)`; `add_customer_items(session, items:[{item, qty, comment?}])`; `get_customer_order(session)`; `get_order_status(session)`; `request_bill(session)`; payment-request methods. Staff: `generate_qr_token(profile, table?)`. All guest methods `allow_guest=True`. |
| Verification | **LIVE-META**: module deployed (`get_ordering_context` without token → 403 "Missing ordering token or device credentials"); `URY Self Ordering Profile` / `URY Ordering Session` DocTypes exist; **0 profiles** → not executable. Behaviour below is **SRC-v16**. |
| Source behaviour | Profile-scoped (uses the Self Ordering Profile's `branch` + `pos_profile`, not the caller's login) ✅ good for multi-tenant. Server re-prices items; items must be on the resolved menu; ≤ 50 items/request; creates/updates a Draft **POS Invoice**, sets table occupied, runs **KOT** (rolls back on KOT failure); stock-reservation gate applies. |
| Gaps | **No idempotency**: `add_customer_items` always appends rows → a retried request duplicates food. **No guest identity**: invoice customer = profile `default_customer`; there is no parameter for guest name/phone. Session idle timeout (`session_idle_timeout_minutes`, default 30). Side effect: `_ensure_admin_branch_mapping` adds `Administrator` to the Branch user table. POS Invoice save is subject to ERPNext POS-opening validation → **an open, current-day POS shift is expected to be required (unverified for this path)**. |
| URY config | Per restaurant: `URY Self Ordering Profile` (restaurant, branch, pos_profile, `default_customer`, `enabled`, `enable_qr_table_ordering` / `enable_qr_pickup_ordering`, `allow_add_to_running_table`, …); open POS shift. |
| IROAS changes | `urySelfOrdering.js` (server-side proxy; tokens never exposed beyond the guest's own session); IROAS-side **idempotency key** per checkout (store `request_id → session, invoice, result`; on timeout reconcile via `get_customer_order` before any retry; never auto-retry `add_customer_items`); guest website checkout for linked tenants → self-ordering; order tracking via `get_order_status`. Guest identity: see blocker. |
| Blocker | **(1)** profile + shift; **(3)** for guest customer identity on self-orders and server-side idempotency (URY change: accept `customer`/`client_request_id` in `add_customer_items`, or IROAS creates the customer and staff attaches it — no supported API to set it today). |
| Tests | Live: create token (staff) → context → menu → add items → status; retry-with-same-request-id → no duplicate; shift closed → clear error; KOT failure → no invoice; tenant A token cannot order on tenant B. |

### F9. Staff order (dashboard "New POS order")
| | |
|---|---|
| API | `POST ury.ury.doctype.ury_order.ury_order.sync_order` (payload in `URY_API_DISCOVERY.md` C1); `POST ury.ury.doctype.ury_order.ury_order.cancel_order {invoice_id, reason}` |
| Verification | sync_order **LIVE** up to validation — rejected with 417 "POS Opening Entry POS-OPE-2026-00001 is outdated"; **no successful order yet**. cancel_order **SRC-v16** + live POS bundle, not exercised. |
| Gaps | Session-user branch scoping (`getBranch()`): works for exactly one tenant with the shared account; duplicate protection only via "table occupied" + `last_modified_time`. |
| IROAS changes | Per-tenant integration user (§4); idempotency key as F8; keep "free tables only". |
| Blocker | **(1)** open POS shift; per-tenant URY users |
| Tests | Live create → POS Invoice Draft + KOT + table occupied; second create on same table → Failure; cancel → table released. |

### F10. Order status, bills, kitchen tickets
| | |
|---|---|
| API | `get_list POS Invoice` filtered `{restaurant}` (IROAS `/pos-orders` GET); `getdoc POS Invoice`; `ury.ury.api.self_ordering.get_order_status(session)` (guest); `ury.ury.doctype.ury_order.ury_order.get_order_invoice?table=`; `getPosInvoice(status, limit, limit_start)` (session-user profile) |
| Verification | get_list/getdoc **LIVE** (0 records); KOT DocType **LIVE-META** (0 records) |
| IROAS changes | Guest order-tracking page reads URY status (self-ordering session or invoice lookup through IROAS reference); dashboard board already reads URY. |
| Blocker | none beyond F8/F9 data existing |
| Tests | Status transitions Draft → Paid/Cancelled reflected; stale cache handling |

### F11. Customers
| | |
|---|---|
| API | `POST ury.ury_pos.api.create_customer {customer_name, mobile_number}`; `get_list Customer` filtered `{mobile_number}` |
| Verification | **LIVE** (one test customer created 2026-10-12) |
| Gap | URY Customer has no restaurant/branch field — customers are global across tenants; IROAS must never list them unscoped (current code derives per-tenant customers from that tenant's POS Invoices). |
| Blocker | none (privacy rule enforced in IROAS) |

### F12. Booking confirmations, reminders, order-status messaging
| | |
|---|---|
| API | None in URY for guest messaging. URY has `share_payment_link` with a pluggable communication provider (SRC-v16) and staff KOT notifications only. |
| Plan | IROAS keeps messaging (`reservationMessaging`, `orderMessaging`) but **triggers from URY records** (reservation/invoice names and statuses) instead of IROAS records. Reminders need reservation data from F7 → blocked with F6/F7. Order-status messages poll F10. |
| Blocker | depends on F7 (**(4)**) and F8 |

---

## 3. Blocker summary

| Blocker | Class | Owner | Action |
|---|---|---|---|
| Opening hours have no records | (1) | Restaurant / URY admin | Create `URY Branch Operating Schedule` (+ exceptions) per branch |
| Contact needs linked Address | (1) | URY admin | Create Address, link on `URY Restaurant.address`; fill Company phone/email |
| Table reservations not deployed | (4) + likely (3) | URY maintainers / hosting | Port `feat/reservations` (PR #357 on `pre-develop`) to `version-16`, add Branch reservation fields, deploy, re-verify |
| Self-ordering profile missing | (1) | URY admin | Create `URY Self Ordering Profile` per restaurant (default customer, POS profile, modes) |
| POS shift outdated | (1) | Cashier | Close `POS-OPE-2026-00001`, open today's shift; daily operating procedure |
| No duplicate-submission protection (`sync_order`, `add_customer_items`) | (3) for a URY-native fix; IROAS mitigation possible | URY maintainers + IROAS | IROAS idempotency keys + reconcile-before-retry now; request URY `client_request_id` support |
| Guest identity on self-orders | (3) | URY maintainers | Allow `customer` (or name/phone) on self-order, or staff-side attach workflow |
| Session-user branch scoping (`getRestaurantMenu`, `getPosProfile`, `sync_order`) | (1) | URY admin + IROAS | One URY integration user per branch; IROAS stores per-tenant credential reference |
| Integration runs as `Administrator`; self-ordering mutates Branch users for Administrator | (1) | URY admin | Dedicated least-privilege integration users |
| Plain HTTP to URY | (1) | Hosting | TLS on the URY server before production |

## 4. Restaurant-specific mapping (Step 4)

Current: `restaurant_integrations(restaurant_id, provider='ury', external_restaurant, status)`, unique per tenant and per URY restaurant; IROAS derives POS Profile by `get_list POS Profile {restaurant}` and refuses unless exactly one is active; `getPosProfile()` must equal it before any ordering call. Never defaults to `Main Restaurant`; restaurant is never taken from the browser.

Required changes:
1. Extend the mapping with `ury_branch`, `ury_pos_profile`, `ury_self_ordering_profile`, and `credential_ref` (name of a server-side secret, e.g. `URY_TENANT_<id>_USERNAME/PASSWORD` or API key/secret — never stored in the DB or sent to the browser).
2. Validation on link and on every request (cached briefly): `URY Restaurant.branch == POS Profile.branch == Self Ordering Profile.branch == mapped branch`, `POS Profile.restaurant == Self Ordering Profile.restaurant == mapped restaurant`, profiles enabled.
3. Client per tenant: `uryClient` keyed by `credential_ref` (separate session cookie per tenant). The URY username is used only to authenticate, never to identify the restaurant; identity always comes from the mapping row, and every response is checked against the mapped restaurant/branch.
4. Admin link script (`server/scripts/ury-link-restaurant.js`) gains `--pos-profile`/`--self-ordering-profile` and runs the validation above.

Tests: two tenants mapped to two URY restaurants — each tenant's menu/tables/orders/reservations contain only its own records; swapping credentials is detected (branch mismatch → `pos_mapping_invalid`).

## 5. Caching & failure policy
| Data | TTL | On URY failure |
|---|---|---|
| Hours, address/contact | 15 min | Serve last good copy with `stale:true` + "may be out of date"; after 24 h → "unavailable" |
| Menu | 60 s (existing) | Last good copy flagged stale; **ordering disabled** while stale (prices must be current) |
| Tables / occupancy | no cache (live) | "Live status unavailable" |
| Availability (future) | no cache | Booking disabled; no IROAS fallback after cut-over |
| Orders / reservations writes | never cached | Return error; reconcile via read before any retry |

## 6. Implementation plan (order per brief)

| # | Phase | Prerequisites (URY side) | IROAS work | Exit criteria (all verified live) |
|---|---|---|---|---|
| 0 | Integration identity & mapping | Dedicated integration user per branch; TLS | §4 mapping/credential changes; per-tenant client | Two-tenant isolation tests pass |
| 1 | Restaurant metadata & hours | Operating Schedule + Address configured | `uryHours.js`, `getUryRestaurantProfile`, public site + slot engine read URY hours (flagged per tenant) | Public site shows URY hours/contact; stale/unavailable states tested |
| 2 | Read-only menu on the website | Active menu per restaurant | Public menu from URY for linked tenants; item codes kept; editor hidden after cut-over | Website menu == URY menu; price change in URY visible ≤ 60 s |
| 3 | Self-ordering | Self Ordering Profile; open POS shift | `urySelfOrdering.js`, idempotency keys, guest checkout + status page; QR → URY table mapping | Real order → POS Invoice + KOT in URY; duplicate-retry test; shift-closed error; cancel path |
| 4 | Reservation capability in URY | Port/deploy `table_reservation` to `version-16`; Branch reservation settings | — (verification only) | DocType + methods present live; re-run discovery |
| 5 | Availability & booking against URY | Phase 4 | `uryReservations.js`; booking widget + staff calendar on URY; migration of open IROAS bookings | Create/modify/cancel live; double-booking + concurrency tests |
| 6 | Confirmations, reminders, order status | Phases 3 & 5 | Messaging triggered from URY records; order-status display | Messages fire from URY state changes only |
| 7 | Cut-over per tenant | — | Feature flag `ury_operations=true` disables IROAS-authoritative orders/reservations/menu for that tenant; keep QR/reservations for unlinked tenants | Tenant runs a full service day with no IROAS-authoritative records |

Preserved until each replacement passes its exit criteria: IROAS QR table ordering, IROAS reservations + messaging, IROAS menu editor, onboarding/approval/AddPay flows (untouched).

## 7. Before any URY backend change
- Deployed: ury `3.0.0-beta.1`, branch `version-16`, frappe/erpnext 16.5x.
- Reservation code lives on `pre-develop` (diverged: +859 / −1902 vs `version-16`); `version-16-dev` (PR #518, 121 files) has none of it. A port must be done and reviewed against `version-16` (fixtures, Branch custom fields, POS Invoice hooks touched by PR #357: `ury/ury/hooks/ury_pos_invoice.py`, `ury_pos_closing_entry.py`).
- Prefer upstream merge over a fork; if a custom app is used, keep it separate from `ury` so `version-16` upgrades remain possible.

## 8. What is verified vs not (honest status)
- Verified live: menu read, tables/occupancy read, POS profile/payment modes read, customer create/find, POS Invoice list, self-ordering module presence, hours DocTypes presence, versions.
- Built in IROAS but **not yet successful live**: staff `sync_order` (blocked by POS shift).
- Not available live: table reservations.
- Not configured live: self-ordering profile, operating schedule, restaurant address.
- **Plan B is not implemented.** Phases 0–7 remain.

## 9. Phase "Integration identity & mapping" — implemented in IROAS (2026-10-13)
Row 0 of §6 (requested as "Phase 1"). IROAS side is done and tested; **live multi-tenant isolation is not verified** because URY has one restaurant and no dedicated integration user yet.

- Mapping (`restaurant_integrations`, additive migration): `external_restaurant`, `ury_branch`, `ury_pos_profile`, `ury_self_ordering_profile` (optional; validated when set), `credential_ref`, `verified_user`, `verified_at`. Unique: URY restaurant, credential_ref, verified_user.
- Secrets: env only, `URY_CRED_<REF>_API_KEY/_API_SECRET` or `_USERNAME/_PASSWORD`. Never in SQLite, responses or logs. `URY_USERNAME/PASSWORD` is now operator-scripts-only.
- `resolveUryTenant(restaurantId)` (owner JWT → own restaurant only) authenticates with the tenant's client (own session) and verifies, cached 5 min: logged user ≠ Administrator (dev override `URY_ALLOW_ADMINISTRATOR_CREDENTIAL`, ignored in production) and not used by another tenant; URY Restaurant exists and `.branch == ury_branch`; user listed in Branch → URY User; `getPosProfile` (URY's own branch resolution) returns `ury_branch` + `ury_pos_profile`; POS Profile restaurant/branch match and enabled; self-ordering profile restaurant/branch/pos_profile match and enabled (non-secret fields only). Failures → 409 `pos_mapping_invalid` (reason logged), disabled/absent → 409 `pos_not_connected`.
- Operator script: `scripts/ury-link-restaurant.js link|verify|disable|--list`; a link is saved only after it verifies.
- Tests: `server/test/uryTenantIsolation.test.js` (`npm test` in `server/`), fake Frappe server with two restaurants.
- Existing link #62 → `Demo Restaurant` has no branch/profile/credential and returns `pos_mapping_invalid` until relinked with a dedicated user.

## 10. Single demo restaurant (Saffron & Fig ↔ URY `Demo Restaurant`) — 2026-10-13
IROAS side built and tested against a fake URY. **Not yet live end to end**, because the dedicated integration credential is missing (so the link can't be moved from #62 to #3), URY has no hours or address records, and the only POS shift (`POS-OPE-2026-00001`, opened 2026-10-09) is outdated. **Table reservations remain blocked** (F6/F7): the `ury.ury.api.table_reservation` module and the `URY Table Reservation` DocType are not on version-16.

**Demo switches** (`restaurant_integrations.feature_hours / feature_contact / feature_menu / feature_guest_ordering`, default off, set with `ury-link-restaurant.js features`). When a switch is on, that feature comes only from URY. A failure shows a warning; local data is never used instead.

**URY endpoints used** (all through the tenant's own credential, backend only):

| Feature | Endpoint |
|---|---|
| Hours | `frappe.desk.form.load.getdoc` `URY Branch Operating Schedule` (name = branch); `frappe.desk.reportview.get_list` `URY Branch Operating Exception` (branch, `exception_date >=` yesterday) |
| Contact | getdoc `URY Restaurant` → `.address` → getdoc `Address` (phone, email_id, address lines, city, country) |
| Menu | getdoc `URY Restaurant` → `URY Menu` (active_menu) → `Price List` (currency) |
| Guest order | `ury.ury.api.self_ordering.generate_qr_token(profile)` → `get_ordering_context(token)` → `add_customer_items(session, items)`; verify with `get_order_status(session)` / `get_customer_order(session)`; live state from getdoc `POS Invoice` |

**IROAS public API:** `GET /api/public/:slug` (adds `ury` block; hours/contact replaced by URY values when switched on), `POST /api/public/:slug/ury-orders` `{submissionId, items:[{code, qty}], guestName, guestPhone}`, `GET /api/public/:slug/ury-orders/:submissionId`.

**Order safety:**
- Every submission gets its own URY ordering session, and the profile has `allow_add_to_running_table = 0`, so URY itself refuses a second add on that session.
- The `submissionId` (generated by the browser and reused on retry) is unique per restaurant in `ury_guest_orders`.
- Results:
  - 201 placed (200 on replay).
  - 409 `pos_closed` / `ordering_unavailable`; 422 `item_unavailable` / `order_rejected`; 409 `submission_conflict`.
  - 502 `pos_unavailable`: nothing was sent, safe to retry with the same id.
  - 202 `unknown`: a timeout, 5xx or unreachable error after items were sent. IROAS asks `get_order_status` first and only re-sends on the same session after `URY_GUEST_ORDER_RETRY_AFTER_MS` (default 150 s).
- An expired session while verifying returns `order_unverified`, which is never reported as placed and never re-sent.

**Guest identity gap:**
- `add_customer_items` always invoices `profile.default_customer` ("IROAS Website Guest"). The API has no way to attach the guest's name or phone.
- For now, IROAS keeps them in `ury_guest_orders.guest_name/guest_phone` and tells the guest so.
- Backend change needed in URY: optional `customer_name` and `mobile_no` (or `customer`) on `get_ordering_context` or `add_customer_items`, stored on the POS Invoice (for example `customer_name`, `contact_mobile`, or the URY order notes).

**URY records created (authorized):** Customer `IROAS Website Guest`; URY Self Ordering Profile `Demo Restaurant Website` (pickup on, table off, add-to-running off, pay at counter). Created with `scripts/ury-demo-setup.js --apply`.

**URY configuration still required:**
1. A dedicated integration user, listed in Demo Branch → URY User and in the Demo Profile's applicable users. It needs read access to URY Restaurant, Branch, URY Menu, Price List, POS Profile, URY Table, POS Invoice, Address, URY Self Ordering Profile, URY Branch Operating Schedule and URY Branch Operating Exception, plus write access on URY Self Ordering Profile (required by `generate_qr_token`). Generate its API key and secret.
2. A URY Branch Operating Schedule for `Demo Branch` (enabled, timezone, weekday service windows), plus any exceptions.
3. An Address linked from URY Restaurant `Demo Restaurant` → `address` (phone, email).
4. Close `POS-OPE-2026-00001` and open a new POS Opening Entry for Demo Profile.

**Remaining URY-side development:**
- Port `feat/reservations` to version-16 and deploy it (§7).
- Guest identity parameters (above).
- Optional: a client idempotency key on `add_customer_items`, which would remove the 150 s verify window.

**Run the demo (from `server/`):**
1. Add `URY_CRED_TENANT_3_API_KEY` and `URY_CRED_TENANT_3_API_SECRET` to `server/.env`.
2. `node scripts/ury-link-restaurant.js link 3 --restaurant "Demo Restaurant" --branch "Demo Branch" --pos-profile "Demo Profile" --self-ordering-profile "Demo Restaurant Website" --credential-ref TENANT_3 --move-from 62`
3. `node scripts/ury-link-restaurant.js features 3 --hours on --contact on --menu on --guest-ordering on`
4. Start the server and the web app, then open `/s/saffron-fig`.
