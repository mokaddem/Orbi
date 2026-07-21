# Geography Quiz — backend (PocketBase)

The app's **optional, additive** backend. It is **not required**: the game is
offline-first and works fully with no backend at all (IndexedDB stays the local
source of truth). The backend only *adds* capabilities — accounts, a friend
progress board, live play — as they land in Phases 51+. **Phase 50 (this) is pure
plumbing:** stand up the service, prove a round-trip from the client, and
guarantee the app is unchanged when the backend is absent or down.

---

## What is PocketBase?

A single ~13 MB Go binary that bundles, in one process:

| Capability            | What it gives us                                              |
| --------------------- | ------------------------------------------------------------- |
| **SQLite** database   | All data in one file (`pb_data/data.db`)                      |
| **Auto REST API**     | `/api/collections/<name>/records` for every collection — no endpoint code |
| **Realtime**          | Server-pushed create/update/delete over SSE (for live duels/rooms, Phases 55–56) |
| **Auth**              | Users, passwords, OAuth2, tokens (for accounts, Phase 51)     |
| **File storage**      | Uploads                                                       |
| **Admin UI** (`/_/`)  | Manage collections/records/settings, view logs, run backups   |

Backup = copy a folder. Move hosts = copy the binary + that folder. MIT-licensed,
so it fits the app's open-source, self-hostable ethos. Docs: <https://pocketbase.io/docs/>.

**Pinned version: `0.39.8`** (see [Upgrading](#upgrading-pocketbase)).

---

## Prerequisites

- **Linux or macOS**, `bash`, `curl`, `unzip` (the run script downloads the
  binary for your platform). Windows: download the binary manually into
  `server/bin/` from the [releases page](https://github.com/pocketbase/pocketbase/releases/tag/v0.39.8).

## Quick start (local dev)

```bash
./server/run.sh
```

On first run this downloads the pinned PocketBase into `server/bin/` (gitignored),
then serves on **`http://127.0.0.1:8090`** and **auto-applies** the committed
migrations in `pb_migrations/`. You'll see:

```
Server started at http://127.0.0.1:8090
├─ REST API:  http://127.0.0.1:8090/api/
└─ Dashboard: http://127.0.0.1:8090/_/
```

Leave it running in its own terminal. The Vite dev server (`npm run dev`, port
5180) will find it automatically — in `dev` the client defaults to
`http://localhost:8090` when `VITE_PB_URL` is unset (see
[How the app connects](#how-the-app-connects)).

### First run: create the admin (superuser)

The first time you open the Dashboard, PocketBase prints a one-time install link
(`…/_/#/pbinstall/…`) to create the first **superuser**. Either follow that link,
or create it from the CLI:

```bash
./server/run.sh superuser upsert you@example.com 'a-long-strong-password'
```

Keep these credentials **out of the repo** and strong — see [Security](#security).

## Prove the pipe (the Phase-50 round-trip)

With the server running:

```bash
# 1) Reachability — the health endpoint (what the app's status line probes):
curl http://127.0.0.1:8090/api/health
# → {"message":"API is healthy.","code":200,"data":{}}

# 2) A real record round-trip — read the seeded `ping` record over the auto-REST API:
curl http://127.0.0.1:8090/api/collections/ping/records
# → {"items":[{"...","message":"pong"}],"totalItems":1,...}
```

In the app, open **Settings → About**: the line under *Version* shows **Backend:
Reachable**. Stop the server and it flips to **Unreachable** on the next probe;
with no backend configured at all it reads **Off**. That line is the entire
user-visible surface of this phase.

## How the app connects

The client talks to the backend **only** through one module,
`src/backend/client.ts` (the seam), which reads a build-time URL:

- **`VITE_PB_URL`** — set it (e.g. in `.env.local`, see `/.env.example`) to point
  at a backend. Baked in at build time.
- **Unset** → in `dev`, the client falls back to `http://localhost:8090`; in a
  **production build it means the backend is OFF** and the app behaves exactly as
  it does today. This is what keeps the GitHub Pages build fully backend-optional.

The SDK is **lazy-loaded** and only when a URL is configured, so the offline core
bundle carries no backend weight.

## Schema & data

- **`pb_migrations/`** — the schema, as versioned JS migrations. **Committed** and
  auto-applied on start, so a fresh checkout gets an identical schema. Version them
  alongside the client that consumes them.
- **`pb_data/`** — the live SQLite database + uploads + logs + auto-backups.
  **Gitignored.** This folder is the single point of data loss on a laptop host —
  see [Backups](#backups).

To evolve the schema: edit collections in the Admin UI with auto-migrations on
(the default), and PocketBase writes a new file into `pb_migrations/` — commit it.
Or hand-write a `migrate(up, down)` file (see the existing `*_created_ping.js`).

## CORS

The browser blocks cross-origin API calls unless the server allows the origin.
`run.sh` sets `--origins` to the dev origin and the Pages production origin:

```
http://localhost:5180,https://mokaddem.github.io
```

Override with `PB_ORIGINS=… ./server/run.sh` for other hosts (e.g. a preview
origin). Getting this wrong is the classic first-connection failure — the request
succeeds in `curl` but fails in the browser with a CORS error.

## Backups

`pb_data/` is **the** durability risk on a laptop. Two layers:

1. **PocketBase scheduled backups** — in the Admin UI: *Settings → Backups* → set a
   cron (e.g. daily) and, optionally, S3-compatible remote storage. Backups are
   zipped snapshots of `pb_data/`.
2. **Offsite copy** — periodically copy the latest backup off the laptop (rsync to
   another machine, a cloud drive, or the S3 target above). A backup that only
   lives on the same disk as the database is not a backup.

Restore = stop the server, replace `pb_data/` with the unzipped backup, restart.

## Upgrading PocketBase

The version is pinned in **`run.sh`** (`PB_VERSION`). To upgrade:

1. Bump `PB_VERSION` in `run.sh`.
2. Delete `server/bin/` (or just re-run — the script re-downloads when the version
   changes).
3. **Read the [release notes](https://github.com/pocketbase/pocketbase/releases)**
   for breaking changes (PocketBase is pre-1.0; minor versions can change APIs and
   the migration/collection schema format).
4. Run locally, confirm migrations still apply and the round-trip works, then
   commit the bumped `run.sh`.

---

## Going live later (documented — NOT set up in Phase 50)

Phase 50 delivers the **local pipe + this runbook**. The owner chose *runbook-only*
for hosting — the steps below are the path to always-on, to be executed when a
later phase needs a real deployed backend. **Before any of this ships, the backend
must be reachable over HTTPS** (the PWA is HTTPS, so a plain-`http` backend is
blocked as *mixed content*).

### Option A — Cloudflare Tunnel (recommended for the laptop host)

A tunnel gives a **public HTTPS hostname** that proxies to the local `:8090`, with
**no port-forwarding, works behind CGNAT, hides the home IP, and provides free
TLS** (which the PWA/service-worker/Web-Push future needs anyway).

```
Browser (PWA, https) → Cloudflare edge (TLS) → [outbound tunnel] → cloudflared on laptop → PocketBase :8090
```

- **Quick tunnel (throwaway, for a smoke test):**
  ```bash
  cloudflared tunnel --url http://localhost:8090
  # prints a random https://<name>.trycloudflare.com URL (changes each run)
  ```
- **Named tunnel (stable, needed for real prod):** requires a Cloudflare account +
  a domain you control. `cloudflared tunnel login`, `cloudflared tunnel create
  orbi`, map a hostname (`orbi-api.example.com`) to `http://localhost:8090` in the
  tunnel config, then run it as a service. Bake that stable HTTPS origin into the
  Pages build's `VITE_PB_URL` **and** add it to `--origins` (CORS).

### Option B — process supervision on the laptop

Pick whichever you already run. Both give auto-restart on crash/boot.

**systemd** (plain Linux box, no Docker):

```ini
# /etc/systemd/system/orbi-pb.service
[Unit]
Description=Orbi PocketBase
After=network.target

[Service]
Type=simple
User=sami
WorkingDirectory=/home/sami/git/geography-quiz/server
ExecStart=/home/sami/git/geography-quiz/server/run.sh
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now orbi-pb
```

**docker-compose** (portable, identical local/VPS):

```yaml
# server/docker-compose.yml
services:
  pocketbase:
    image: ghcr.io/muchobien/pocketbase:0.39.8 # or build your own from the pinned binary
    restart: unless-stopped
    ports:
      - '8090:8090'
    volumes:
      - ./pb_data:/pb_data
      - ./pb_migrations:/pb_migrations
    command: ['serve', '--http=0.0.0.0:8090', '--origins=http://localhost:5180,https://mokaddem.github.io']
```

### VPS lift-and-shift

The same binary + `pb_data/` + `pb_migrations/` run unchanged on a ~€4 VPS if
always-on matters. Copy the folder, point the tunnel (or a reverse proxy with TLS)
at it, done.

---

## Security

Even pre-auth (real end-user accounts are Phase 51), don't leave the door open:

- **Strong superuser credentials**, never committed. `pb_data/` (which stores the
  auth data) is gitignored.
- **Protect the admin UI (`/_/`)** when public: ideally don't expose it on the
  public tunnel hostname (tunnel only `/api/*`, or IP-restrict `/_/`).
- **CORS** restricted to known origins (above).
- **HTTPS only** in production (mixed-content; the tunnel provides TLS).
- No secrets in the repo. Use `.env.local` (gitignored) for the client;
  environment/CLI for server credentials.
