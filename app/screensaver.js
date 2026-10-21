/* One playing native video, a preload-only element, bounded retries and an offline clock. */
(function () {
  'use strict';
  var config = window.HOME_CONFIG.screensaver;
  var overlay;
  var video;
  var idle;
  var catalog;
  var returnTo;
  var previousAria;
  var foreground = true;
  var token = 0;
  var mediaTimer;
  var clockTimer;
  var failurePending = false;
  var playing = false;
  var attempts = 0;
  var queue = [];
  var sources = [];
  var sourceIndex = 0;
  var asset = null;
  var previousAsset = '';
  var blockedKey = null;
  var swallowUntil = 0;
  var rotationTimer;
  var preloadTimer;
  var preloadVideo;
  var prepared = null;
  var rotationMs = config.rotationMs || 300000;
  function clearPreload() {
    clearTimeout(preloadTimer);
    if (preloadVideo) { preloadVideo.pause(); preloadVideo.removeAttribute('src'); preloadVideo.load(); }
    prepared = null;
  }
  function prepareNext() {
    if (navigator.onLine === false) { return; }
    if (!queue.length) { refill(); }
    prepared = queue.pop() || null;
    if (prepared) {
      preloadVideo.preload = 'auto';
      preloadVideo.src = window.HomeAerialCatalog.variants(prepared, hevc())[0];
      preloadVideo.load();
    }
  }
  function rotate() {
    if (!idle.isActive()) { return; }
    clearTimeout(rotationTimer);
    sources = []; attempts = 0; attempt();
  }
  function el(id) { return document.getElementById(id); }
  function consume(event) { event.preventDefault(); event.stopImmediatePropagation(); }
  function editable(node) { return node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable); }
  function canStart() {
    return foreground && !document.hidden && !window.IPTV.isOpen() && !window.HomeOrder.busy() &&
      !(window.HomeSettings && window.HomeSettings.isOpen()) &&
      el('playlist-form').hidden && el('playlist-delete-form').hidden && !editable(document.activeElement);
  }
  function clock() {
    clearTimeout(clockTimer);
    if (!idle.isActive()) { return; }
    var now = new Date();
    var minsk = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
    el('screensaver-clock').textContent = (minsk.getHours() < 10 ? '0' : '') + minsk.getHours() + ':' + (minsk.getMinutes() < 10 ? '0' : '') + minsk.getMinutes();
    el('screensaver-date').textContent = minsk.getDate() + ' ' + ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][minsk.getMonth()];
    // Small periodic position changes keep the offline fallback from being completely static.
    overlay.setAttribute('data-position', Math.floor(now.getTime() / 60000) % 4);
    clockTimer = setTimeout(clock, 60000 - now.getTime() % 60000 + 20);
  }
  function releaseVideo() {
    token++; clearTimeout(mediaTimer); mediaTimer = null; failurePending = false; playing = false;
    overlay.classList.remove('has-video');
    video.pause(); video.removeAttribute('src'); video.load();
  }
  function hevc() {
    return window.TV.available || !!video.canPlayType('video/mp4; codecs="hvc1.1.6.L123.B0"') || !!video.canPlayType('video/mp4; codecs="hev1.1.6.L123.B0"');
  }
  function refill() {
    var assets = catalog.assets();
    if (window.HomeAerialSelection) { assets = window.HomeAerialSelection.filter(assets); }
    queue = assets.filter(function (item) { return window.HomeAerialCatalog.variants(item, hevc()).length > 0; });
    for (var i = queue.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var swap = queue[i]; queue[i] = queue[j]; queue[j] = swap;
    }
    if (queue.length > 1 && queue[queue.length - 1].id === previousAsset) { queue.unshift(queue.pop()); }
  }
  function nextAsset() {
    if (!queue.length) { refill(); }
    if (!queue.length) { return false; }
    asset = prepared || queue.pop(); prepared = null; previousAsset = asset.id;
    sources = window.HomeAerialCatalog.variants(asset, hevc()); sourceIndex = 0; return true;
  }
  function fail(expected, reason) {
    if (!idle.isActive() || expected !== token || failurePending) { return; }
    failurePending = true; overlay.setAttribute('data-last-error', reason || 'playback'); clearTimeout(mediaTimer);
    // Defer so an error event and rejected play promise cannot advance two sources.
    mediaTimer = setTimeout(function () {
      if (!idle.isActive() || expected !== token) { return; }
      failurePending = false; sourceIndex++; attempt();
    }, 0);
  }
  function attempt() {
    if (!idle.isActive()) { return; }
    if (navigator.onLine === false || attempts >= 6) { overlay.setAttribute('data-state', navigator.onLine === false ? 'offline' : 'fallback'); releaseVideo(); return; }
    if (!sources.length || sourceIndex >= sources.length) {
      if (!nextAsset()) { releaseVideo(); return; }
    }
    releaseVideo();
    var expected = token;
    attempts++; overlay.setAttribute('data-state', 'loading');
    el('screensaver-location').textContent = asset.label;
    el('screensaver-place').textContent = asset.location || '';
    el('screensaver-place').hidden = !asset.location;
    video.muted = true; video.volume = 0;
    video.preload = 'auto';
    video.src = sources[sourceIndex];
    clearPreload();
    mediaTimer = setTimeout(function () { fail(expected, 'timeout'); }, config.loadTimeoutMs);
    try {
      var promise = video.play();
      if (promise && promise.catch) {
        promise.catch(function (error) {
          if (!idle.isActive() || expected !== token) { return; }
          if (error && error.name === 'NotAllowedError') { overlay.setAttribute('data-state', 'autoplay-blocked'); releaseVideo(); }
          else { fail(expected); }
        });
      }
    } catch (error) { fail(expected); }
  }
  function show() {
    returnTo = document.activeElement; previousAria = el('screen').getAttribute('aria-hidden');
    overlay.hidden = false; el('screen').setAttribute('aria-hidden', 'true'); overlay.focus();
    window.IPTV.setAmbient(true);
    attempts = 0; sources = []; asset = null; sourceIndex = 0;
    clock();
    catalog.refresh(Date.now(), navigator.onLine !== false);
    attempt();
  }
  function hide() {
    clearTimeout(rotationTimer); rotationTimer = null; clearPreload();
    releaseVideo(); clearTimeout(clockTimer); catalog.cancel();
    overlay.hidden = true;
    if (previousAria === null) { el('screen').removeAttribute('aria-hidden'); }
    else { el('screen').setAttribute('aria-hidden', previousAria); }
    window.IPTV.setAmbient(false);
    if (!document.hidden && foreground && returnTo && document.documentElement.contains(returnTo) && !returnTo.disabled) { returnTo.focus(); }
    returnTo = null;
  }
  function input(event) {
    // Magic Remote reports cursor visibility as synthetic key events. In particular,
    // cursor_hide (1537) arrives a few seconds after the last pointer movement.
    if ((event.type === 'keydown' || event.type === 'keyup') && (event.keyCode === 1536 || event.keyCode === 1537)) { return; }
    var active = idle.isActive();
    if (event.type === 'keydown' && blockedKey !== null && event.keyCode === blockedKey) { consume(event); return; }
    if (event.type === 'keyup' && blockedKey !== null && event.keyCode === blockedKey) { blockedKey = null; consume(event); return; }
    if (!active && Date.now() < swallowUntil && event.type !== 'mousemove') { consume(event); return; }
    if (active) {
      if (event.type === 'mousemove' || event.type === 'wheel' || event.type === 'keyup' || event.type === 'mouseup') { consume(event); return; }
      if (event.type === 'keydown' && !event.keyCode) { return; }
      if (event.type !== 'keydown' && Date.now() < swallowUntil) { consume(event); return; }
      if (event.type === 'keydown') { blockedKey = event.keyCode; }
      swallowUntil = Date.now() + 350;
      consume(event); idle.activity(); return;
    }
    // Desktop-only equivalent of clicking the clock, useful for preview verification.
    if (event.type === 'keydown' && event.keyCode === 83 && !window.TV.available && !editable(event.target)) {
      if (idle.start()) { blockedKey = event.keyCode; consume(event); } return;
    }
    idle.activity();
  }
  window.HomeScreensaver = {
    assets: function () { return catalog ? catalog.assets() : []; },
    selectionChanged: function () { clearPreload(); queue = []; sources = []; },
    isActive: function () { return !!idle && idle.isActive(); },
    start: function (key) {
      var started = idle && idle.start();
      if (started) { blockedKey = typeof key === 'number' ? key : null; swallowUntil = Date.now() + 350; }
      return started;
    },
    init: function () {
      overlay = el('screensaver'); video = el('screensaver-video');
      preloadVideo = el('screensaver-preload');
      preloadVideo.muted = true; preloadVideo.volume = 0;
      catalog = window.HomeAerialCatalog.create({ bundled: window.HOME_AERIAL_ASSETS, storage: window.HomeStorage, XMLHttpRequest: window.XMLHttpRequest });
      video.muted = true; video.volume = 0;
      idle = window.HomeIdle.create({ now: Date.now, setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
        delay: config.idleMs, prepareMs: 20000, prepare: prepareNext, cancelPrepare: clearPreload,
        enabled: function () { return config.enabled; }, canStart: canStart, start: show, stop: hide });
      ['keydown','keyup','mousemove','mousedown','mouseup','click','wheel','touchstart'].forEach(function (name) { window.addEventListener(name, input, true); });
      window.addEventListener('blur', function () {
        foreground = false; blockedKey = null;
        // A transient system overlay / pointer focus change must not dismiss a
        // manually started saver. Visibilitychange handles leaving the app.
        if (document.hidden || !idle.isActive()) { idle.suspend(); }
      });
      window.addEventListener('focus', function () { foreground = true; if (!document.hidden) { idle.resume(); } });
      document.addEventListener('visibilitychange', function () { if (document.hidden) { idle.suspend(); } else { idle.resume(); } });
      window.addEventListener('pagehide', function () { idle.suspend(); catalog.cancel(); });
      window.addEventListener('offline', function () {
        catalog.cancel(); clearPreload(); clearTimeout(rotationTimer); rotationTimer = null;
        if (idle.isActive()) { overlay.setAttribute('data-state', 'offline'); releaseVideo(); }
      });
      window.addEventListener('online', function () { if (idle.isActive()) { attempts = 0; sources = []; queue = []; attempt(); } });
      video.addEventListener('playing', function () {
        if (!idle.isActive() || !video.getAttribute('src') || failurePending) { return; }
        clearTimeout(mediaTimer); mediaTimer = null; attempts = 0; playing = true; overlay.classList.add('has-video'); overlay.setAttribute('data-state', 'playing');
        if (!rotationTimer) {
          rotationTimer = setTimeout(function () { rotationTimer = null; rotate(); }, rotationMs);
          preloadTimer = setTimeout(prepareNext, Math.max(0, rotationMs - 20000));
        }
      });
      video.addEventListener('ended', function () {
        if (idle.isActive()) {
          video.currentTime = 0;
          try { var replay = video.play(); if (replay && replay.catch) { replay.catch(function () { fail(token, 'replay'); }); } } catch (error) { fail(token, 'replay'); }
        }
      });
      video.addEventListener('error', function () { if (idle.isActive() && video.getAttribute('src')) { fail(token, 'media-' + (video.error ? video.error.code : 'unknown')); } });
      function waiting() {
        if (idle.isActive() && playing && !mediaTimer) { var expected = token; mediaTimer = setTimeout(function () { fail(expected); }, 8000); }
      }
      video.addEventListener('waiting', waiting); video.addEventListener('stalled', waiting);
      if (!document.hidden) { idle.resume(); }
    }
  };
}());
