/* Small deterministic idle state machine, independent of DOM and video playback. */
(function (root) {
  'use strict';
  function create(options) {
    var timer = null;
    var active = false;
    var suspended = false;
    var lastInput = options.now();
    var prepared = false;
    function cancelPrepare() { if (prepared && options.cancelPrepare) { options.cancelPrepare(); } prepared = false; }
    function clear() { if (timer !== null) { options.clearTimeout(timer); timer = null; } }
    function schedule() {
      clear(); if (suspended || active || !options.enabled()) { return; }
      var lead = options.prepare && !prepared ? Math.min(options.prepareMs || 20000, options.delay) : 0;
      timer = options.setTimeout(check, Math.max(1, options.delay - lead - (options.now() - lastInput)));
    }
    function check() {
      timer = null;
      if (suspended || !options.enabled()) { return; }
      if (options.now() - lastInput < options.delay) {
        if (options.prepare && !prepared && options.now() - lastInput >= options.delay - (options.prepareMs || 20000)) {
          prepared = true; if (options.canStart()) { options.prepare(); }
        }
        schedule(); return;
      }
      if (!options.canStart()) { lastInput = options.now(); schedule(); return; }
      active = true; options.start();
    }
    function stop() { if (active) { active = false; options.stop(); } }
    return {
      setDelay: function (value) { options.delay=value;cancelPrepare();lastInput=options.now();schedule(); },
      reset: function () { var consumed = active; stop(); cancelPrepare(); lastInput = options.now(); schedule(); return consumed; },
      activity: function () { var consumed = active; stop(); var wasPrepared = prepared; cancelPrepare(); lastInput = options.now(); if (!timer || consumed || wasPrepared) { schedule(); } return consumed; },
      suspend: function () { suspended = true; clear(); stop(); cancelPrepare(); },
      resume: function () { suspended = false; lastInput = options.now(); schedule(); },
      start: function () { if (!suspended && !active && options.enabled() && options.canStart()) { clear(); active = true; options.start(); return true; } return false; },
      isActive: function () { return active; }
    };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = create; }
  else { root.HomeIdle = { create: create }; }
}(this));
