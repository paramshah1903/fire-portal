# Deployment guide

Target: internal UPL server (Linux, single node). SQLite + Node/Express
+ static React bundle behind Nginx.

For multi-instance deployments, first migrate the database to
PostgreSQL — see [DATABASE.md](DATABASE.md).

---

## 1. Prerequisites on the host

- Node.js 20+ (tested with 20 / 22 / 24) and npm 9+
- Nginx (or another reverse proxy that supports HTTPS + static files)
- A non-root system user (`upl`) to run the service
- Optional: `systemd` for service management

```bash
sudo useradd --system --create-home --shell /bin/bash upl
sudo mkdir -p /srv/upl-portal
sudo chown -R upl:upl /srv/upl-portal
```

---

## 2. Get the code

```bash
sudo -u upl -H bash -lc "
  cd /srv/upl-portal
  git clone https://internal-git.upl.example/fire-safety-portal.git .
  # Or copy from the release artifact:
  # tar xzf /tmp/upl-portal-<version>.tar.gz --strip-components=1
"
```

---

## 3. Backend — build and configure

```bash
sudo -u upl -H bash -lc "
  cd /srv/upl-portal/backend
  npm ci --production=false        # dev deps needed to run tsc
  cp .env.example .env             # then edit for production
  npm run db:migrate:deploy        # applies migrations without prompts
  npm run db:seed                  # only for a first-time install
  npm run build
  npm prune --production           # drop dev deps to shrink footprint
"
```

Edit `/srv/upl-portal/backend/.env`:

```
NODE_ENV=production
PORT=4000
DATABASE_URL="file:./dev.db"          # relative to backend/prisma/
SESSION_SECRET="<generate a strong random string, ≥64 chars>"
SESSION_COOKIE_NAME="upl.sid"
SESSION_MAX_AGE_MS=28800000
SESSION_REFRESH_INTERVAL_MS=300000
SESSION_ABSOLUTE_MAX_AGE_MS=2592000000
CORS_ORIGIN="https://portal.upl.example"
UPLOAD_DIR="./uploads"
UPLOAD_MAX_BYTES=10485760
RATE_LIMIT_GLOBAL_PER_MINUTE=300
RATE_LIMIT_WRITE_PER_MINUTE=60
```

Set the SESSION_SECRET to something strong:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 4. systemd unit

`/etc/systemd/system/upl-portal.service`:

```ini
[Unit]
Description=UPL Fire Safety Portal API
After=network.target

[Service]
Type=simple
User=upl
Group=upl
WorkingDirectory=/srv/upl-portal/backend
EnvironmentFile=/srv/upl-portal/backend/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
# Harden a little
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/srv/upl-portal/backend/prisma /srv/upl-portal/backend/uploads /srv/upl-portal/backend/backups
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now upl-portal
sudo journalctl -u upl-portal -f
```

---

## 5. Frontend — build static bundle

```bash
sudo -u upl -H bash -lc "
  cd /srv/upl-portal/frontend
  cp .env.example .env
  # Edit VITE_API_BASE_URL to your production URL
  npm ci
  npm run build
"
```

The built files land in `/srv/upl-portal/frontend/dist/`.

`frontend/.env`:

```
VITE_API_BASE_URL="https://portal.upl.example/api"
# Optional — sets QR label payload to a fixed portal host, useful when
# labels are printed for a deployed portal that may be accessed from
# non-portal hosts (external phones).
VITE_QR_URL_PREFIX="https://portal.upl.example/s"
```

---

## 6. Nginx

`/etc/nginx/sites-available/upl-portal.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name portal.upl.example;

    ssl_certificate     /etc/ssl/upl/portal.crt;
    ssl_certificate_key /etc/ssl/upl/portal.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Static React bundle
    root /srv/upl-portal/frontend/dist;
    index index.html;

    # Immutable assets — long-cache hashed files
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # SPA fallback
    location / {
        try_files $uri /index.html;
    }

    # API proxy — increases body limit to match multer photo upload cap
    location /api/ {
        proxy_pass         http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
        client_max_body_size 12M;
    }
}

server {
    listen 80;
    server_name portal.upl.example;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/upl-portal.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. Backups

Run the backup script daily via cron or a systemd timer. The script
copies the SQLite file + any WAL/journal sidecars into a timestamped
file under `backend/backups/`.

`/etc/systemd/system/upl-portal-backup.service`:

```ini
[Unit]
Description=UPL Fire Safety Portal DB backup

[Service]
Type=oneshot
User=upl
WorkingDirectory=/srv/upl-portal/backend
EnvironmentFile=/srv/upl-portal/backend/.env
ExecStart=/usr/bin/npx tsx scripts/backup.ts
```

`/etc/systemd/system/upl-portal-backup.timer`:

```ini
[Unit]
Description=Daily UPL portal DB backup

[Timer]
OnCalendar=*-*-* 02:15:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl enable --now upl-portal-backup.timer
```

Copy the backup directory off-host (`rsync`, network share, etc.). Test
restore quarterly — see next section.

### Restore

```bash
sudo systemctl stop upl-portal
sudo -u upl -H bash -lc "
  cp /srv/upl-portal/backend/backups/dev-YYYYMMDDTHHMMSSZ.db \
     /srv/upl-portal/backend/prisma/dev.db
"
sudo systemctl start upl-portal
```

Any restored `.db-wal` / `.db-shm` sidecars alongside the `.db` file
should be copied together so the DB comes back consistent.

---

## 8. Updates

Zero-config rolling update (single node, brief downtime):

```bash
sudo systemctl stop upl-portal
sudo -u upl -H bash -lc "
  cd /srv/upl-portal/backend
  git pull
  npm ci --production=false
  npm run db:migrate:deploy
  npm run build
  npm prune --production
"
sudo systemctl start upl-portal

sudo -u upl -H bash -lc "
  cd /srv/upl-portal/frontend
  git pull
  npm ci
  npm run build
"
# Nginx serves the new bundle immediately (hashed asset filenames).
```

If a migration is destructive or long-running, back up first:
`sudo -u upl npm --prefix /srv/upl-portal/backend run db:backup`.

---

## 9. Log rotation

`journalctl` handles the systemd stdout/stderr. To keep it bounded:

```
sudo journalctl --vacuum-size=500M
sudo journalctl --vacuum-time=90d
```

Or configure limits in `/etc/systemd/journald.conf`.

---

## 10. Monitoring

- `GET /api/health` — cheap liveness. Include in your reverse-proxy or
  external monitor. Returns `503 status=degraded` if the DB probe fails.
- Every response echoes an `X-Request-Id` header. Log this in Nginx
  (see the `$upstream_http_x_request_id` variable) so a user's reported
  id can be correlated with backend logs.

---

## 11. Scaling considerations

The current deployment is single-node by design:

- SQLite is a file, so **multi-instance is not safe** without moving
  to PostgreSQL first.
- File uploads go to the local filesystem, so **behind a load-balanced
  fleet** you'd need internal object storage (S3-compatible or NFS).
- Sessions are DB-backed, so any node change to PostgreSQL keeps
  sessions correct without extra work.

See [DATABASE.md](DATABASE.md) for the PostgreSQL migration steps.
