/* Only the selected card starts a native decoder; closing always releases it. */
(function () {
  'use strict';
  var video;
  var note;
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
        if (xhr.status === 200 && xhr.responseText === 'home-aerial-v1') { transportRequest = null; done(null, true); }
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
    if (!sources.length || video.readyState < 2 || !video.videoWidth) { return; }
    clearTimeout(timer); nextPending = false; status('');
    if (surface) { surface.classList.add('has-frame'); }
  }
  function status(text) { note.textContent = text; note.hidden = !text; }
  function stop() {
    token++; clearTimeout(timer); nextPending = false;
    clearTimeout(transportTimer);
    clearTimeout(keepAliveTimer);
    if (transportRequest) { var request = transportRequest; transportRequest = null; request.abort(); }
    video.pause(); video.removeAttribute('src'); video.removeAttribute('poster'); video.load();
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
    video.src = sources[index];
    timer = setTimeout(function () { fail(expected); }, 30000);
    try {
      var promise = video.play();
      if (promise && promise.catch) { promise.catch(function (error) { fail(expected, error && (error.name + ': ' + error.message)); }); }
    } catch (error) { fail(expected, error.message); }
    if (useTransport) { keepAliveTimer = setTimeout(function () { keepAlive(expected); }, 20000); }
  }
  window.HomeAerialPreview = {
    init: function (element, message, previewSlot, previewSurface, previewCover) {
      video = element; note = message; slot = previewSlot; surface = previewSurface; cover = previewCover;
      video.setAttribute('data-support-avc', video.canPlayType('video/mp4; codecs="avc1.640028"'));
      video.addEventListener('playing', frame);
      video.addEventListener('loadeddata', frame); video.addEventListener('timeupdate', frame);
      video.addEventListener('error', function () { if (sources.length && video.getAttribute('src')) { fail(token, video.error ? video.error.code + ': ' + video.error.message : 'media'); } });
      document.addEventListener('visibilitychange', function () { if (document.hidden) { sources = []; stop(); status('Предпросмотр остановлен. Выберите ролик снова.'); } });
      window.addEventListener('resize', position);
    },
    play: function (asset) {
      var hevc = window.TV.available || !!video.canPlayType('video/mp4; codecs="hvc1.1.6.L123.B0"');
      // Preview is only half a 1080p UI. Prefer AVC, then 1080p HEVC; 4K is
      // reserved for the actual screensaver and is unnecessary decoder work here.
      sources = [asset.sources.h264, hevc ? asset.sources.hevc1080 : '']
        .filter(function (url, position, all) { return !!url && all.indexOf(url) === position; });
      if (!sources.length && hevc && asset.sources.hevc4k) { sources = [asset.sources.hevc4k]; }
      index = 0; poster = asset.preview || '';
      if (surface) { surface.hidden = false; cover.src = poster; position(); }
      stop(); status('Загрузка видео…');
      var expected = token;
      transport(function (error, compatible) {
        if (expected !== token) { return; }
        if (error) { status(error); return; }
        useTransport = compatible;
        if (compatible) {
          sources = sources.map(function (source) {
            var format = source === asset.sources.h264 ? 'avc' : source === asset.sources.hevc1080 ? 'hevc1080' : 'hevc4k';
            return endpoint + '/aerial-video?id=' + encodeURIComponent(asset.id) + '&format=' + format;
          });
        }
        attempt();
      }, expected);
    },
    close: function () { sources = []; poster = ''; stop(); status(''); if (surface) { surface.hidden = true; cover.removeAttribute('src'); } }
  };
}());
