import frappe
from frappe import _
from ury.ury.api.ury_order_reservation_service import release_order_reservations
from ury.ury.doctype.ury_order.ury_order import cancel_kot, release_merge_cluster_tables
from ury.ury_pos.api import getBranch


@frappe.whitelist()
def cancel_open_order(invoice_id, reason):
    reason = (reason or "").strip()[:140]
    if len(reason) < 3:
        frappe.throw(_("Enter a reason for cancelling this order."))

    invoice = frappe.get_doc("POS Invoice", invoice_id)
    if not frappe.has_permission("POS Invoice", "cancel", doc=invoice):
        frappe.throw(_("You do not have permission to cancel this order."), frappe.PermissionError)
    if frappe.session.user != "Administrator" and invoice.branch != getBranch():
        frappe.throw(_("You are not allowed to cancel an order from another branch."), frappe.PermissionError)
    if invoice.docstatus != 0 or invoice.status != "Draft":
        frappe.throw(_("Only an open order can be cancelled."))

    cancel_kot(invoice_id)
    release_order_reservations(invoice_id, reason=f"Order cancelled: {reason}")
    if invoice.restaurant_table:
        release_merge_cluster_tables(invoice.restaurant_table)

    # A draft has no ledger or stock entries, so it can be closed without submitting it.
    frappe.db.set_value(
        "POS Invoice",
        invoice_id,
        {"status": "Cancelled", "docstatus": 2, "cancel_reason": reason},
    )
    return {"status": "Success", "invoice": invoice_id}
