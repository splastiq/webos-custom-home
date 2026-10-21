'use strict';
var assert = require('assert');
var fs = require('fs');
var vm = require('vm');
var createStorage = require('../app/storage');
var createPlaylists = require('../app/playlist-store');
var parse = require('../app/iptv');
var memory = Object.create(null);
var full = false;
var backend = {
  getItem: function (key) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; },
  setItem: function (key, value) { if (full) { throw new Error('quota'); } memory[key] = value; }
};
var storage = createStorage(backend);
assert.strictEqual(storage.get('missing', 'fallback'), 'fallback');
memory.broken = '{'; assert.strictEqual(storage.get('broken', 'fallback'), 'fallback');
assert.strictEqual(createStorage(undefined).set('x', true), false);
function playlist(name, url) { return '#EXTM3U\n#EXTINF:-1,' + name + '\n' + url; }
var base = playlist('Base (1080p)', 'https://test/base.m3u8');
var custom = playlist('Custom', 'https://test/custom.m3u8') + '\n' + base;
var calls = 0;
function counted(text) { calls++; return parse(text); }
var store = createPlaylists(counted, storage);
store.setDefault(base);
assert.strictEqual(store.channels().length, 1);
var added = store.add('Custom list', custom, '');
assert.ok(added.id);
assert.strictEqual(store.channels().length, 2, 'Shared streams deduplicated across documents');
assert.strictEqual(store.isDefaultFavorite('https://test/custom.m3u8'), false);
assert.strictEqual(store.isDefaultFavorite('https://test/base.m3u8'), true);
var parsedBefore = calls;
for (var i = 0; i < 5000; i++) { assert.ok(store.contains(added.id, 'https://test/custom.m3u8')); store.channels(); }
assert.strictEqual(calls, parsedBefore, 'Tab membership and catalog reads must reuse the parsed index');
var restarted = createPlaylists(parse, storage); restarted.setDefault(base);
assert.strictEqual(restarted.channels().length, 2, 'Custom documents survive restart');
full = true;
assert.strictEqual(store.remove(added.id), false);
assert.strictEqual(store.add('Fail', custom).error, 'storage');
assert.strictEqual(store.channels().length, 2, 'Failed persistence leaves current data intact');
full = false;
assert.strictEqual(store.remove('bel'), true);
assert.strictEqual(store.isDefaultFavorite('https://test/base.m3u8'), false);
assert.strictEqual(store.channels().length, 2, 'Deleting one list retains streams shared with another list');
assert.strictEqual(store.remove(added.id), true);
assert.strictEqual(store.channels().length, 0);
assert.strictEqual(createPlaylists(parse, storage).documents().length, 0);
assert.strictEqual(store.add('Invalid', '<html>error</html>').error, 'empty');
storage.set('home.playlists.v1', [{ id: 'bel', name: 'Reserved', text: base }, null, { id: 'x', name: 'A', text: custom }, { id: 'x', name: 'Duplicate', text: base }]);
assert.strictEqual(createPlaylists(parse, storage).documents().length, 1);
// Corrupt-but-valid JSON settings must not crash favorites or erase migration defaults.
storage.set('home.favorites.v1', { apps: null, channels: [], catalog: { bad: null, good: { title: 'Good', icon: false } } });
var window = { HomeStorage: storage, HOME_CONFIG: { apps: [{ id: 'app.one' }] } };
var buttons = [];
var document = { getElementById: function () { return { querySelectorAll: function () { return buttons; } }; } };
vm.runInNewContext(fs.readFileSync(require.resolve('../app/favorites'), 'utf8'), { window: window, document: document });
var button = {
  hidden: false,
  getAttribute: function (key) { return key === 'data-app' ? '0' : null; },
  hasAttribute: function (key) { return key === 'data-app'; }
};
buttons.push(button);
assert.strictEqual(window.HomeFavorites.has(button, 'apps'), true);
assert.strictEqual(window.HomeFavorites.toggle(button, 'apps'), false);
assert.strictEqual(button.hidden, true);
full = true;
assert.strictEqual(window.HomeFavorites.toggle(button, 'apps'), null);
assert.strictEqual(window.HomeFavorites.has(button, 'apps'), false, 'Failed save rolls back favorites');
console.log('Settings: passed (corruption, migration, quota rollback, shared streams, restart, deletion, cached parsing)');
