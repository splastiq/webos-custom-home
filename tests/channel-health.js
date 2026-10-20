'use strict';
var assert = require('assert');
var health = require('../app/channel-health');
function harness(routes) {
  var active = 0;
  var peak = 0;
  var calls = [];
  var aborted = 0;
  function XHR() { this.readyState = 0; this.status = 0; this.ended = true; }
  XHR.prototype.open = function (method, url) { this.url = url; this.readyState = 1; };
  XHR.prototype.getResponseHeader = function () { return this.route.type || ''; };
  XHR.prototype.finish = function () { if (!this.ended) { active--; this.ended = true; } };
  XHR.prototype.abort = function () { this.cancelled = true; aborted++; this.finish(); if (this.onabort) { this.onabort(); } };
  XHR.prototype.send = function () {
    var self = this;
    calls.push(self.url); self.ended = false; active++; peak = Math.max(peak, active);
    var route = routes[self.url];
    if (Array.isArray(route)) { route = route.shift(); }
    self.route = route || { error: true };
    setTimeout(function () {
      if (self.cancelled) { return; }
      route = self.route;
      if (route.error || route.timeout) {
        self.finish();
        if (route.error) { self.onerror(); } else { self.ontimeout(); }
        return;
      }
      self.status = route.status || 200; self.readyState = 2;
      self.responseURL = route.redirect || self.url;
      self.onreadystatechange();
      if (self.cancelled) { return; }
      if (self.responseType === 'arraybuffer') {
        self.response = new ArrayBuffer(route.empty ? 0 : 1024);
        if (!route.empty) { self.onprogress({ loaded: 1024 }); }
      } else { self.responseText = route.text || ''; }
      if (self.cancelled) { return; }
      self.finish(); self.onload();
    }, self.route.delay || 1);
  };
  return { XHR: XHR, calls: calls, peak: function () { return peak; }, active: function () { return active; }, aborted: function () { return aborted; } };
}
function run(urls, routes, online) {
  return new Promise(function (resolve, reject) {
    var h = harness(routes);
    var timer = setTimeout(function () { reject(new Error('Health check did not finish')); }, 1000);
    var results = {};
    var checker = health.create({ XMLHttpRequest: h.XHR, online: online || function () { return true; }, retryDelay: 0 });
    checker.run(urls.map(function (url) { return { url: url }; }), function (index, result) {
      if (result.state !== 'checking') {
        results[index] = result;
        if (Object.keys(results).length === urls.length) { clearTimeout(timer); checker.cancel(); resolve({ results: results, harness: h }); }
      }
    });
  });
}
(async function () {
  var base = 'https://example.org/live/';
  var master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080\nfull.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1280x720\nhd.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=640x360\nsd.m3u8';
  assert.deepStrictEqual(health.target(master, base + 'master.m3u8'), { url: base + 'hd.m3u8', manifest: true });
  assert.strictEqual(health.resolve('javascript:alert(1)', base), null);
  assert.strictEqual(health.resolve('//cdn.example.org/a.ts', base), 'https://cdn.example.org/a.ts');
  assert.strictEqual(health.resolve('/a.ts', base), 'https://example.org/a.ts');
  assert.ok(health.target('<html>Error</html>', base).error);
  assert.ok(health.target('#EXTM3U\n#EXT-X-TARGETDURATION:10', base).error);
  var routes = {};
  routes[base + 'master.m3u8'] = { text: master };
  routes[base + 'hd.m3u8'] = { text: '#EXTM3U\n#EXTINF:10,\nold.ts\n#EXTINF:10,\nnew.ts' };
  routes[base + 'new.ts'] = {};
  var result = await run([base + 'master.m3u8'], routes);
  assert.strictEqual(result.results[0].state, 'available');
  assert.deepStrictEqual(result.harness.calls, [base + 'master.m3u8', base + 'hd.m3u8', base + 'new.ts']);
  assert.strictEqual(result.harness.active(), 0);
  assert.ok(result.harness.aborted() > 0, 'Stop the segment download after first bytes');
  var bad = base + 'bad.m3u8';
  var cors = base + 'cors.m3u8';
  var slow = base + 'slow.m3u8';
  routes = {}; routes[bad] = { status: 404 }; routes[cors] = { error: true }; routes[slow] = { timeout: true };
  result = await run([bad, cors, slow], routes);
  assert.strictEqual(result.results[0].state, 'unavailable');
  assert.strictEqual(result.results[1].state, 'unknown');
  assert.strictEqual(result.results[2].state, 'unknown');
  assert.strictEqual(result.harness.calls.filter(function (url) { return url === bad; }).length, 2);
  assert.ok(result.harness.peak() <= 2, 'Limit concurrency');
  routes = {}; routes[bad] = [{ status: 503 }, { text: '#EXTM3U\n#EXTINF:5,\nnew.ts' }]; routes[base + 'new.ts'] = {};
  result = await run([bad], routes);
  assert.strictEqual(result.results[0].state, 'available', 'Transient failures should recover');
  routes = {}; routes[base + 'mpegts'] = { type: 'text/html' };
  result = await run([base + 'mpegts'], routes);
  assert.strictEqual(result.results[0].state, 'unavailable', 'Reject HTML error pages as video');
  result = await run([bad, cors, slow], {}, function () { return false; });
  assert.strictEqual(result.harness.calls.length, 0);
  assert.strictEqual(Object.keys(result.results).length, 3, 'Offline queue completes without recursion bugs');
  var h = harness({});
  var callbacks = 0;
  var checker = health.create({ XMLHttpRequest: h.XHR, online: function () { return true; } });
  checker.run([{ url: cors }, { url: slow }, { url: bad }], function () { callbacks++; });
  checker.cancel();
  var before = callbacks;
  await new Promise(function (resolve) { setTimeout(resolve, 15); });
  assert.strictEqual(callbacks, before, 'Ignore results after cancellation');
  assert.strictEqual(h.active(), 0);
  console.log('Channel health: passed (HLS segment delivery, HD choice, HTTP retry, CORS, timeout, offline, concurrency, cancellation)');
}()).catch(function (error) { console.error(error); process.exitCode = 1; });
