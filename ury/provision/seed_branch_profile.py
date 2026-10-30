# Seeds a branch's opening hours (URY Branch Operating Schedule) and the
# restaurant's address (Address -> URY Restaurant.address).
#
# Idempotent: re-running updates the same records. Run on the URY server:
#
#   scp this file to /tmp, then, as the bench user:
#   bench --site <site> console      # and in it:  exec(open('/tmp/seed_branch_profile.py').read())
#
# Edit the CONFIG block per customer (the IROAS owner panel will do this
# through the API once the write-through is built).
import frappe

CONFIG = {
    "restaurant": "Demo Restaurant",
    "branch": "Demo Branch",
    "timezone": "Africa/Johannesburg",
    "pre_open_time": "00:30:00",
    "close_grace_minutes": 30,
    # day -> list of (service name, open, close); a missing day means closed
    "hours": {
        "monday": [("Lunch", "12:00:00", "15:00:00"), ("Dinner", "18:00:00", "22:00:00")],
        "tuesday": [("Lunch", "12:00:00", "15:00:00"), ("Dinner", "18:00:00", "22:00:00")],
        "wednesday": [("Lunch", "12:00:00", "15:00:00"), ("Dinner", "18:00:00", "22:00:00")],
        "thursday": [("Lunch", "12:00:00", "15:00:00"), ("Dinner", "18:00:00", "22:00:00")],
        "friday": [("Lunch", "12:00:00", "15:00:00"), ("Dinner", "18:00:00", "23:00:00")],
        "saturday": [("Lunch", "12:00:00", "15:30:00"), ("Dinner", "18:00:00", "23:00:00")],
        "sunday": [("Lunch", "12:00:00", "16:00:00")],
    },
    "address": {
        "address_title": "Demo Restaurant",
        "address_type": "Office",
        "address_line1": "12 Long Street",
        "city": "Cape Town",
        "state": "Western Cape",
        "pincode": "8001",
        "country": "South Africa",
        "phone": "+27 21 555 0100",
        "email_id": "hello@saffronandfig.demo",
    },
}


def seed_schedule(cfg):
    name = cfg["branch"]  # autoname = field:branch
    doc = frappe.get_doc("URY Branch Operating Schedule", name) if frappe.db.exists("URY Branch Operating Schedule", name) else frappe.new_doc("URY Branch Operating Schedule")
    doc.branch = cfg["branch"]
    doc.enabled = 1
    doc.timezone = cfg["timezone"]
    doc.pre_open_time = cfg["pre_open_time"]
    doc.close_grace_minutes = cfg["close_grace_minutes"]
    for day in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"):
        doc.set(day, [])
        for service, open_time, close_time in cfg["hours"].get(day, []):
            doc.append(day, {"service_name": service, "open_time": open_time, "close_time": close_time, "enabled": 1})
    doc.save(ignore_permissions=True)
    return doc.name


def seed_address(cfg):
    a = cfg["address"]
    title = a["address_title"]
    existing = frappe.db.get_value("Address", {"address_title": title, "address_type": a["address_type"]}, "name")
    doc = frappe.get_doc("Address", existing) if existing else frappe.new_doc("Address")
    doc.update(a)
    doc.links = []
    doc.append("links", {"link_doctype": "URY Restaurant", "link_name": cfg["restaurant"]})
    doc.save(ignore_permissions=True)
    frappe.db.set_value("URY Restaurant", cfg["restaurant"], "address", doc.name)
    return doc.name


schedule = seed_schedule(CONFIG)
address = seed_address(CONFIG)
frappe.db.commit()
print("SEEDED schedule=%s address=%s" % (schedule, address))
