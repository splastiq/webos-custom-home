/* Only the selected card starts a native decoder; closing always releases it. */
(function () {
  'use strict';
  var video;
  var note;
  var mediaSource;
  var sources = [];
  var index = 0;
  var token = 0;
  var timer;
  var nextPending = false;
  var poster = '';
  var surface;
  var slot;
  var cover;
  var transportRequest;
  var transportTimer;
  var keepAliveTimer;
  var useTransport = false;
  var firstTime = -1;
  var diagnosticAt = 0;
  var diagnostics = false;
  function report() {
    if (!diagnostics || !useTransport || !sources.length || Date.now() - diagnosticAt < 5000) { return; }
    diagnosticAt = Date.now();
    var xhr = new window.XMLHttpRequest();
    xhr.open('GET', endpoint + '/aerial-state?time=' + video.currentTime + '&ready=' + video.readyState + '&width=' + video.videoWidth + '&paused=' + video.paused + '&hidden=' + document.hidden + '&duration=' + video.duration + '&error=' + (video.error ? video.error.code : 0), true);
    try { xhr.send(); } catch (ignored) {}
  }
  var endpoint = 'http://127.0.0.1:9765';
  function transport(done, expected) {
    if (!window.XMLHttpRequest) { done(null, false); return; }
    var retries = 0;
    var started = false;
    function health() {
      if (expected !== token) { return; }
      var xhr = new window.XMLHttpRequest(); transportRequest = xhr;
      xhr.open('GET', endpoint + '/health', true); xhr.timeout = 1000;
      function failed() {
        if (transportRequest !== xhr) { return; } transportRequest = null;
        if (!started && window.TV.available && window.TV.prepareAerialPreview) {
          started = true;
          window.TV.prepareAerialPreview(function (error) { if (expected !== token) { return; } if (error) { done(error); } else { transportTimer = setTimeout(health, 250); } });
        } else if (started && retries++ < 5) { transportTimer = setTimeout(health, 300); }
        else { done('Не удалось подготовить видеопредпросмотр.'); }
      }
      xhr.onload = function () {
        if (transportRequest !== xhr) { return; }
        if (xhr.status === 200 && xhr.responseText === 'home-aerial-v1') { transportRequest = null; done(null, true, typeof xhr.getResponseHeader === 'function' && xhr.getResponseHeader('X-Home-Aerial-Debug') === '1'); }
        else { failed(); }
      };
      xhr.onerror = xhr.ontimeout = failed; xhr.send();
    }
    health();
  }
  function position() {
    if (!surface || !slot || surface.hidden) { return; }
    var rect = slot.getBoundingClientRect();
    surface.style.left = rect.left + 'px'; surface.style.top = rect.top + 'px';
    surface.style.width = rect.width + 'px'; surface.style.height = rect.height + 'px';
  }
  function keepAlive(expected) {
    if (!useTransport || expected !== token || !sources.length) { return; }
    var xhr = new window.XMLHttpRequest();
    xhr.open('GET', endpoint + '/health', true); xhr.timeout = 2000;
    try { xhr.send(); } catch (ignored) {}
    keepAliveTimer = setTimeout(function () { keepAlive(expected); }, 20000);
  }
  function frame() {
    report();
    if (!sources.length || video.readyState < 2 || !video.videoWidth || !(video.currentTime > firstTime)) { return; }
    clearTimeout(timer); nextPending = false; status('');
    if (surface) { surface.classList.add('has-frame'); }
  }
  function status(text) {
    note.textContent = text; note.hidden = !text;
    if (surface) {
      if (text === 'Загрузка видео…') { surface.classList.add('is-loading'); }
      else { surface.classList.remove('is-loading'); }
    }
  }
  function stop() {
    token++; clearTimeout(timer); nextPending = false;
    clearTimeout(transportTimer);
    clearTimeout(keepAliveTimer);
    if (transportRequest) { var request = transportRequest; transportRequest = null; request.abort(); }
    video.pause(); if (mediaSource) { mediaSource.removeAttribute('src'); } video.removeAttribute('src'); video.removeAttribute('poster'); video.load();
    if (surface) { surface.classList.remove('has-frame'); }
  }
  function fail(expected, reason) {
    if (!sources.length || expected !== token || nextPending) { return; }
    video.setAttribute('data-last-error', reason || 'timeout');
    nextPending = true; clearTimeout(timer);
    timer = setTimeout(function () { if (expected !== token || !sources.length) { return; } index++; attempt(); }, 0);
  }
  function attempt() {
    stop();
    if (poster) { video.setAttribute('poster', poster); }
    if (index >= sources.length) { status('Видео недоступно или формат не поддерживается.'); return; }
    var expected = token;
    status('Загрузка видео…');
    video.muted = true; video.volume = 0; video.loop = true;
    firstTime = 0;
    if (mediaSource) { mediaSource.src = sources[index]; } else { video.src = sources[index]; }
    video.load();
    timer = setTimeout(function () { fail(expected); }, 30000);
    try {
      var promise = video.play();
      if (promise && promise.catch) { promise.catch(function (error) { fail(expected, error && (error.name + ': ' + error.message)); }); }
    } catch (error) { fail(expected, error.message); }
    if (useTransport) { keepAliveTimer = setTimeout(function () { keepAlive(expected); }, 20000); }
  }
  window.HomeAerialPreview = {
    init: function (element, message, previewSlot, previewSurface, previewCover) {
      video = element; mediaSource = video.querySelector ? video.querySelector('source') : null; video.setAttribute('autoplay', ''); note = message; slot = previewSlot; surface = previewSurface; cover = previewCover;
      video.setAttribute('data-support-avc', video.canPlayType('video/mp4; codecs="avc1.640028"'));
      video.addEventListener('canplay', function () {
        if (!sources.length || nextPending || !video.paused) { return; }
        var expected = token;
        try { var start = video.play(); if (start && start.catch) { start.catch(function (error) { fail(expected, error && error.name); }); } } catch (error) { fail(expected, error.message); }
      });
      video.addEventListener('playing', frame);
      video.addEventListener('loadeddata', frame); video.addEventListener('timeupdate', frame);
      video.addEventListener('error', function () { if (sources.length && (video.getAttribute('src') || mediaSource && mediaSource.getAttribute('src'))) { fail(token, video.error ? video.error.code + ': ' + video.error.message : 'media'); } });
      document.addEventListener('visibilitychange', function () { if (document.hidden) { sources = []; stop(); status('Предпросмотр остановлен. Выберите ролик снова.'); } });
      window.addEventListener('resize', position);
    },
    play: function (asset) {
      var hevc = window.TV.available || !!video.canPlayType('video/mp4; codecs="hvc1.1.6.L123.B0"');
      // Preview is half a 1080p UI. TV testing confirmed HEVC starts reliably;
      // desktop browsers prefer AVC. 4K is reserved for ambient playback.
      sources = (window.TV.available ? [asset.sources.hevc1080, asset.sources.h264] : [asset.sources.h264, hevc ? asset.sources.hevc1080 : ''])
        .filter(function (url, position, all) { return !!url && all.indexOf(url) === position; });
      if (!sources.length && hevc && asset.sources.hevc4k) { sources = [asset.sources.hevc4k]; }
      index = 0; poster = asset.preview || '';
      if (surface) { surface.hidden = false; cover.src = poster; position(); }
      stop(); status('Загрузка видео…');
      var expected = token;
      transport(function (error, compatible, debug) {
        if (expected !== token) { return; }
        if (error) { status(error); return; }
        useTransport = compatible; diagnostics = !!debug;
        if (compatible) {
          sources = sources.map(function (source) {
            var format = source === asset.sources.h264 ? 'avc' : source === asset.sources.hevc1080 ? 'hevc1080' : 'hevc4k';
            return endpoint + '/aerial-video.mp4?id=' + encodeURIComponent(asset.id) + '&format=' + format;
          });
        }
        attempt();
      }, expected);
    },
    close: function () { sources = []; poster = ''; stop(); status(''); if (surface) { surface.hidden = true; cover.removeAttribute('src'); } }
  };
}());
