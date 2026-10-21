'use strict';
var assert = require('assert');
var fs = require('fs');
var vm = require('vm');
function node(id) { return { id: id, getAttribute: function () { return id; } }; }
function container() {
  return {
    children: [],
    querySelectorAll: function () { return this.children.slice(); },
    appendChild: function (child) { if (child.children) { this.children = this.children.concat(child.children); } else { this.children.push(child); } },
    removeChild: function (child) { this.children.splice(this.children.indexOf(child), 1); }
  };
}
var created = [];
var response;
var window = {
  HOME_CONFIG: { apps: [{ id: 'configured', key: 'one', name: 'One', icon: 'local.png' }] },
  HomeStorage: { get: function (key, fallback) { return fallback; } },
  HomeFavorites: { catalog: function () { return { stale: { title: 'Old', icon: '' } }; } },
  HomeOrder: { apply: function () {} },
  HomeTiles: { app: function (app) { created.push(app); return node(app.id); } },
  TV: { listApps: function (done) { response = done; } }
};
vm.runInNewContext(fs.readFileSync(require.resolve('../app/apps'), 'utf8'), { window: window, document: { createDocumentFragment: container } });
var row = container(); window.HomeApps.init(row);
assert.deepStrictEqual(row.children.map(function (item) { return item.id; }), ['configured', 'stale']);
var done = false;
window.HomeApps.refresh(function (error) { assert.strictEqual(error, null); done = true; });
response(null, [{ id: 'configured' }, { id: 'new', title: 'New', folderPath: '/apps/new', icon: './icon.png' }, { id: 'new' }, { id: 'absolute', icon: '/apps/icon.png' }]);
assert.strictEqual(done, true);
assert.deepStrictEqual(row.children.map(function (item) { return item.id; }), ['configured', 'new', 'absolute']);
assert.strictEqual(created[2].icon, 'file:///apps/new/icon.png');
assert.strictEqual(created[3].icon, 'file:///apps/icon.png');
window.HomeApps.refresh(function () {}); response('offline');
assert.strictEqual(row.children.length, 3, 'Failed enumeration preserves cached applications');
window.HomeApps.refresh(function () {}); response(null, [{ id: 'configured' }, { id: 'new' }, { id: 'absolute' }]);
assert.strictEqual(created.length, 4, 'Repeated enumeration must not duplicate tiles');
console.log('Apps: passed (enumeration, stale removal, duplicate IDs, icon paths, failure fallback)');
