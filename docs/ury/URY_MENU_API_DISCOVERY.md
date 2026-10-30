# URY Menu & Table API Discovery

Verified against the live URY/Frappe server `https://iroas.atlantechglobal.com` on 2026-10-09.
Raw responses: `server/data/ury-captures/<host>/` (gitignored). Re-capture: `node scripts/ury-verify.js` (from `server/`).

**2026-10-12 — switched to `http://34.35.106.93`.** Same URY DocTypes and fields (URY Menu Course adds `icon`).
Data there: one URY Restaurant `Demo Restaurant` (company `Iroas Restaurant`, branch `Demo Branch`, active menu `Demo Menu`),
7 menu items in one course `Demo Course`, Price List currency `ZAR`, 12 tables in 4 rooms. No code changes were needed.
This server is **HTTP only** (HTTPS refused), so the URY login and session cookie are sent unencrypted.

## 1. Authentication

| Check | Request | Result |
|---|---|---|
| Server alive | `GET /api/method/ping` | `200 {"message":"pong"}`, sets `sid=Guest` |
| Guest access | `GET /api/method/frappe.auth.get_logged_user` | `403 PermissionError` |
| Token auth enabled | same, `Authorization: token <bad>:<bad>` | `401 AuthenticationError` from `frappe.auth.validate_auth` |
| Session auth enabled | `POST /api/method/login` (`usr`, `pwd`, form-encoded) | bad creds → `401 "Invalid login credentials"` |
| **Real login** | `POST /api/method/login` with `URY_USERNAME`/`URY_PASSWORD` | `200`, `sid` cookie |
| **Verify user** | `GET /api/method/frappe.auth.get_logged_user` | `200 {"message":"Administrator"}` |

The client (`server/src/integrations/ury/uryClient.js`) supports both modes; key/secret wins when set.
Currently configured: **session mode, user `Administrator`** (see §7, blocker 1).

## 2. Endpoints used (all `GET`, all verified)

| Purpose | Method + params | Response envelope |
|---|---|---|
| Logged-in user | `frappe.auth.get_logged_user` | `{"message": "<user>"}` |
| DocType schema | `frappe.desk.form.load.getdoctype?doctype=<DT>&with_parent=1&cached_timestamp=` | `{"docs":[<DocType meta>, <child-table meta>…]}` |
| Single record | `frappe.desk.form.load.getdoc?doctype=<DT>&name=<name>` | `{"docs":[<doc incl. child rows>], "docinfo":{…}, "_link_titles":{…}}` |
| List | `frappe.desk.reportview.get_list?doctype=<DT>&fields=<JSON array>&filters=<JSON object>&limit=<n>` | `{"message":[{<field>: <value>}…]}` |

Notes:
- `getdoc` for a **missing** record returns **`200 {"message":[]}`** (no `docs`) — not 404. The client converts this to `not_found`.
- `get_list` param format is taken from the captured URY calls (POS Tables: `fields`, `limit=10000`, `doctype`; List Filter: JSON `filters` object). `filters` is applied server-side (verified: filtering `URY Table` by a non-existent restaurant returns 0 rows).
- **Pagination**: only `limit` is verified (URY's own POS uses `limit=10000`). An offset parameter for `get_list` was not captured and is not used.
- `frappe.desk.reportview.get` (POST): request body was **never captured** and is **not used**. `get_list` + `getdoc` cover everything needed.

## 3. Actual DocType fields (from `getdoctype`)

**URY Restaurant** — `company → Company`, `branch → Branch`, `active_menu → URY Menu`, `room_wise_menu` (Check), `menu_for_room` (Table: `menu → URY Menu`, `room → URY Room`), `order_type_wise_menu` (Check), `order_type_menu` (Table: `order_type` Select Phone In/Take Away/Delivery, `menu → URY Menu`), `default_room → URY Room`, `image`, `address`, `default_tax_template`, `invoice_series_prefix`, `aggregator_series_prefix`.

**URY Menu** — `branch → Branch` (required), `enabled` (Check), `price_list → Price List`, `items` (Table → **URY Menu Item**, required).

**URY Menu Item** (child of URY Menu) — `item → Item`, `item_name` (Data), `rate` (Currency), `special_dish` (Check), `disabled` (Check), `course_icon` (Data), `course → URY Menu Course`.

**URY Menu Course** — `course` (Data, required), `custom_serving_priority` (Int), `custom_indicate_in_kds` (Check). No restaurant/branch link — courses are **global**.

**URY Table** — `restaurant → URY Restaurant`, `restaurant_room → URY Room`, `branch → Branch`, `no_of_seats`, `minimum_seating`, `table_shape`, `is_take_away`, `occupied` (Check), `latest_invoice_time` (Time), `layout_x/y/width/height`, `custom_device_id`.

**POS Profile** — `company`, `restaurant → URY Restaurant`, `branch → Branch`, `selling_price_list`, `currency → Currency`, `applicable_for_users` (Table: `user → User`), … (full list in capture).

## 4. Real data observed

- `get_list URY Restaurant` → **1 record**: `{"name":"Main Restaurant","company":"Atlantech Global","branch":"Main Branch","active_menu":"Main Menu"}`
- `get_list URY Menu` → `{"name":"Main Menu","branch":"Main Branch","enabled":1,"price_list":"Main Menu"}`
- `getdoc URY Menu "Main Menu"` → 20 `items` rows, 3 courses (Starter 7, Main Course 7, Juice 6), all `disabled=0`, all `special_dish=0`, `course_icon` absent. Sample row:
  `{"name":"9h3sfio7q0","idx":1,"item":"Chicken 65","item_name":"Chicken 65","rate":220,"special_dish":0,"disabled":0,"course":"Starter","parent":"Main Menu","parenttype":"URY Menu"}`
- `get_list URY Table` (restaurant = Main Restaurant) → 9 rows; rooms `Basement` (5), `Outside Area` (4); 2 occupied.
- `ury.ury_pos.api.getPosProfile` → `{"pos_profile":"Main Billing","branch":"Main Branch","company":"Atlantech Global",…}` — resolved **for the logged-in URY user**, so it cannot be used as a per-IROAS-tenant lookup.

## 5. Restaurant / company / POS mapping

```
IROAS restaurant ──restaurant_integrations.external_restaurant──▶ URY Restaurant (name)
URY Restaurant.active_menu ──▶ URY Menu ──items──▶ URY Menu Item ──course──▶ URY Menu Course
URY Restaurant.company / .branch ──▶ Company / Branch
URY Table.restaurant ──▶ URY Restaurant
POS Profile.restaurant ──▶ URY Restaurant
```

Tenant key = **URY Restaurant name**, stored server-side in `restaurant_integrations` (unique per IROAS restaurant **and** per URY restaurant). Set with `node scripts/ury-link-restaurant.js <owner-email|id> "<URY Restaurant>"`, which verifies the URY record exists. Currently linked: IROAS #3 *Saffron & Fig* → *Main Restaurant* (test link).

## 6. Menu category / item relationships → IROAS mapping (for Menu READ)

| IROAS field | URY source | Notes |
|---|---|---|
| `category.id` / `name` | `URY Menu Item.course` | courses are global; group items by this value |
| category order | `URY Menu Course.custom_serving_priority` | all 0 today; fall back to first-seen `idx` order |
| `item.id` | `URY Menu Item.name` (row id, e.g. `9h3sfio7q0`) | |
| `item.name` | `item_name` (fallback `item`) | |
| `item.price` | `rate` | currency not yet confirmed (see blockers) |
| `item.available` | `!disabled` | |
| `item.special` | `special_dish` | |
| `item.description`, `item.image` | **not in URY Menu Item** | live on ERPNext `Item`; not captured |

One request per menu load: `getdoc URY Menu <active_menu>` returns all items (no N+1). The menu name comes from `getdoc URY Restaurant <mapped name>` → `active_menu`.

## 7. Remaining blockers / unknowns

1. **Credentials**: integration currently logs in as `Administrator` (full system rights) and the password was shared in chat. Create a dedicated read-only URY user (read on URY Restaurant, URY Menu, URY Menu Course, URY Table) or API key/secret, then **rotate the Administrator password**.
2. **Only one URY Restaurant exists** — real Restaurant-A vs Restaurant-B isolation with two URY tenants can't be demonstrated until a second URY Restaurant is created. Isolation is enforced by the mapping + server-side `restaurant` filter + post-filter.
3. ~~Currency~~ — resolved: `getdoc Price List <URY Menu.price_list>` → `currency` (Main Menu → `INR`). Price List also has `restaurant_menu → URY Menu`.
4. **Description / image**: not on URY Menu Item; would need a batched `get_list Item` read (fields not yet verified).
5. **Room-wise / order-type menus**: `room_wise_menu` and `order_type_wise_menu` exist; values for Main Restaurant not inspected — Menu READ should use `active_menu` only until confirmed.
6. **Pagination** offset for `get_list` not captured (limit-only).
7. **Write APIs** (menu/table create/update/delete): no request/response captured — not implemented.

## 8. Recommended Menu READ implementation

1. `server/src/integrations/ury/uryMenu.js`: `getUryMenu(uryRestaurant)` → `getdoc URY Restaurant` → `active_menu` → `getdoc URY Menu` → assert `docs[0]` parent is that menu → `mapUryMenuToIroasMenu()` per §6.
2. 60-second in-memory cache keyed by URY Restaurant name (menu data only; tenant resolution runs on every request).
3. `GET /api/restaurant/pos-menu` (owner JWT → `getOwnRestaurant` → `resolveUryTenant`, see `URY_PLAN_B_GAP_ANALYSIS.md` §9), same `{success, data}` / `pos_not_connected` (409) / `pos_unavailable` (502) contract as `pos-tables`.
4. `GET /api/restaurant/pos-menu/items/:id` resolves only from the mapped restaurant's cached menu (no arbitrary `getdoc`).
5. Public menu: `GET /api/menu/public/:slug` uses the same service when the restaurant is linked; falls back to SQLite otherwise.
6. Dashboard Menu page: read-only POS view with loading / empty / error+retry; local SQLite CRUD untouched until cut-over.

---

## Appendix — Menu READ (implemented)

- Service: `server/src/integrations/ury/uryMenu.js` (`getUryMenu`, `mapUryMenuToIroasMenu`), 60 s cache keyed by URY Restaurant.
- URY calls (all `GET frappe.desk.form.load.getdoc`): `URY Restaurant <mapped>` → `URY Menu <active_menu>` → `Price List <price_list>`.
- Checks: mapped restaurant exists (else `pos_mapping_invalid`); menu name = `active_menu` and `menu.branch` = `restaurant.branch` (else `pos_mapping_invalid`); `enabled=0` → `reason: menu_disabled`, no items; no `active_menu` → `reason: no_active_menu`.
- IROAS endpoint: `GET /api/restaurant/pos-menu` → `{"success":true,"data":{"menu":{"name"},"reason","currency","categories":[{"id","name","items":[{"id","name","price","available","special"}]}],"meta":{"roomWiseMenus","orderTypeMenus"},"fetchedAt"}}`.
- UI: Menu page shows a "POS menu · Live / Website menu" switch only for linked restaurants; POS view is read-only.

## Appendix — Table READ (implemented)

- URY call: `GET frappe.desk.reportview.get_list?doctype=URY Table&fields=["name","occupied","latest_invoice_time","restaurant","restaurant_room","no_of_seats","is_take_away"]&filters={"restaurant":"<mapped>"}&limit=10000`
- Mapping: `id/name ← name`, `room ← restaurant_room`, `seats ← no_of_seats`, `takeAway ← is_take_away`, `status ← occupied (1→occupied, 0→free, other→unknown)`, `lastInvoiceTime ← latest_invoice_time`.
- IROAS endpoint: `GET /api/restaurant/pos-tables` → `{"success":true,"data":{"tables":[…]}}`; `409 pos_not_connected`; `502 pos_unavailable`.
- UI: "Live floor status" panel on the existing Table QR page (`PosTablesPanel.jsx`). Existing SQLite `/api/restaurant/tables` (QR codes, reservations) unchanged.

## Appendix — Orders, Customers, Staff READ (implemented); Reservations (not in URY)

All endpoints are owner-JWT only, resolve the URY Restaurant from `restaurant_integrations` (never from the request), and share the `409 pos_not_connected` / `409 pos_mapping_invalid` / `502 pos_unavailable` contract.

- **Orders** — `GET /api/restaurant/pos-orders`. URY POS stores orders as `POS Invoice` (`restaurant` link field). `get_list POS Invoice` filtered `{"restaurant": <mapped>}`, `order_by=modified desc`, limit 100; items via `getdoc POS Invoice` for open/unpaid invoices (max 30, `restaurant` re-checked). State: `docstatus 0/Draft → open`, `Paid/Submitted/Consolidated → paid`, `Return/Credit Note Issued → returned`, `Cancelled/docstatus 2 → cancelled`, other submitted → `unpaid`. `URY Order` is not used (`get_list` returns 500). At implementation time the server had 0 POS Invoices, 0 Sales Invoices and 0 URY KOTs, so only the empty path has been exercised against real data.
- **Customers** — `GET /api/restaurant/pos-customers`. `Customer` has no restaurant/branch/company field (global in URY), so listing it would leak across tenants. Customers are derived from the mapped restaurant's POS Invoices (visits, paid spend, last visit). Empty until invoices exist.
- **Staff** — `GET /api/restaurant/pos-staff`. Scoped by `URY Restaurant.branch`: `getdoc Branch` → `user[]` (URY User rows), `Employee` where `branch = <branch>` or `user_id in <branch users>`, `User` (`full_name`, `enabled`), `POS Profile` (filtered by `restaurant`) → `applicable_for_users` = POS access. `Administrator`/`Guest` excluded. Only non-sensitive Employee fields are read (no pay, bank or ID fields).
- **Ordering (WRITE)** — calls taken from the URY POS frontend bundle (`/assets/ury/pos/assets/index-*.js`):
  - `POST ury.ury.doctype.ury_order.ury_order.sync_order` with `{items:[{item,item_name,rate,qty,comment}], no_of_pax, pos_profile, order_type, table, room, customer, cashier, owner, mode_of_payment, last_invoice:null, invoice:null, waiter, comments}`; `message.status === "Failure"` = rejected.
  - `POST ury.ury_pos.api.create_customer` with `{customer_name, mobile_number}` → `{status:"success", name, …}`.
  - IROAS endpoints: `GET /pos-order-menu?table=`, `POST /pos-customers` (find by exact `mobile_number`, else create), `POST /pos-orders` (free tables only). POS profile = the single active profile with `restaurant = <mapped>`; cashier/owner from `getPosProfile` (must match that profile); waiter = URY session user; payment mode from `getModeOfPayment`; item names/rates from `getRestaurantMenu` for the table's room and order type (client prices ignored).
  - URY requires a POS Opening Entry for the current day. On 2026-10-12 `sync_order` returned 417 "POS Opening Entry POS-OPE-2026-00001 is outdated" (shift opened 2026-10-09); IROAS maps this to `409 pos_shift_outdated`. A successful order has not yet been placed.
- **Reservations** — no reservation DocType exists in URY (`URY Reservation`, `URY Table Reservation`, `Table Reservation`, `Reservation` all 404). Reservations stay in IROAS; the Reservations "Tables" view shows the live POS floor panel for linked restaurants.
