# URY API Discovery — Menu, Hours/Contact, Table Reservations, Guest Orders

Date: 2026-10-12 · Discovery only (no application code or mappings changed in this task).

## 0. Scope, sources and method

| Item | Value |
|---|---|
| Live server verified | `http://34.35.106.93` (the value of `URY_BASE_URL` in `server/.env`). The older `https://iroas.atlantechglobal.com` server is **no longer configured** in IROAS and was **not** probed in this task. |
| Live versions (`GET frappe.utils.change_log.get_versions`) | frappe 16.51.0 · erpnext 16.50.0 · hrms 16.50.0 · **ury 3.0.0-beta.1, branch `version-16`** |
| Public source | `github.com/ury-erp/ury` — branches `version-16` (what the live server runs), `develop`, `pre-develop`, `feat/reservations` |
| Live POS frontend | `/pos` → `/assets/ury/pos/assets/index-*.js` (the bundle the live URY POS actually runs; call sites copied from it) |
| Auth used | Server-side session (`POST /api/method/login`, user from `server/.env`). No credentials, cookies or headers were printed or stored. |
| Writes in this task | **None.** Only `GET` requests and DocType/metadata reads. Methods that look like reads but mutate data (see B) were deliberately **not** called. |
| Writes in earlier tasks (disclosed) | 2026-10-12: one URY Customer `IROAS Integration Test` (+27000000001) was created via `create_customer`; one `sync_order` was attempted and **rejected** by URY (outdated POS Opening Entry) — no invoice was created. |
| Raw evidence | `server/data/ury-captures/34.35.106.93/discovery-2026-10-12.json`, `…/pos-bundle/`, `server/data/ury-captures/github/` (gitignored) |

Legend — **Public**: found in public source (branch noted). **Live**: verified by a request to `34.35.106.93`. **IROAS**: status in this codebase.

---

## A. Live restaurant menu

| Field | Finding |
|---|---|
| Endpoint | `GET /api/method/ury.ury_pos.api.getRestaurantMenu` |
| Parameters | `pos_profile` (required), `room` (optional), `order_type` (optional: `Dine In`, `Take Away`, `Delivery`, `Phone In`, `Aggregators` — option list from the POS Invoice DocType and the live POS bundle) |
| Response | `message: { items: [{ item, item_name, rate, special_dish, disabled, item_image, course, course_label }], modified_time, name }` (`name` = URY Menu). Live: 7 items, menu `Demo Menu`. |
| Not in response | **No item description.** No currency. No stock quantity. |
| Menu selection (public `version-16`/`develop` source, `resolve_restaurant_menu`) | Restaurant = `URY Restaurant` whose `branch` = **the logged-in user's branch** (`getBranch()`); `pos_profile` is only used to decide whether the caller is a cashier. If `room` given and `room_wise_menu=1` → `Menu for Room` row, else `active_menu`. Else if caller is a cashier and `order_type_wise_menu=1` → `Order Type Menu` row, else `active_menu`. Only rows with `disabled=0` are returned. Throws "Please set an active menu…" if none. |
| Dine-in vs takeaway vs aggregator | Differs **only** when the restaurant enables `room_wise_menu` / `order_type_wise_menu`. Live `Demo Restaurant` has both `0`, and all four order types plus room `First Floor AC` returned the same `Demo Menu` (verified live). Aggregator menus also exist via `ury.ury_pos.api.getAggregatorItem(aggregator)` (public; not exercised). |
| Currency | Not part of the menu response. Sources: `Price List.currency` of `URY Menu.price_list` (IROAS reads this today), `POS Profile.currency` (live: `ZAR`), `Company.default_currency` (live: `ZAR`). |
| Auth / permissions | Logged-in URY user with a Branch assignment. **Tenant-isolation caveat:** because the branch comes from the session user, one shared service account can only ever read *its own* branch's menu through this method. |
| Alternative read path (used by IROAS) | `GET frappe.desk.form.load.getdoc` for `URY Restaurant` → `URY Menu` → `Price List` (not user-branch-scoped; IROAS checks `menu.branch = restaurant.branch`). |
| Status | Public ✅ (`version-16`) · Live ✅ · **IROAS: implemented** — `GET /api/restaurant/pos-menu` (getdoc chain, read-only, 60 s cache) and `GET /api/restaurant/pos-order-menu?table=` (getRestaurantMenu, used for ordering; guarded so it only runs when `getPosProfile().pos_profile` equals the mapped restaurant's POS Profile). |
| Blockers | Multi-restaurant use of `getRestaurantMenu` needs one URY user per restaurant/branch, or keep using the getdoc chain for menu display. Descriptions are not available from URY menus (Item `description` would need a separate Item read — unverified). |

### A2. POS Profile

| Field | Finding |
|---|---|
| Endpoint | `GET /api/method/ury.ury_pos.api.getPosProfile` (no params) |
| Response (live) | `pos_profile, branch, company, waiter, warehouse, cashier, print_format, qz_print, qz_host, printer, print_type, tableAttention, paid_limit, disable_rounded_total, enable_discount, multiple_cashier, owner, edit_order_type, enable_kot_reprint` |
| Selection | Profile whose `branch` = session user's branch. `cashier`/`owner` = first `applicable_for_users` row (or main-cashier logic when multiple cashiers). |
| Full profile | `GET ury.ury_pos.api.getPosProfileFull?pos_profile=` (live ✅; used by the POS bundle) |
| Status | Public ✅ · Live ✅ · IROAS: used server-side for ordering context only. Same per-user scoping caveat as A. |

---

## M2-T03. Website menu, hours & contact sync

| Data | URY source | Finding |
|---|---|---|
| Menu | A above | ✅ available |
| Opening hours | `URY Branch Operating Schedule` (autoname = branch; `timezone`, `monday…sunday` → child `URY Branch Service Window`: `service_name`, `open_time`, `close_time`, `enabled`) + `URY Branch Operating Exception` (`exception_date`, `is_closed`, `open_time`, `close_time`, `reason`) | **Corrected 2026-10-13:** these DocTypes exist live (schema verified) and in `version-16` source, but have **0 records**. No hours fields on `URY Restaurant` or `Branch` themselves. Readable via generic `getdoc`/`get_list`; no dedicated whitelisted method. |
| Location / contact | `URY Restaurant.address` → ERPNext `Address`; `Company` (phone_no, email, website) | Live `Demo Restaurant.address` is **empty**; Company has only currency/country set. Readable via `getdoc` when populated (Address fields not yet verified live because none is linked). |
| Status | Menu: IROAS ✅. Hours: **stay in IROAS** (`restaurants.operating_hours`, already used by reservations). Contact: possible later read-only sync from `Address` once URY data exists. |

---

## B. Table reservation availability and booking

### B1. What the live server has
| Check (live, read-only) | Result |
|---|---|
| `getdoctype URY Table Reservation` | **404 — DocType does not exist** |
| `GET ury.ury.api.table_reservation.get_branch_reservation_settings?branch=Demo Branch` | **417 "No module named 'ury.ury.api.table_reservation'"** |
| `Branch` custom fields `custom_enable_reservation / custom_buffer_time / custom_grace_period` | **absent** |
| Other names tried earlier (`URY Reservation`, `Table Reservation`, `Reservation`) | 404 |
| "Reservation" code in `version-16` | Only **stock** reservation (`URY Stock Reservation`, `ury_reservation_service.py`, `reservation_line_key` on order lines) — inventory holds, **not table bookings** |

**Conclusion: the deployed URY (3.0.0-beta.1 / `version-16`) has no table-reservation feature.** ERPNext's old "Restaurant Reservation" is also not part of ERPNext 16 and was not assumed.

### B2. What exists in public source (not deployed)
Branch `feat/reservations` → merged into `pre-develop` (PR #357, 2026-09-09); PR #358 into `develop` is **still open**. `pre-develop` is 859 commits ahead / 1902 behind `version-16`.

| Method (`ury.ury.api.table_reservation.*`) | Params | Notes from source |
|---|---|---|
| `get_branch_reservation_settings` | `branch` | Pure read: enable flag, buffer, grace, avg table time, calculated duration (default 60 min) from Branch custom fields |
| `get_available_tables_for_reservation` | `branch, reserved_at, exclude_reservation?` | Read. Excludes take-away tables; occupied tables whose expected finish > requested time; tables with Confirmed/Active/Requested reservations overlapping the window. **No party-size filter** (seats returned, caller filters). Duration = branch avg/calculated, not a parameter. |
| `create_table_reservation` | `table, customer, reserved_at, customer_name?, customer_phone?, no_of_pax=1, notes?, branch?` | Insert with `ignore_permissions`; conflicts enforced in DocType `validate()` → `validate_reservation_rules(...)`. No explicit DB lock seen (concurrency unverified). |
| `update_table_reservation` | `reservation_name, table?, customer?, customer_name?, customer_phone?, no_of_pax?, reserved_at?, notes?, branch?` | |
| `update_reservation_status` | `reservation_name, status, pos_invoice?` | Completed/Cancelled need an authorised role; Completed sets table occupied |
| `check_table_reservation` | `table` | ⚠ **mutates**: runs `process_reservation_no_shows()` first |
| `get_active_reservations` | `branch?, date?` | ⚠ **mutates**: no-show processing + `sync_branch_table_occupancy()` |
| `get_completed_reservation_for_table`, `sync_branch_table_occupancy` | | latter writes |

DocType `URY Table Reservation` fields: `branch*`, `reserved_table*`, `customer*`, `customer_name*`, `customer_phone*`, `no_of_pax*`, `reserved_at*` (Datetime), `status*` (Requested | Confirmed | Completed | Cancelled | No Show), `pos_invoice`, `reserved_by`, `pos_opening_entry`, `comments`. Roles: System Manager, URY Manager, URY Captain, URY Cashier.

| Status | Public: ✅ on `pre-develop` only · Live: ❌ not installed · IROAS: reservations, availability (`listSlots`/`assertBookable`, covers + table assignment) and confirmations are **IROAS-local** and working; dashboard "Seat in POS" places a URY order for the booked guest. |
|---|---|
| Blocker | URY must be upgraded to a build that contains `table_reservation` (and its Branch custom fields / fixtures) before any URY booking sync. Until then IROAS remains the booking system of record. |

---

## C. Guest order submission and status

### C1. Staff POS order (what URY POS uses)
| Field | Finding |
|---|---|
| Endpoint | `POST /api/method/ury.ury.doctype.ury_order.ury_order.sync_order` (JSON body) |
| Body (live POS bundle) | `items:[{item, item_name, rate, qty, comment?, reservation_line_key}]`, `no_of_pax`, `pos_profile`, `order_type`, `table?`, `room?`, `customer`, `cashier`, `owner`, `mode_of_payment`, `last_invoice`, `last_modified_time?`, `invoice`, `waiter`, `comments?`, `aggregator_id?` (`version-16` signature also has `merged_tables?`). `reservation_line_key` = stock-reservation line id. |
| Creates | Draft **POS Invoice** for the table (`get_order_invoice`), marks `URY Table.occupied`, generates KOT (source mentions KOT/occupied/POS Opening Entry). `URY Order` is a virtual/helper DocType — `get_list URY Order` returns 500 live. |
| Validation | Branch/room permission checks; existing open invoice on table → `{"status":"Failure"}` ("Table occupied"); optimistic concurrency via `last_modified_time` ("Order has been modified"); billed invoice cannot be modified; **requires a current-day POS Opening Entry** (live 417: "POS Opening Entry … is outdated. Please close the POS and create a new POS Opening Entry."). |
| Duplicate submissions | No idempotency key. Second `sync_order` for a table with an open invoice and no `last_invoice` returns Failure; repeated update calls are guarded only by `last_modified_time`. |
| Auth | Logged-in user with branch access (Captain/Cashier roles); cashier session (open shift) required. |
| Cancel | `POST ury.ury.doctype.ury_order.ury_order.cancel_order {invoice_id, reason}` (live bundle; not exercised) |
| Status/read | `get_list POS Invoice` filtered by `restaurant` (IROAS uses this); `GET ury.ury_pos.api.getPosInvoice?status=&limit=&limit_start=` (live: `{data:[], next:false}`, scoped to the user's profile); `GET ury.ury.doctype.ury_order.ury_order.get_order_invoice?table=`; `GET …get_table_order_context?table=` (live ✅) |
| Status | Public ✅ (`version-16`) · Live: endpoint ✅, request validated up to the POS-shift check; **no successful order yet** · IROAS: implemented for staff (`POST /api/restaurant/pos-orders`, free tables only, server-side prices). |
| Blocker | Open a new POS shift in URY (close POS-OPE-2026-00001 opened 2026-10-09). |

### C2. Customer
`POST ury.ury_pos.api.create_customer {customer_name, mobile_number}` → `{status:"success", customer_name, mobile_number, customer_group, territory}`. Requires Customer create permission and a valid phone. Note: the `develop` source's success payload has **no `name`** field, while the live POS bundle reads `message.name`; IROAS's earlier live call returned a usable name (`IROAS Integration Test`). Customers have no restaurant/branch field (global). Public ✅ · Live ✅ · IROAS: implemented (find by exact `mobile_number`, else create).

### C3. Guest self-ordering (no cashier login on the guest side)
| Field | Finding |
|---|---|
| Module | `ury.ury.api.self_ordering` — **installed live** (`get_ordering_context` without token → 403 "Missing ordering token or device credentials", matching source) |
| Guest methods (`allow_guest=True`) | `get_ordering_context(token \| device_id+device_credential)` → opens a `URY Ordering Session`, returns session token · `get_customer_menu(session)` · `get_customer_product(session, item_code)` · `add_customer_items(session, items:[{item, qty, comment?}])` · `get_customer_order(session)` · `get_order_status(session)` → `{session_status, invoice, billed, submitted, open_requests}` · `request_bill(session)` · payment-request methods |
| Staff method | `generate_qr_token(profile, table?)` — signed token per table (or pickup); needs write permission on `URY Self Ordering Profile` |
| Server-side safety (source) | Prices re-derived server-side; items must be on the resolved menu; max items per request; add-to-running-table controlled by profile |
| Configuration needed | `URY Self Ordering Profile` (restaurant, branch, pos_profile, default_customer, enabled, enable_qr_table_ordering, enable_qr_pickup_ordering, allow_add_to_running_table, …). **Live: 0 profiles, 0 sessions** → not usable yet. |
| Open questions (unverified) | Whether `add_customer_items` needs an open POS shift; exact error shapes; whether the token can be used from a server (IROAS backend) rather than a browser. |
| Status | Public ✅ (`version-16`) · Live: module ✅, not configured · IROAS: not implemented. |

---

## D. Summary table

| Feature | Endpoint | Method | Public | Live | IROAS | Blocker |
|---|---|---|---|---|---|---|
| Menu (display) | getdoc URY Restaurant → URY Menu → Price List | GET | ✅ | ✅ | ✅ `/pos-menu` | — |
| Menu (ordering) | `ury.ury_pos.api.getRestaurantMenu` | GET | ✅ | ✅ | ✅ `/pos-order-menu` | per-user branch scoping |
| POS Profile | `ury.ury_pos.api.getPosProfile` | GET | ✅ | ✅ | ✅ (server only) | per-user branch scoping |
| Tables | get_list URY Table (`restaurant` filter) | GET | ✅ | ✅ | ✅ `/pos-tables` | — |
| Hours | getdoc `URY Branch Operating Schedule <branch>`; get_list `URY Branch Operating Exception` | GET | ✅ (`version-16`) | DocTypes ✅, 0 records | IROAS-local | schedule not configured |
| Contact/location | getdoc Address (via URY Restaurant.address) | GET | ✅ | field empty | not implemented | data not entered in URY |
| Reservation availability | `ury.ury.api.table_reservation.get_available_tables_for_reservation` | GET | `pre-develop` only | ❌ module missing | IROAS-local | URY upgrade |
| Reservation create/update/cancel | `…table_reservation.create_table_reservation` / `update_table_reservation` / `update_reservation_status` | POST | `pre-develop` only | ❌ | IROAS-local | URY upgrade |
| Staff order | `ury.ury.doctype.ury_order.ury_order.sync_order` | POST | ✅ | ✅ (blocked by shift) | ✅ `/pos-orders` | open POS shift |
| Customer | `ury.ury_pos.api.create_customer` | POST | ✅ | ✅ | ✅ `/pos-customers` | — |
| Order status | get_list POS Invoice / `get_order_invoice` / `getPosInvoice` | GET | ✅ | ✅ (0 invoices) | ✅ `/pos-orders` (GET) | no real orders yet |
| Guest self-order | `ury.ury.api.self_ordering.*` | GET/POST, guest | ✅ | module ✅, 0 profiles | ❌ | create Self Ordering Profile |

## E. Recommended implementation order

1. **Read-only menu integration** — done (`/pos-menu`). Next: serve the URY menu on the public website for linked restaurants (item codes needed for ordering), keep descriptions/hours/contact from IROAS.
2. **Reservation availability** — keep IROAS's engine (`listSlots`, `assertBookable`, table assignment) as the source of truth; optionally subtract tables currently `occupied` in URY for same-day slots (read-only, already available via `/pos-tables`). Switch to `get_available_tables_for_reservation` only after URY is upgraded to a build containing `table_reservation` and the Branch reservation fields are configured.
3. **Reservation creation and management** — IROAS-local until the URY upgrade; then mirror IROAS bookings with `create_table_reservation` / `update_table_reservation` / `update_reservation_status` (avoid `check_table_reservation` / `get_active_reservations` as "reads" — they mutate). Confirmations/reminders (M2-T06) stay in IROAS messaging.
4. **Guest order submission and status** — staff path is implemented (`sync_order`) and needs an open POS shift to verify end-to-end. For guest website orders, prefer URY's own **self-ordering** API (server-side price validation, sessions, status) once a `URY Self Ordering Profile` exists for the restaurant; otherwise map website orders to `sync_order` (requires URY item codes on the website menu and URY table mapping).

### Configuration checklist for the URY side
- Open today's POS shift for `Demo Profile` (close POS-OPE-2026-00001).
- Link an `Address` to `URY Restaurant` if contact sync is wanted.
- Create a `URY Self Ordering Profile` for `Demo Restaurant` if guest self-ordering is wanted.
- Upgrade URY to a release that includes `table_reservation` if bookings must live in URY.
- For more than one IROAS restaurant: one URY user per branch (or keep using non-user-scoped DocType reads), because `getRestaurantMenu`/`getPosProfile`/`sync_order` scope by the session user's branch.
