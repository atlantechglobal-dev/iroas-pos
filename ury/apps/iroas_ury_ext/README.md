# iroas_ury_ext

Server-side additions to URY that IROAS needs and URY does not provide.

| Method | Purpose |
|---|---|
| `iroas_ury_ext.api.orders.cancel_open_order(invoice_id, reason)` | Cancel an open (draft, unpaid) order in one step: cancels its KOTs, releases stock reservations and tables, and marks the draft invoice cancelled. URY's own `cancel_order` submits the draft first, which ERPNext rejects when nothing is paid. |

Install on a site: `bench get-app <path-or-url>` then `bench --site <site> install-app iroas_ury_ext`.
