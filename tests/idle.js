'use strict';
var assert = require('assert');
var create = require('../app/idle');
function harness() {
  var now = 0;
  var sequence = 0;
  var jobs = {};
  var permitted = true;
  var enabled = true;
  var starts = 0;
  var stops = 0;
  var idle = create({
    now: function () { return now; }, delay: 120000,
    setTimeout: function (fn, delay) { jobs[++sequence] = { fn: fn, at: now + delay }; return sequence; },
    clearTimeout: function (id) { delete jobs[id]; },
    enabled: function () { return enabled; }, canStart: function () { return permitted; },
    start: function () { starts++; }, stop: function () { stops++; }
  });
  function advance(ms) {
    var end = now + ms;
    for (;;) {
      var next = Object.keys(jobs).sort(function (a, b) { return jobs[a].at - jobs[b].at; })[0];
      if (!next || jobs[next].at > end) { break; }
      now = jobs[next].at; var fn = jobs[next].fn; delete jobs[next]; fn();
    }
    now = end;
  }
  return { idle: idle, advance: advance, jobs: function () { return Object.keys(jobs).length; }, starts: function () { return starts; }, stops: function () { return stops; }, permit: function (value) { permitted = value; }, enable: function (value) { enabled = value; } };
}
var h = harness(); h.idle.resume();
h.advance(119999); assert.strictEqual(h.starts(), 0);
h.advance(1); assert.strictEqual(h.starts(), 1);
assert.strictEqual(h.idle.activity(), true, 'First wake input is consumed');
assert.strictEqual(h.stops(), 1);
assert.strictEqual(h.idle.activity(), false, 'Normal input is not consumed');
for (var i = 0; i < 500; i++) { h.advance(100); h.idle.activity(); }
assert.strictEqual(h.jobs(), 1, 'Mouse movement keeps one scheduled timer');
h.advance(119999); assert.strictEqual(h.starts(), 1);
h.advance(1); assert.strictEqual(h.starts(), 2);
h.idle.suspend(); assert.strictEqual(h.stops(), 2); assert.strictEqual(h.jobs(), 0);
h.advance(600000); assert.strictEqual(h.starts(), 2, 'Hidden app never starts a saver');
h.idle.resume(); h.permit(false); h.advance(120000);
assert.strictEqual(h.starts(), 2, 'IPTV, editor, or reorder blocks idle launch');
assert.strictEqual(h.idle.start(), false);
h.permit(true); h.advance(120000); assert.strictEqual(h.starts(), 3);
h.idle.reset(); assert.strictEqual(h.idle.start(), true, 'Manual clock action starts immediately');
h.idle.reset(); h.enable(false); h.advance(120000); assert.strictEqual(h.idle.start(), false);
console.log('Idle: passed (deadline, activity, timer count, wake consumption, suspension, busy app, manual launch, disabled mode)');
