# Deploying to a DigitalOcean Droplet

One droplet, one Node process (PM2) serving both the API and the built
frontend, with Nginx in front for the domain + SSL. Assumes a fresh Ubuntu
22.04/24.04 droplet and that you already have this repo on GitHub.

Total time: ~20 minutes.

---

## 1. Server prerequisites (run once per droplet)

SSH into the droplet as root (or a sudo user):

```bash
ssh root@YOUR_DROPLET_IP
```

Update and install Node.js 22, git, Nginx:

```bash
apt update && apt upgrade -y

curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git nginx

node -v   # confirm v22.x
```

Install PM2 (keeps the app running, restarts on crash/reboot):

```bash
npm install -g pm2
```

Firewall — allow SSH, HTTP, HTTPS only:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## 2. Clone and build the app

```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git iroas-pos
cd iroas-pos
```

**Frontend:**

```bash
npm install

# Required for QR / phone scanners after deploy — your public HTTPS origin:
# (also create a root .env before build)
cat > .env <<'EOF'
VITE_API_BASE_URL=/api
VITE_PUBLIC_BASE_URL=https://YOUR_DOMAIN_OR_DROPLET_IP
EOF

npm run build       # outputs to dist/ — embeds VITE_PUBLIC_BASE_URL into the bundle
```

QR codes encode `{VITE_PUBLIC_BASE_URL}/s/{slug}` (guest website). Rebuild the frontend whenever you change the public domain, then regenerate/download QR codes from One Link / Launch.

**Local phone testing:** run `npx vite --host`, set `VITE_PUBLIC_BASE_URL=http://YOUR_LAN_IP:5173`, restart Vite, then open One Link and download a fresh QR.

**Backend:**

```bash
cd server
npm install
cp .env.example .env
```

Edit `.env` with real values:

```bash
nano .env
```

```
PORT=4000
NODE_ENV=production

# Generate with: openssl rand -hex 32
JWT_SECRET=<paste a long random string here>

ADMIN_EMAIL=admin@iroas.com
ADMIN_PASSWORD=<pick a real password — not the demo default>
ADMIN_NAME=IROAS Admin
```

Seed the database (creates the admin account + sample tenants):

```bash
npm run seed
```

---

## 3. Start with PM2

From `server/`:

```bash
pm2 start src/index.js --name iroas-pos --env production
pm2 save
pm2 startup    # follow the printed instructions to enable on-boot startup
```

Check it's alive:

```bash
pm2 status
curl http://localhost:4000/api/health   # should return {"ok":true}
```

---

## 4. Nginx reverse proxy

Create `/etc/nginx/sites-available/iroas-pos`:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_DROPLET_IP;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:

```bash
ln -s /etc/nginx/sites-available/iroas-pos /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

At this point `http://YOUR_DROPLET_IP` should load the app — that's enough
for a client demo without a domain.

---

## 5. Optional: real domain + HTTPS

If you're pointing a domain at the droplet (an A record → droplet IP first):

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

Certbot edits the Nginx config to redirect HTTP → HTTPS and auto-renews.

---

## 6. Redeploying after changes

```bash
cd /var/www/iroas-pos
git pull

npm install && npm run build

cd server
npm install
pm2 restart iroas-pos
```

No database migration step is needed for schema changes described in this
repo — `db.js` runs `CREATE TABLE IF NOT EXISTS` on every boot, so it's safe
to restart. If you add new columns later, add an `ALTER TABLE` migration
there rather than dropping the database.

---

## Notes for the demo

- The SQLite database lives at `server/data/iroas.db` on the droplet — back
  it up (`scp` it down, or `pm2 stop` + copy) before any destructive change.
- Logs: `pm2 logs iroas-pos`
- Restart after editing `.env`: `pm2 restart iroas-pos --update-env`
- To reset to a clean demo state: stop the app, delete
  `server/data/iroas.db*`, run `npm run seed` again, restart.
