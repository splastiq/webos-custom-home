'use strict';
var assert = require('assert');
var vm = require('vm');
var fs = require('fs');
var attrs = {};
var handlers = {};
var jobs = {};
var seq = 0;
var now = 0;
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
  Date: {now: function () { return now; }}, window: window, document: { addEventListener: function () {} },
  setTimeout: function (fn, ms) { jobs[++seq] = { fn: fn, ms: ms, at: now + ms }; return seq; }, clearTimeout: function (id) { delete jobs[id]; }
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

function advance(ms) {
  var until = now + ms;
  for (;;) {
    var key = Object.keys(jobs).sort(function (a,b) { return jobs[a].at-jobs[b].at; })[0];
    if (!key || jobs[key].at > until) { break; }
    now = jobs[key].at; var callback = jobs[key].fn; delete jobs[key]; callback();
  }
  now = until;
}
preview.play(asset); video.currentTime = 1; handlers.timeupdate();
var playingCalls = calls;
advance(4000); assert.strictEqual(note.textContent, 'Буферизация…', 'Frozen playback displays buffering');
handlers.timeupdate(); assert.strictEqual(note.textContent, 'Буферизация…', 'Duplicate timestamps do not pretend playback resumed');
advance(20000); assert.strictEqual(calls, playingCalls, 'Short buffering does not interrupt the source');
video.currentTime = 2; handlers.timeupdate(); assert.strictEqual(note.hidden, true, 'Playback progress clears buffering');
advance(46000); assert.strictEqual(calls, playingCalls + 1, 'Long stall reconnects once');
assert.strictEqual(attrs.src, '1080.mov', 'First recovery keeps the current format');
handlers.loadedmetadata(); assert.strictEqual(video.currentTime, 2, 'Recovery restores playback position');
video.currentTime = 3; handlers.timeupdate(); advance(46000);
assert.strictEqual(attrs.src, 'avc.mov', 'Repeated stall falls back instead of reconnecting forever');
preview.close(); assert.deepStrictEqual(Object.keys(jobs), [], 'Closing cancels playback watchdog and recovery');
console.log('Preview buffering: passed (indicator, duplicate timestamps, short stall, resume position, bounded recovery, cleanup)');
