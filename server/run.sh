#!/usr/bin/env bash
#
# Download (once) a pinned PocketBase binary, then run it locally.
#
# PocketBase is a single Go binary that bundles a SQLite database + an
# auto-generated REST API + realtime subscriptions + authentication + a web
# admin UI. We do NOT commit the binary (it is platform-specific and ~12 MB) —
# this script fetches the *pinned* version into server/bin/ on first run, then
# serves. Everything the app needs to bring the backend up lives in this repo.
#
#   • Schema  → server/pb_migrations/  (committed; auto-applied on start)
#   • Data    → server/pb_data/        (gitignored; SQLite db + uploads + logs)
#   • Backup  → copy server/pb_data/   (see server/README.md → Backups)
#
# Usage:
#   ./server/run.sh                 # serve on 127.0.0.1:8090 (loopback only)
#   PB_HTTP=0.0.0.0:8090 ./server/run.sh   # bind all interfaces (e.g. LAN test)
#   ./server/run.sh superuser upsert you@example.com 'a-strong-password'
#                                   # create/update the admin login (non-serve cmd)
#
set -euo pipefail

# --- Pinned version — see server/README.md → "Upgrading PocketBase" -------------
PB_VERSION="0.39.8"

# --- Resolve paths relative to THIS script, so it works from any CWD ------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/bin"
BIN="$BIN_DIR/pocketbase"

# --- Detect platform to pick the right release asset ----------------------------
os="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$os" in
  linux) PB_OS="linux" ;;
  darwin) PB_OS="darwin" ;;
  *)
    echo "Unsupported OS '$os'. Download PocketBase v$PB_VERSION manually into $BIN_DIR/ (see README)." >&2
    exit 1
    ;;
esac

arch="$(uname -m)"
case "$arch" in
  x86_64 | amd64) PB_ARCH="amd64" ;;
  arm64 | aarch64) PB_ARCH="arm64" ;;
  *)
    echo "Unsupported architecture '$arch'. Download PocketBase v$PB_VERSION manually (see README)." >&2
    exit 1
    ;;
esac

# --- Download + unzip once (or when the pinned version changes) -----------------
if [ ! -x "$BIN" ] || ! "$BIN" --version 2>/dev/null | grep -q "$PB_VERSION"; then
  zip="pocketbase_${PB_VERSION}_${PB_OS}_${PB_ARCH}.zip"
  url="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${zip}"
  echo "Downloading PocketBase v${PB_VERSION} ($PB_OS/$PB_ARCH)…"
  mkdir -p "$BIN_DIR"
  tmp="$(mktemp -d)"
  curl -fsSL "$url" -o "$tmp/$zip"
  unzip -o -q "$tmp/$zip" -d "$BIN_DIR"
  rm -rf "$tmp"
  chmod +x "$BIN"
  echo "Installed $("$BIN" --version)"
fi

# --- Non-serve passthrough (e.g. `superuser`, `migrate`) ------------------------
# If the first arg is a known management subcommand, run it against our dirs and
# exit — don't start the server.
if [ "${1:-serve}" != "serve" ]; then
  exec "$BIN" \
    --dir "$SCRIPT_DIR/pb_data" \
    --migrationsDir "$SCRIPT_DIR/pb_migrations" \
    "$@"
fi
shift || true # drop an explicit leading "serve" so we don't pass it twice

# --- Serve ----------------------------------------------------------------------
# Bind to loopback by default (safe). CORS is restricted to the dev origin and the
# GitHub Pages production origin so the browser SDK is allowed to call us; add more
# with --origins if you serve the SPA from another host.
exec "$BIN" serve \
  --dir "$SCRIPT_DIR/pb_data" \
  --migrationsDir "$SCRIPT_DIR/pb_migrations" \
  --http "${PB_HTTP:-127.0.0.1:8090}" \
  --origins "${PB_ORIGINS:-http://localhost:5180,https://mokaddem.github.io}" \
  "$@"
