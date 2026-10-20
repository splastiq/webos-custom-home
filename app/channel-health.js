/* Check delivery without opening extra video decoders. ES5, two requests at most. */
(function (root) {
  'use strict';
  function resolve(uri, base) {
    if (!uri || /^(?!https?:)[a-z][a-z0-9+.-]*:/i.test(uri)) { return null; }
    if (/^https?:\/\//i.test(uri)) { return uri; }
    var origin = /^(https?:)\/\/([^/]+)(\/[^?#]*)?/i.exec(base);
    if (!origin) { return null; }
    return origin[1] + '//' + (uri.indexOf('//') === 0 ? uri.slice(2) : origin[2] + (uri.charAt(0) === '/' ? uri : (origin[3] || '/').replace(/[^/]*$/, '') + uri));
  }
  function target(text, base) {
    if (!/^\s*#EXTM3U/.test(text)) { return { error: 'Некорректный HLS-плейлист' }; }
    var lines = text.split(/\r?\n/);
    var variants = [];
    var segments = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/^\s+|\s+$/g, '');
      if (line.indexOf('#EXT-X-STREAM-INF:') === 0) {
        var height = /RESOLUTION=\d+x(\d+)/i.exec(line);
        var rate = /(?:^|[:,])BANDWIDTH=(\d+)/i.exec(line);
        var uri = (lines[i + 1] || '').replace(/^\s+|\s+$/g, '');
        if (uri && uri.charAt(0) !== '#') { variants.push({ url: resolve(uri, base), height: height ? Number(height[1]) : 0, rate: rate ? Number(rate[1]) : Infinity }); }
      } else if (line && line.charAt(0) !== '#') { segments.push(resolve(line, base)); }
    }
    if (variants.length) {
      var hd = variants.filter(function (variant) { return variant.height >= 720; });
      var choices = hd.length ? hd : variants;
      choices.sort(function (a, b) { return a.rate - b.rate; });
      return choices[0].url ? { url: choices[0].url, manifest: true } : { error: 'Некорректный адрес потока' };
    }
    return segments.length && segments[segments.length - 1] ? { url: segments[segments.length - 1], manifest: false } : { error: 'В плейлисте нет видео' };
  }
  function create(options) {
    options = options || {};
    var XHR = options.XMLHttpRequest || root.XMLHttpRequest;
    var online = options.online || function () { return root.navigator.onLine !== false; };
    var limit = options.concurrency || 2;
    var stopped = false;
    var requests = [];
    var timers = [];
    function request(url, bytes, done) {
      if (stopped) { return; }
      var xhr = new XHR();
      var ended = false;
      requests.push(xhr);
      function finish(result, stop) {
        if (ended || stopped) { return; }
        ended = true;
        var index = requests.indexOf(xhr);
        if (index >= 0) { requests.splice(index, 1); }
        if (stop) { xhr.abort(); }
        done(result);
      }
      xhr.open('GET', url, true);
      xhr.timeout = options.timeout || 6000;
      if (bytes) { xhr.responseType = 'arraybuffer'; }
      xhr.onreadystatechange = function () {
        if (xhr.readyState >= 2 && xhr.status >= 400) { finish({ state: 'unavailable', reason: 'Ошибка HTTP ' + xhr.status }, true); }
        else if (bytes && xhr.readyState >= 2 && xhr.status >= 200 && xhr.status < 300 && /text\/html|application\/json/i.test(xhr.getResponseHeader('Content-Type') || '')) { finish({ state: 'unavailable', reason: 'Сервер вернул ошибку вместо видео' }, true); }
      };
      xhr.onprogress = function (event) {
        if (bytes && xhr.status >= 200 && xhr.status < 300 && event.loaded > 0) { finish({ state: 'available', reason: 'Поток отвечает' }, true); }
        else if (!bytes && event.loaded > 262144) { finish({ state: 'unknown', reason: 'Проверка плейлиста ограничена' }, true); }
      };
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (bytes) { finish(xhr.response && xhr.response.byteLength ? { state: 'available', reason: 'Поток отвечает' } : { state: 'unavailable', reason: 'Пустой ответ потока' }); }
          else { finish({ text: xhr.responseText, url: xhr.responseURL || url }); }
        } else { finish({ state: 'unknown', reason: 'Проверка недоступна' }); }
      };
      xhr.onerror = function () { finish({ state: 'unknown', reason: 'Не удалось проверить поток' }); };
      xhr.ontimeout = function () { finish({ state: 'unknown', reason: 'Тайм-аут проверки' }); };
      try { xhr.send(); } catch (e) { finish({ state: 'unknown', reason: 'Проверка недоступна' }); }
    }
    function probe(url, manifest, depth, done) {
      request(url, !manifest, function (result) {
        if (result.state) { done(result); return; }
        var next = target(result.text, result.url);
        if (next.error) { done({ state: 'unavailable', reason: next.error }); return; }
        if (depth >= 3 && next.manifest) { done({ state: 'unknown', reason: 'Сложный формат плейлиста' }); return; }
        probe(next.url, next.manifest, depth + 1, done);
      });
    }
    function run(channels, update) {
      var index = 0;
      var running = 0;
      function next() {
        if (stopped) { return; }
        while (running < limit && index < channels.length) {
          var channelIndex = index++;
          (function (channel, channelIndex) {
            running++;
            update(channelIndex, { state: 'checking', reason: 'Проверка потока…' });
            function complete(result) {
              if (stopped) { return; }
              update(channelIndex, result);
              running--;
              next();
            }
            function check(retried) {
              if (!online()) { complete({ state: 'unknown', reason: 'Нет сети для проверки' }); return; }
              probe(channel.url, /\.m3u8(?:\?|$)/i.test(channel.url), 0, function (result) {
                if (!online()) { complete({ state: 'unknown', reason: 'Нет сети для проверки' }); return; }
                if (result.state === 'unavailable' && !retried) {
                  timers.push(setTimeout(function () { if (!stopped) { check(true); } }, options.retryDelay === undefined ? 1000 : options.retryDelay));
                } else { complete(result); }
              });
            }
            check(false);
          }(channels[channelIndex], channelIndex));
        }
      }
      next();
    }
    return {
      run: run,
      cancel: function () {
        stopped = true;
        timers.forEach(clearTimeout);
        requests.slice().forEach(function (xhr) { xhr.abort(); });
        requests = [];
      }
    };
  }
  var api = { create: create, target: target, resolve: resolve };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.ChannelHealth = api; }
}(this));
