#!/bin/sh
# Run on the TV as root to restore the EIM snapshot taken before enabling Home.
set -eu
state=/var/lib/webosbrew/custom-home
[ -d "$state/backup-eim-before-autostart" ] || { echo 'No backup; refusing to change input settings' >&2; exit 1; }
if [ -f "$state/enabled" ]; then mv "$state/enabled" "$state/disabled"; fi
if findmnt /var/lib/eim >/dev/null 2>&1; then umount /var/lib/eim; fi
cp -a "$state/backup-eim-before-autostart/." /var/lib/eim/
sync
echo home-autostart-disabled
