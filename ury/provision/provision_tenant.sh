#!/usr/bin/env bash
# Provision one URY site for a new IROAS customer (one Frappe site = one database).
#
# STATUS: written but NOT yet run against a fresh site. First real run is the
# M5 clean-install. Defaults to DRY RUN: it only prints what it would do.
#
#   Run on the URY server as the bench user (e.g. `frappe`):
#     SITE=acme.pos.example.com ADMIN_PASSWORD=... DB_ROOT_PASSWORD=... \
#       ./provision_tenant.sh            # dry run
#     ... APPLY=1 ./provision_tenant.sh  # really do it
#
# Required env: SITE, ADMIN_PASSWORD, DB_ROOT_PASSWORD
# Optional env: BENCH_DIR (default ~/frappe-bench), APPLY (1 = execute)
#
# Re-runnable: every step checks whether it is already done.
set -euo pipefail

BENCH_DIR="${BENCH_DIR:-$HOME/frappe-bench}"
APPLY="${APPLY:-0}"
: "${SITE:?SITE is required (e.g. acme.pos.example.com)}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"
: "${DB_ROOT_PASSWORD:?DB_ROOT_PASSWORD is required}"

if ! [[ "$SITE" =~ ^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$ ]]; then
  echo "Invalid SITE name: $SITE" >&2
  exit 1
fi

run() {
  if [ "$APPLY" = "1" ]; then
    echo "+ $*"
    "$@"
  else
    echo "[dry-run] $*"
  fi
}

cd "$BENCH_DIR"

# 1. Site (own database).
if [ -d "sites/$SITE" ]; then
  echo "site $SITE already exists - skipping new-site"
else
  run bench new-site "$SITE" \
    --admin-password "$ADMIN_PASSWORD" \
    --mariadb-root-password "$DB_ROOT_PASSWORD" \
    --no-mariadb-socket
fi

# 2. Apps, in dependency order.
for app in erpnext hrms ury; do
  if [ "$APPLY" = "1" ] && bench --site "$SITE" list-apps 2>/dev/null | grep -qx "$app"; then
    echo "app $app already installed on $SITE"
  else
    run bench --site "$SITE" install-app "$app"
  fi
done

# 3. Nginx server block + reload (a multi-site bench routes by server_name).
run bench setup nginx --yes
run sudo nginx -t
run sudo systemctl reload nginx

# 4. Golden template (company, ZAR, VAT 15%, payment modes, rooms/tables,
#    POS profile, self-ordering profile, integration user + API key).
#    TODO(M5): implement as the `iroas_ury_ext` app's `setup.install` so it is
#    idempotent and versioned; then this step becomes one line:
#      run bench --site "$SITE" execute iroas_ury_ext.setup.apply_template
echo "NOTE: golden template step not implemented yet (see TODO above)."

# 5. Record the mapping in IROAS (run from the IROAS server, not here):
cat <<EOF

Next, on the IROAS server (server/):
  node scripts/ury-link-restaurant.js link <owner-email> \\
    --restaurant "<URY Restaurant>" --branch "<Branch>" --pos-profile "<POS Profile>" \\
    --credential-ref <REF> --base-url http://<bench-address> --site-name $SITE
  (put URY_CRED_<REF>_API_KEY / _API_SECRET in server/.env first)
EOF
