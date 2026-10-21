#!/bin/sh
# Called by Home after EIM registration. Based on webosbrew/webosbrew-autostart.
# Keep the original EIM store on Home; normal input changes use a persistent copy.
set -eu
state=/var/lib/webosbrew/custom-home
[ -f "$state/enabled" ] || exit 0
if findmnt /var/lib/eim >/dev/null 2>&1; then
  echo already-mounted
  exit 0
fi
if ! grep -q '"appId"[[:space:]]*:[[:space:]]*"com.custom.webos.home"' /var/lib/eim/lastinput; then
  echo waiting-for-home-input
  exit 0
fi
if [ ! -d "$state/eim" ]; then
  cp -a /var/lib/eim "$state/eim"
fi
mount --bind "$state/eim" /var/lib/eim
echo home-input-preserved
