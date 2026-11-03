# Makes a branch's menu items sellable from stock alone, without a daily URY Sales Plan.
# Idempotent. Run on the URY server:
#   bench --site <site> console   then:   exec(open('/tmp/seed_item_availability.py').read())
import frappe

BRANCH = "Demo Branch"

changed = 0
for name in frappe.get_all("URY Item Production Configuration", filters={"branch": BRANCH, "active": 1}, pluck="name"):
    doc = frappe.get_doc("URY Item Production Configuration", name)
    if doc.controlled_by_sales_plan:
        doc.controlled_by_sales_plan = 0
        doc.save(ignore_permissions=True)
        changed += 1
frappe.db.commit()
print("ITEM CONFIGS UPDATED:", changed)
