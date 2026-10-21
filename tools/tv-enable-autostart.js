/* Run after deploying app/boot.js. Uses the existing LG CLI device credentials. */
'use strict';
var fs = require('fs');
var path = require('path');
var child = require('child_process');
var source = fs.readFileSync(path.join(__dirname, 'tv-prepare-input.sh')).toString('base64');
var disable = fs.readFileSync(path.join(__dirname, 'tv-disable-autostart.sh')).toString('base64');
var command = [
  'set -eu',
  'state=/var/lib/webosbrew/custom-home',
  'mkdir -p "$state"',
  'if [ ! -d "$state/backup-eim-before-autostart" ]; then cp -a /var/lib/eim "$state/backup-eim-before-autostart"; fi',
  "printf '%s' '" + source + "' | base64 -d > \"$state/prepare-input.sh\"",
  'chmod 755 "$state/prepare-input.sh"',
  "printf '%s' '" + disable + "' | base64 -d > \"$state/disable-autostart.sh\"",
  'chmod 755 "$state/disable-autostart.sh"',
  'touch "$state/enabled"',
  'echo home-autostart-enabled'
].join('\n');
child.execFileSync('ares-novacom', ['-d', process.argv[2] || 'tv', '--run', command], { stdio: 'inherit' });
