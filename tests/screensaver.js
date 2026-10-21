'use strict';
var assert = require('assert');
var fs = require('fs');
var vm = require('vm');
var createIdle = require('../app/idle');
var aerial = require('../app/aerial-catalog');
function harness() {
  var now = 1780000000000;
  var jobs = {};
  var sequence = 0;
  var events = {};
  var iptv = false;
  var busy = false;
  var ambient = false;
  var calls = 0;
  var reject;
  var nodes = {};
  var document;
  function node(id) {
    var attrs = {};
    var classes = {};
    return { id: id, tagName: id === 'clock' ? 'BUTTON' : 'DIV', hidden: true, disabled: false, textContent: '', handlers: {},
      classList: { add: function (key) { classes[key] = true; }, remove: function (key) { delete classes[key]; }, contains: function (key) { return !!classes[key]; } },
      setAttribute: function (key, value) { attrs[key] = String(value); }, getAttribute: function (key) { return Object.prototype.hasOwnProperty.call(attrs, key) ? attrs[key] : null; }, removeAttribute: function (key) { delete attrs[key]; },
      addEventListener: function (name, fn) { this.handlers[name] = fn; }, focus: function () { document.activeElement = this; }
    };
  }
  ['clock','screen','screensaver','screensaver-video','screensaver-clock','screensaver-date','screensaver-location','screensaver-place','screensaver-preload','playlist-form','playlist-delete-form'].forEach(function (id) { nodes[id] = node(id); });
  document = { activeElement: nodes.clock, hidden: false, getElementById: function (id) { return nodes[id]; }, documentElement: { contains: function () { return true; } }, addEventListener: function (name, fn) { events['doc-' + name] = fn; } };
  nodes['screensaver-preload'].pause = function () {}; nodes['screensaver-preload'].load = function () {};
  var video = nodes['screensaver-video'];
  Object.defineProperty(video, 'src', { set: function (value) { video.setAttribute('src', value); } });
  video.pause = function () { video.paused = true; };
  video.load = function () { video.readyState = 0; };
  video.canPlayType = function () { return 'probably'; };
  video.play = function () { calls++; video.paused = false; return { catch: function (fn) { reject = fn; } }; };
  var window = {
    HOME_CONFIG: { screensaver: { enabled: true, idleMs: 120000, loadTimeoutMs: 100 } },
    HOME_AERIAL_ASSETS: { assets: [{ id: 'test', accessibilityLabel: 'Dubai', 'url-4K-SDR': 'https://sylvan.apple.com/4k.mov', 'url-1080-SDR': 'https://sylvan.apple.com/1080.mov', 'url-1080-H264': 'https://sylvan.apple.com/avc.mov' }] },
    HomeStorage: { get: function () { return null; }, set: function () { return true; } },
    XMLHttpRequest: function () { this.open = this.send = this.abort = function () {}; },
    HomeIdle: { create: createIdle }, HomeAerialCatalog: aerial,
    HomeOrder: { busy: function () { return busy; } },
    IPTV: { isOpen: function () { return iptv; }, setAmbient: function (value) { ambient = value; } }, TV: { available: true },
    setTimeout: function (fn, delay) { jobs[++sequence] = { fn: fn, at: now + delay }; return sequence; }, clearTimeout: function (id) { delete jobs[id]; },
    addEventListener: function (name, fn) { events[name] = fn; }
  };
  function FakeDate() { return new Date(now); } FakeDate.now = function () { return now; };
  var navigator = { onLine: true };
  vm.runInNewContext(fs.readFileSync(require.resolve('../app/screensaver'), 'utf8'), { window: window, document: document, navigator: navigator, Date: FakeDate, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout });
  window.HomeScreensaver.init();
  function event(name, key) {
    var e = { type: name, keyCode: key, target: document.activeElement, preventDefault: function () { this.prevented = true; }, stopImmediatePropagation: function () { this.stopped = true; } };
    events[name](e); return e;
  }
  function advance(ms) {
    var end = now + ms;
    for (;;) {
      var next = Object.keys(jobs).sort(function (a,b) { return jobs[a].at - jobs[b].at; })[0];
      if (!next || jobs[next].at > end) { break; }
      now = jobs[next].at; var fn = jobs[next].fn; delete jobs[next]; fn();
    }
    now = end;
  }
  return { saver: window.HomeScreensaver, nodes: nodes, video: video, event: event, advance: advance, calls: function () { return calls; }, reject: function () { return reject; }, ambient: function () { return ambient; }, navigator: navigator, document: document, selectAerials: function (ids) { window.HomeAerialSelection = { filter: function (assets) { return assets.filter(function (asset) { return ids.indexOf(asset.id) !== -1; }); } }; }, setIPTV: function (value) { iptv = value; }, setBusy: function (value) { busy = value; } };
}
var h = harness();
assert.strictEqual(h.calls(), 0, 'No video request before idle or manual start');
h.setIPTV(true); assert.strictEqual(h.saver.start(), false); h.setIPTV(false);
h.setBusy(true); assert.strictEqual(h.saver.start(), false); h.setBusy(false);
assert.strictEqual(h.saver.start(13), true);
assert.strictEqual(h.video.getAttribute('src'), 'https://sylvan.apple.com/4k.mov');
assert.ok(h.video.muted); assert.strictEqual(h.video.volume, 0); assert.ok(h.ambient());
assert.ok(h.event('keyup',13).prevented); assert.ok(h.saver.isActive(), 'Releasing launch OK must not immediately dismiss saver');
var oldReject = h.reject(); h.video.error = { code: 4 }; h.video.handlers.error(); oldReject(new Error('decode')); h.advance(0);
assert.strictEqual(h.calls(), 2, 'Error and rejected promise advance only one fallback');
assert.strictEqual(h.video.getAttribute('src'), 'https://sylvan.apple.com/1080.mov');
h.video.readyState = 4; h.video.handlers.playing();
assert.ok(h.nodes.screensaver.classList.contains('has-video'));
assert.strictEqual(h.nodes['screensaver-location'].textContent, 'Дубай');
h.event('mousemove'); h.event('wheel'); assert.ok(h.saver.isActive(), 'Pointer movement and wheel do not dismiss saver');
assert.strictEqual(h.nodes['screensaver-place'].textContent, 'Объединённые Арабские Эмираты');
var wake = h.event('keydown',13); assert.ok(wake.prevented && wake.stopped);
assert.ok(!h.saver.isActive()); assert.strictEqual(h.video.getAttribute('src'), null);
assert.ok(h.video.paused); assert.strictEqual(h.ambient(), false); assert.strictEqual(h.document.activeElement.id, 'clock');
assert.ok(h.event('keydown',13).prevented, 'Wake key repeats are swallowed until keyup');
h.event('keyup',13); h.advance(400);
h.saver.start(); oldReject(new Error('late rejection')); h.advance(0);
assert.strictEqual(h.calls(), 3, 'Prior session rejection cannot alter a new session');
h.event('blur'); assert.ok(h.saver.isActive(), 'Transient focus loss does not dismiss a visible saver');
h.document.hidden = true; h.event('doc-visibilitychange'); assert.ok(!h.saver.isActive()); assert.strictEqual(h.video.getAttribute('src'), null);
h.document.hidden = false;
h.event('focus'); h.advance(119999); assert.ok(!h.saver.isActive()); h.advance(1); assert.ok(h.saver.isActive());
h.event('keydown',27); h.event('keyup',27); h.advance(400);
h.navigator.onLine = false; h.saver.start(); var before = h.calls();
assert.strictEqual(h.video.getAttribute('src'), null); assert.strictEqual(h.calls(), before); assert.ok(h.saver.isActive());
h.event('keydown',27); h.event('keyup',27); h.advance(400); h.navigator.onLine = true; h.saver.start();
var count = h.calls(); h.advance(1000);
assert.strictEqual(h.calls() - count, 5, 'Failed streams stop after six total attempts');
assert.strictEqual(h.video.getAttribute('src'), null); assert.ok(h.saver.isActive(), 'Failure leaves the offline clock, not a frozen player');
console.log('Screensaver: passed (clock/OK, no preload, muted 4K, fallback races, wake key, focus, blur, idle, offline, retry bound, cleanup)');

var rotation = harness(); rotation.saver.start(); rotation.video.handlers.playing(); rotation.advance(280000);
assert.strictEqual(rotation.nodes['screensaver-preload'].src, 'https://sylvan.apple.com/4k.mov', 'Next source is preloaded 20 seconds before rotation');
rotation.advance(19999); assert.strictEqual(rotation.calls(), 1); rotation.advance(1); assert.strictEqual(rotation.calls(), 2, 'Rotation happens at five minutes');
rotation.video.handlers.playing(); rotation.event('keydown',27); rotation.advance(300000); assert.strictEqual(rotation.nodes['screensaver-preload'].getAttribute('src'), null);

var warm = harness(); warm.advance(99999); assert.strictEqual(warm.nodes['screensaver-preload'].src, undefined); warm.advance(1); assert.ok(warm.nodes['screensaver-preload'].src, 'Preload begins before automatic activation'); assert.ok(!warm.saver.isActive()); warm.event('mousemove'); assert.ok(!warm.saver.isActive());

var manual = harness(); manual.saver.start(); manual.video.handlers.playing(); manual.advance(5000);
manual.event('keydown',1537); manual.event('keyup',1537);
manual.event('keydown',1536); manual.event('keyup',1536);
manual.event('mousemove'); manual.event('mouseup'); manual.event('blur');
assert.ok(manual.saver.isActive(), 'Manual saver survives cursor timeout, pointer status keys, release, and transient blur after five seconds');
manual.event('focus'); manual.event('keydown',461);
assert.ok(!manual.saver.isActive(), 'Back still dismisses saver');

var empty = harness(); empty.selectAerials([]); empty.saver.start(); assert.strictEqual(empty.calls(), 0, "No selected videos means clock only");
var selected = harness(); selected.selectAerials(["test"]); selected.saver.start(); assert.strictEqual(selected.calls(), 1);
