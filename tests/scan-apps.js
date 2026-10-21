'use strict';
var assert = require('assert');
var scan = require('../app/scan-apps');
var manifests = {
  '/dev/a/appinfo.json': { id: 'a', title: 'A', icon: 'icon.png' },
  '/store/a/appinfo.json': { id: 'a', title: 'Duplicate' },
  '/store/b/appinfo.json': { id: 'b', title: 'B' },
  '/usr/palm/applications/overlay/appinfo.json': { id: 'overlay', visible: false },
  '/usr/palm/applications/music/appinfo.json': { id: 'music' }
};
var fs = {
  readdirSync: function (root) {
    if (root === '/missing') { throw new Error('missing'); }
    return root === '/dev' ? ['a', '../unsafe'] : root === '/store' ? ['a', 'broken', 'b'] : ['overlay', 'music'];
  },
  readFileSync: function (path) { if (!manifests[path]) { throw new Error('bad manifest'); } return JSON.stringify(manifests[path]); }
};
var apps = scan(fs, ['/missing', '/dev', '/store', '/usr/palm/applications']);
assert.deepStrictEqual(apps.map(function (app) { return app.id; }), ['a', 'b', 'music']);
assert.strictEqual(apps[0].title, 'A');
assert.strictEqual(apps[0].folderPath, '/dev/a');
console.log('TV app scanner: passed (store/developer/system, deduplication, missing and malformed files, hidden system components)');
var realFS = require('fs');
var path = require('path');
var os = require('os');
var temp = realFS.mkdtempSync(path.join(os.tmpdir(), 'home-artwork-'));
try {
  var root = path.join(temp, 'apps');
  var folder = path.join(root, 'test');
  var cache = path.join(temp, 'runtime-icons');
  realFS.mkdirSync(folder, { recursive: true });
  realFS.writeFileSync(path.join(folder, 'appinfo.json'), JSON.stringify({ id: 'test', title: 'Test', largeIcon: '$icon.png' }));
  realFS.writeFileSync(path.join(folder, 'icon.png'), Buffer.from([137,80,78,71]));
  var cached = scan(realFS, [root], cache);
  assert.strictEqual(cached[0].localIcon, 'runtime-icons/test.png');
  assert.deepStrictEqual(realFS.readFileSync(path.join(cache, 'test.png')), realFS.readFileSync(path.join(folder, 'icon.png')));
  assert.strictEqual(scan(realFS, [root], cache)[0].localIcon, cached[0].localIcon);
} finally { realFS.rmSync(temp, { recursive: true, force: true }); }
console.log('App artwork: passed (localized reference, original file copy, reusable own-app cache)');
