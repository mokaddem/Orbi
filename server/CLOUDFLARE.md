# Cloudflare Tunnel — Orbi backend runbook

How to put the (loopback-bound) PocketBase online **without** a public IP, port
forwarding, or exposing the home network. A tunnel is an **outbound-only**
connection: `cloudflared` dials out to Cloudflare's edge and holds it open;
requests to your public hostname are routed back down that connection to
`localhost:8090`. Nothing connects _to_ your house.

```
Browser (PWA, https) → Cloudflare edge (TLS) → [outbound tunnel] → cloudflared → PocketBase 127.0.0.1:8090
```

Why it fits us: no inbound ports, works behind CGNAT / dynamic IP (no DDNS), the
home IP is never exposed, and Cloudflare provides the HTTPS the PWA requires.

Two stages, in order:

1. **Quick tunnel** — free, no account, random URL. A ~2-minute end-to-end smoke test.
2. **Named tunnel** — stable hostname on your own domain. The real production path.

> Keep PocketBase on **loopback** (`127.0.0.1:8090`, the `run.sh` default). With a
> tunnel you never bind `0.0.0.0` — `cloudflared` reaches PB over loopback on the
> same box, so PB is invisible to both the internet _and_ your LAN.

---

## 0. Install cloudflared

Versions move; follow the official installer:
<https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/>

```bash
# Debian/Ubuntu (.deb):
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb
# macOS:  brew install cloudflared
cloudflared --version
```

---

## 1. Quick tunnel — smoke test (free, no account)

Goal: prove the whole pipe (browser → Cloudflare → tunnel → PB) works over real
HTTPS, from the actual app.

1. **Terminal A — PocketBase:**
   ```bash
   ./server/run.sh          # serves 127.0.0.1:8090
   ```
2. **Terminal B — the tunnel:**
   ```bash
   cloudflared tunnel --url http://localhost:8090
   # prints e.g.  https://happy-forest-parrot-1234.trycloudflare.com
   ```
3. **Prove the raw pipe** (no browser yet):
   ```bash
   curl https://happy-forest-parrot-1234.trycloudflare.com/api/health
   # → {"message":"API is healthy.","code":200,...}
   ```
4. **Point the app at it.** The client reads `VITE_PB_URL` at build/serve time:
   ```bash
   echo 'VITE_PB_URL=https://happy-forest-parrot-1234.trycloudflare.com' > .env.local
   npm run dev              # localhost:5180
   ```
   CORS is already satisfied — `run.sh` allows the dev origin `http://localhost:5180`.
   (CORS is checked against the **SPA's** origin, not the tunnel URL.)
5. **Exercise it in the browser** at `http://localhost:5180`:
   - Account page → **Create account** (or sign in).
   - Add a friend / send a duel; confirm it lands in the inbox.
   - DevTools → Network: the calls go to the `trycloudflare.com` host with no CORS errors.

**Pass criteria:** health ok · account create ok · duel round-trips · console clean.

**Teardown:**
```bash
# Ctrl-C both terminals, then:
rm .env.local               # dev falls back to local PB; a prod build stays backend-OFF
```

> ⚠️ The `trycloudflare.com` URL is **random and dies when `cloudflared` stops**.
> If you restart the tunnel, update `.env.local` with the new URL and restart dev.
> Never bake a `trycloudflare.com` URL into a Pages deploy — you'd have to rebuild
> on every restart. That's what stage 2 fixes.

---

## 2. Named tunnel — production (Cloudflare account + domain)

**Prereqs:** a Cloudflare account (free plan is fine) and a domain whose
nameservers point at Cloudflare.

1. **Authenticate** (opens a browser; pick your zone):
   ```bash
   cloudflared tunnel login
   ```
2. **Create the tunnel** (writes a credentials JSON into `~/.cloudflared/`):
   ```bash
   cloudflared tunnel create orbi
   # note the tunnel UUID it prints
   ```
3. **Route DNS** to it:
   ```bash
   cloudflared tunnel route dns orbi api.yourdomain.com
   ```
4. **Config** — `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <TUNNEL_UUID>
   credentials-file: /home/sami/.cloudflared/<TUNNEL_UUID>.json

   ingress:
     # The ONLY thing exposed: PB on loopback. Nothing else on the box is reachable.
     - hostname: api.yourdomain.com
       service: http://localhost:8090
     # Anything that doesn't match a rule above is refused.
     - service: http_status:404
   ```
5. **Test it:**
   ```bash
   cloudflared tunnel run orbi
   curl https://api.yourdomain.com/api/health      # healthy
   ```
6. **Run both as services** (auto-restart on crash/boot). PB unit is in
   `server/README.md` (Option B); the `cloudflared` companion:
   ```ini
   # /etc/systemd/system/orbi-cloudflared.service
   [Unit]
   Description=Orbi cloudflared tunnel
   After=network.target orbi-pb.service
   Wants=orbi-pb.service

   [Service]
   Type=simple
   User=sami
   ExecStart=/usr/bin/cloudflared tunnel run orbi
   Restart=always
   RestartSec=3

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl daemon-reload && sudo systemctl enable --now orbi-cloudflared
   # (or the shortcut: `sudo cloudflared service install`, which reads config.yml)
   ```
7. **Wire the SPA** (the durable part):
   - Build the GitHub Pages bundle with the stable URL baked in:
     ```bash
     VITE_PB_URL=https://api.yourdomain.com npm run build
     ```
   - Ensure PB `--origins` includes the Pages origin — `https://mokaddem.github.io`
     is already the `run.sh` default. Deploy the build.
8. **Verify from the live Pages site:** account + duel round-trip; console clean.

---

## 3. Hardening (before real users)

- **PB stays on loopback** (`127.0.0.1:8090`) — never `0.0.0.0`. The tunnel is the
  only door.
- **Lock the admin UI (`/_/`)** with **Cloudflare Access** (Zero Trust → Access →
  Application on `api.yourdomain.com`, path `/_/*`, policy = your email). The public
  can't even see the admin login. (Simplest, vs path-splitting in ingress.)
- **CORS** `--origins` = only the Pages origin (+ `localhost:5180` for dev). No `*`.
- **Strong superuser password**, never committed; keep `pb_data/` backups
  (README → Backups). Cloudflare's edge adds free WAF / rate-limit / DDoS cover.
- _(Optional)_ set PocketBase's trusted-proxy setting so client IPs / rate-limits
  are correct behind the tunnel.

## Turning it off / rollback

The backend is **off whenever the Pages build has no `VITE_PB_URL`**. To go fully
local again: rebuild without it and redeploy — the app is pure offline-first, no
user-facing breakage. Stop `cloudflared` and PocketBase at your leisure.
