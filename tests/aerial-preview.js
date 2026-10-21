'use strict';
var assert = require('assert');
var vm = require('vm');
var fs = require('fs');
var attrs = {};
var handlers = {};
var jobs = {};
var seq = 0;
var calls = 0;
var reject;
var video = {
  setAttribute: function (key, value) { attrs[key] = value; }, getAttribute: function (key) { return attrs[key] || null; }, removeAttribute: function (key) { delete attrs[key]; },
  addEventListener: function (key, fn) { handlers[key] = fn; }, canPlayType: function () { return 'probably'; },
  pause: function () { this.paused = true; }, load: function () {},
  play: function () { calls++; this.paused = false; return { catch: function (fn) { reject = fn; } }; }
};
Object.defineProperty(video,'src',{ set: function (url) { attrs.src = url; } });
var window = { addEventListener: function () {}, TV: { available: true }, HomeAerialCatalog: require('../app/aerial-catalog') };
var note = {};
vm.runInNewContext(fs.readFileSync(require.resolve('../app/aerial-preview'),'utf8'), {
  window: window, document: { addEventListener: function () {} },
  setTimeout: function (fn, ms) { jobs[++seq] = { fn: fn, ms: ms }; return seq; }, clearTimeout: function (id) { delete jobs[id]; }
});
var preview = window.HomeAerialPreview; preview.init(video,note);
var asset = { preview: 'aerial-thumbs/test.jpg', sources: { hevc4k: '4k.mov', hevc1080: '1080.mov', h264: 'avc.mov' } };
preview.play(asset); assert.strictEqual(attrs.src,'1080.mov'); assert.ok(video.muted); assert.strictEqual(video.volume,0);
var initialStall = Object.keys(jobs).filter(function(k){return jobs[k].ms === 30000;})[0];
video.buffered = {length: 1, end: function () { return 2; }}; handlers.progress();
assert.ok(!jobs[initialStall], 'Received buffer progress renews the inactivity timeout');
var pendingTimers = Object.keys(jobs).join(','); handlers.progress();
assert.strictEqual(Object.keys(jobs).join(','), pendingTimers, 'Unchanged buffer must not extend the deadline forever');
assert.strictEqual(Object.keys(jobs).filter(function(k){return jobs[k].ms === 120000;}).length, 1, 'Slow loading still has an absolute deadline');
var oldReject = reject; handlers.error(); oldReject(new Error('decode'));
var next = Object.keys(jobs).filter(function (key) { return jobs[key].ms === 0; });
assert.strictEqual(next.length,1,'Error event and rejected promise produce a single fallback');
var fn = jobs[next[0]].fn; delete jobs[next[0]]; fn(); assert.strictEqual(attrs.src,'avc.mov');
video.readyState = 2; video.videoWidth = 1920; video.currentTime = 0; handlers.playing(); assert.notStrictEqual(note.hidden,true, 'Metadata alone must not dismiss the cover'); video.currentTime = 1; handlers.timeupdate(); assert.strictEqual(note.hidden,true);
preview.close(); assert.strictEqual(attrs.src,undefined); assert.strictEqual(attrs.poster,undefined); assert.ok(video.paused);
oldReject(new Error('late')); assert.strictEqual(calls,2,'Closed preview ignores stale promises');
preview.play(asset); assert.strictEqual(calls,3,'A new selection can start after closing');
preview.close(); assert.deepStrictEqual(Object.keys(jobs),[],'No timer survives closing');
console.log('Aerial preview: passed (native video, mute, source fallback, race suppression, release, reopen, timer cleanup)');
