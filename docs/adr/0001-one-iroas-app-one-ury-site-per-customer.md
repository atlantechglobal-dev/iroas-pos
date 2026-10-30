# ADR 0001: One IROAS app, one URY site per customer

Status: accepted (2026-10-30)

## Context
IROAS must onboard restaurants repeatedly; each needs an isolated POS (menu,
tables, staff, invoices) with only branding and data different. The client
(IROAS admin) must manage onboarding without touching URY, and restaurant owners
must manage their POS from the IROAS owner panel, not URY desk.

Options considered:
- A. Everyone in one URY site, separated by branch. Cheapest, but customers
  (URY Customer) are global and isolation depends on permission rules; weak
  against the acceptance test "no tenant can see another's data".
- B. Replace URY with a self-hosted restaurant POS (nodedr-restaurant-pos). Its
  design is one server per restaurant with instance-wide models, AGPL-3.0, India
  tax/payments, single maintainer: a rewrite of tenancy plus losing about 12
  working URY integration modules.
- C. One IROAS app, one URY (Frappe) site per customer. Frappe sites have their
  own database, so isolation is by construction.

## Decision
C. The IROAS app is single and multi-tenant; each customer gets a new URY site
from the same GitHub-built template. The mapping (`ury_base_url`,
`ury_site_name`, `credential_ref`) lives in `restaurant_integrations`.

## Consequences
- Isolation of POS data is database-level, not filter-level.
- Provisioning a site must be scripted (`ury/provision/`); the golden template
  is a Frappe app built in M5.
- Capacity is bounded by the bench host (RAM per site is unmeasured; measure at
  the M5 clean install before choosing the VM size).
- First real second site is created after client approval, so multi-site is
  verified only against a fake bench until then.
