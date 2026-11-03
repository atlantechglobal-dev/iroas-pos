import frappe
from frappe import _
from frappe.utils import flt
from ury.ury.api.ury_order_reservation_service import resolve_production_context
from ury.ury_pos.api import getBranch

MAX_QTY = 100000


def _on_branch_menu(item_code, branch):
    return frappe.db.sql(
        """select 1 from `tabURY Menu Item` mi join `tabURY Menu` m on m.name = mi.parent
        where mi.item = %s and m.branch = %s limit 1""",
        (item_code, branch),
    )


def _ensure_configuration(item_code, branch):
    if frappe.db.exists("URY Item Production Configuration", {"item": item_code, "branch": branch}):
        return
    template = frappe.get_all(
        "URY Item Production Configuration",
        filters={"branch": branch, "active": 1},
        fields=["department", "production_unit", "production_policy", "sourcing_mode", "availability_mode"],
        order_by="creation asc",
        limit=1,
    )
    if not template:
        frappe.throw(_("This branch has no production setup yet. Please contact IROAS support."))
    frappe.get_doc(
        {
            "doctype": "URY Item Production Configuration",
            "item": item_code,
            "branch": branch,
            "active": 1,
            "controlled_by_sales_plan": 0,
            "allow_over_plan_sale": 0,
            **template[0],
        }
    ).insert(ignore_permissions=True)


@frappe.whitelist()
def stock_menu_item(item_code, qty=0):
    """Make a menu item sellable and optionally add stock. Safe to call repeatedly."""
    qty = flt(qty)
    if qty < 0 or qty > MAX_QTY:
        frappe.throw(_("Enter a quantity between 0 and {0}.").format(MAX_QTY))
    if not frappe.has_permission("URY Menu", "write"):
        frappe.throw(_("You do not have permission to change the menu."), frappe.PermissionError)

    branch = getBranch()
    if not _on_branch_menu(item_code, branch):
        frappe.throw(_("Menu item not found."), frappe.DoesNotExistError)
    company = frappe.db.get_value("Branch", branch, "company")

    _ensure_configuration(item_code, branch)
    if not frappe.db.get_value("Item", item_code, "is_stock_item"):
        frappe.db.set_value("Item", item_code, "is_stock_item", 1)

    warehouse = (resolve_production_context(item_code, branch, company=company) or {}).get("warehouse")
    if not warehouse:
        frappe.throw(_("No stock warehouse is set up for this branch."))

    if qty > 0:
        entry = frappe.get_doc(
            {
                "doctype": "Stock Entry",
                "stock_entry_type": "Material Receipt",
                "company": company,
                "items": [
                    {
                        "item_code": item_code,
                        "qty": qty,
                        "t_warehouse": warehouse,
                        "basic_rate": 0,
                        "allow_zero_valuation_rate": 1,
                    }
                ],
            }
        )
        entry.flags.ignore_permissions = True
        entry.insert()
        entry.submit()

    return {"status": "Success", "item": item_code, "received": qty}
