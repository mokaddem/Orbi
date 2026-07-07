#!/usr/bin/env bash
# Regenerate the PWA / home-screen PNG icons from the SVG sources.
#
#   public/favicon.svg                -> pwa-192x192.png, pwa-512x512.png  (purpose "any",
#                                        transparent background)
#   scripts/maskable-icon.svg         -> maskable-icon-512x512.png         (purpose "maskable",
#                                        full-bleed background + safe-zone padding)
#                                     -> apple-touch-icon.png (180)        (iOS needs an
#                                        opaque background)
#
# Requires Inkscape. Re-run whenever the favicon design changes.
set -euo pipefail
cd "$(dirname "$0")/.."

render() { inkscape "$1" -w "$2" -h "$3" -o "$4" >/dev/null 2>&1; }

render public/favicon.svg 192 192 public/pwa-192x192.png
render public/favicon.svg 512 512 public/pwa-512x512.png
render scripts/maskable-icon.svg 512 512 public/maskable-icon-512x512.png
render scripts/maskable-icon.svg 180 180 public/apple-touch-icon.png

echo "Generated:"
ls -la public/pwa-192x192.png public/pwa-512x512.png \
       public/maskable-icon-512x512.png public/apple-touch-icon.png
