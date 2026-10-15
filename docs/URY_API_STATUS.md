# URY API Status — Working vs Missing (reference for future client onboarding)

Date: 2026-10-15 · Source: cross-checked `server/src/integrations/ury/*.js` against
`URY_Restaurant_POS_EXACT_NETWORK_APIs_v1.xlsx` (browser network capture) and
`URY_Missing_and_Needed_APIs.xlsx` (discovery notes), plus the live Saffron & Fig
demo tenant (restaurant #48 → URY "Demo Restaurant" / "Demo Branch").

Use this as the single checklist when onboarding the next client: everything in
**§1 is ready to wire up today**; **§2 needs IROAS code work first**; **§3 is
blocked on URY itself** (nothing IROAS can do until URY ships it).

---

## 1. Working today (built in IROAS, confirmed)

| Area | API (`method=`) | IROAS module | Verified |
|---|---|---|---|
| Auth / identity | `frappe.auth.get_logged_user` | `uryTenant.js` (`verifyUryMapping`) | **Live** — used on every tenant link |
| Restaurant / branch / menu read | `getdoc URY Restaurant`, `getdoc Branch`, `getdoc URY Menu`, `getdoc Price List` | `uryMenu.js`, `uryTenant.js` | **Live** — Saffron & Fig public menu, 1 category, ZAR |
| Tables / occupancy | `get_list URY Table` | `uryTables.js` | **Live** — Dashboard shows 12 real tables (T1–T12, free/occupied) |
| Dashboard menu (staff view) | `ury.ury_pos.api.getRestaurantMenu` | `uryOrdering.js` | **Live** — `/pos-menu` dashboard tab |
| Dashboard orders | `get_list`/`getdoc POS Invoice` | `uryOrders.js` | Code complete, dashboard tab renders |
| Dashboard staff | `getdoc Branch`, `get_list Employee`/`User`, `get_list POS Profile` | `uryStaff.js` | Code complete, dashboard tab renders |
| Dashboard customers | derived from `POS Invoice` | `uryOrders.js` | Code complete, dashboard tab renders |
| POS profile / payment modes | `ury.ury_pos.api.getPosProfile`, `ury.ury_pos.api.getModeOfPayment` | `uryOrdering.js` | Code complete |
| Guest self-ordering (QR / pickup) | `ury.ury.api.self_ordering.get_ordering_context`, `.add_customer_items`, `.get_customer_order`, `.get_order_status`, `.generate_qr_token` | `urySelfOrdering.js` | **Live** — `guestOrdering.enabled: true` on Saffron & Fig |
| Opening hours (public site) | `getdoc URY Branch Operating Schedule`, `get_list URY Branch Operating Exception` | `uryHours.js` | Code complete — shows `not_configured` until the branch has schedule records in URY desk |
| Contact / address (public site) | `getdoc Address` via `URY Restaurant.address` | `uryContact.js` | Code complete — shows `not_configured` until the Address is linked in URY desk |

**Takeaway:** menu, tables, guest ordering, and all four Dashboard POS tabs are
ready to go the moment a new restaurant is linked via `ury-link-restaurant.js`.
Hours/contact just need the branch's Operating Schedule and Address filled in
on the URY side (operator step, not a code change).

---

## 2. Supported by URY, not yet built in IROAS

| Area | API | Why it's not built | Priority for next client |
|---|---|---|---|
| Staff order placement | `ury.ury.doctype.ury_order.ury_order.sync_order` | **Built** (`uryOrdering.js`) but never confirmed to succeed live — needs a fresh POS Opening Entry on the URY branch before retesting | High — this is "place an order from the Dashboard," core to the pitch |
| Cancel order | `ury.ury.doctype.ury_order.ury_order.cancel_order` | Not called anywhere in IROAS code | Medium |
| Request bill (guest) | `ury.ury.api.self_ordering.request_bill` | Not called — guest flow stops at "order placed," no bill-request step | Medium |
| Guest menu via session API | `ury.ury.api.self_ordering.get_customer_menu` / `get_customer_product` | IROAS reuses the generic `getdoc`-based menu (`uryMenu.js`) for guest ordering instead of the purpose-built session API — works, but doesn't get URY's session-scoped stock/availability checks | Low (works today, revisit if stock accuracy complaints come up) |
| Table order context / live bill | `get_table_order_context`, `get_order_invoice` | Not called — no "what's currently on this table" or "show the running bill" view in IROAS | Medium — useful for a staff-facing table view |
| URY's own POS-opening check | `ury.ury_pos.api.posOpening` | IROAS currently calls ERPNext's generic `erpnext...point_of_sale.check_opening_entry` instead of URY's dedicated endpoint — works, but worth confirming URY's version doesn't return extra fields we're missing | Low |
| Order idempotency key | — (enhancement) | No unique request key on order submission; a retried request could create a duplicate order | **High — reliability risk**, fix before any client takes live paying orders |
| Guest name/phone on self-orders | — (enhancement) | Every guest order is attributed to the generic `IROAS Website Guest` customer; URY's self-ordering API doesn't currently accept a per-guest name/phone | Low — cosmetic, revisit if a client wants guest CRM data |

---

## 3. Blocked — not available on deployed URY (nothing to fix in IROAS)

| Area | API | Status |
|---|---|---|
| Table reservations (settings, availability, create, update, status) | `ury.ury.api.table_reservation.*` (5 endpoints) | **Entire module missing** on the live URY server (v16). Source exists only on URY's unreleased `pre-develop`/`feat/reservations` branches — needs URY's own team to port and deploy it. Until then, **every IROAS tenant's reservations stay on IROAS's own local system** — confirmed live today (`saffronfig` reservations use local `operating_hours`, no URY call at all). |
| Kitchen display / dedicated KOT status | — | No purpose-built API found in discovery. Only needed if a client specifically wants a kitchen-screen view; the generic `URY KOT` doctype exists but is unvalidated (zero live records seen). |

---

## 4. Fast-path checklist for the next client (reuses existing tooling)

1. **URY side** (manual, in URY desk): create the client's `URY Restaurant` /
   `Branch` / `POS Profile` (and `Address` + `Branch Operating Schedule` if the
   client wants hours/contact to show on day one — otherwise they'll just read
   "not configured" until filled in later).
2. `node scripts/ury-integration-user.js --ref <REF> --email ... --branch "..." --pos-profile "..." --apply`
   — creates a dedicated, least-privilege URY user and writes its API keys to `server/.env`.
3. `node scripts/ury-demo-setup.js --restaurant "..." --apply` — creates the
   guest-ordering customer + Self Ordering Profile (skip if the client wants
   table-QR instead of pickup-only; edit the script's profile flags for that).
4. `node scripts/ury-link-restaurant.js link <owner-email> --restaurant "..." --branch "..." --pos-profile "..." --self-ordering-profile "..." --credential-ref <REF>`
5. `node scripts/ury-link-restaurant.js features <owner-email> --menu on --guest-ordering on --hours on --contact on`
6. Restart the backend (`pm2 restart iroas-pos --update-env`), set the IROAS
   restaurant's `subdomain` to something unique (avoids the name-collision bug
   hit during the Saffron & Fig demo — two restaurants sharing a display name
   both resolve to the same public slug otherwise).
7. Verify: `node scripts/ury-link-restaurant.js verify <owner-email>`, then
   check `/api/public/<subdomain>` returns a `ury` block with `menu.status: "ok"`.

**Before any client takes real paying orders**, close the two §2 "High priority"
gaps first: confirm `sync_order` actually succeeds end-to-end, and add an
idempotency key to guest/staff order submission.
