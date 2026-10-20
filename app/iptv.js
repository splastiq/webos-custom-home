(function (root) {
  'use strict';
  function parse(text) {
    var lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    var result = [];
    var pending = null;
    var seen = {};
    lines.forEach(function (line) {
      line = line.replace(/^\s+|\s+$/g, '');
      if (line.indexOf('#EXTINF:') === 0) {
        var comma = -1;
        var quoted = false;
        for (var j = 0; j < line.length; j++) {
          if (line.charAt(j) === '"') { quoted = !quoted; }
          if (line.charAt(j) === ',' && !quoted) { comma = j; break; }
        }
        var group = /group-title="([^"]*)"/.exec(line);
        var logo = /tvg-logo="([^"]*)"/.exec(line);
        var id = /tvg-id="([^"]*)"/.exec(line);
        pending = comma >= 0 ? { name: line.slice(comma + 1), group: group ? group[1] : '', id: id ? id[1] : '', logo: logo && /^https?:\/\//i.test(logo[1]) ? logo[1] : '' } : null;
        if (pending) {
          var resolution = /\((\d{3,4})p\)/i.exec(pending.name);
          pending.height = resolution ? Number(resolution[1]) : 0;
        }
      } else if (line && line.charAt(0) !== '#') {
        if (pending && /^https?:\/\//i.test(line) && !seen[line]) {
          pending.url = line;
          result.push(pending);
          seen[line] = true;
        }
        pending = null;
      }
    });
    return result;
  }
  function hdChannels(channels) {
    return channels.filter(function (channel) { return channel.height >= 720; });
  }
  parse.hdChannels = hdChannels;
  if (typeof module !== 'undefined' && module.exports) { module.exports = parse; return; }
  var source = 'https://iptv-org.github.io/iptv/languages/bel.m3u';
  var channels = [];
  var active = 0;
  var opened = false;
  var request;
  var timeout;
  var onRender;
  var onClose;
  var generation = 0;
  function el(id) { return document.getElementById(id); }
  var pointerTimer;
  var warmRequest;
  var prepared = {};
  var startedAt = 0;
  var firstFrame = false;
  var healthCheck;
  var healthTimer;
  var renderVersion = 0;
  function stopChecks() {
    clearTimeout(healthTimer);
    if (healthCheck) { healthCheck.cancel(); healthCheck = null; }
  }
  function setHealth(index, result) {
    var channel = channels[index];
    if (!channel) { return; }
    channel.health = result;
    var button = el('channels').querySelector('[data-channel="' + index + '"]');
    if (!button) { return; }
    var wasDisabled = button.disabled;
    button.disabled = result.state === 'unavailable' || (result.state === 'checking' && wasDisabled);
    channel.blocked = button.disabled;
    button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
    button.setAttribute('data-health', result.state);
    button.title = channel.name + ' · ' + result.reason;
    button.querySelector('.channel-detail').textContent = result.state === 'unavailable' ? result.reason : result.state === 'unknown' ? 'Не удалось проверить' : '';
    if (wasDisabled !== button.disabled) { onRender(); }
  }
  function checkChannels() {
    stopChecks();
    if (opened || document.hidden) { return; }
    var version = renderVersion;
    channels.forEach(function (channel, index) { setHealth(index, { state: 'checking', reason: 'Ожидает проверки…' }); });
    healthCheck = window.ChannelHealth.create();
    healthCheck.run(channels, function (index, result) {
      if (version === renderVersion && !opened) { setHealth(index, result); }
    });
  }
  function scheduleChecks() {
    stopChecks();
    healthTimer = setTimeout(checkChannels, 400);
  }
  function status(message, visible) {
    el('player-status').textContent = message;
    el('player-status').hidden = !visible;
  }
  function hideBack() {
    clearTimeout(pointerTimer);
    el('player-close').className = '';
    el('tv-player').classList.remove('pointer-active');
  }
  function showBack() {
    if (!opened) { return; }
    clearTimeout(pointerTimer);
    el('player-close').className = 'visible';
    el('tv-player').classList.add('pointer-active');
    pointerTimer = setTimeout(hideBack, 2200);
  }
  function prepare(index) {
    var channel = channels[index];
    if (opened || !channel || channel.blocked || !/\.m3u8(?:\?|$)/i.test(channel.url)) { return; }
    var cached = prepared[channel.url];
    if (cached && Date.now() - cached.at < 45000) { return; }
    if (warmRequest && warmRequest.channelUrl === channel.url) { return; }
    if (warmRequest) { warmRequest.abort(); }
    var xhr = new XMLHttpRequest();
    warmRequest = xhr;
    xhr.channelUrl = channel.url;
    xhr.open('GET', channel.url, true);
    xhr.timeout = 2500;
    xhr.onload = function () {
      if (warmRequest === xhr) { warmRequest = null; }
      if (xhr.status < 200 || xhr.status >= 300) { return; }
      var lines = xhr.responseText.split(/\r?\n/);
      var best = null;
      for (var i = 0; i < lines.length - 1; i++) {
        var resolution = /RESOLUTION=\d+x(\d+)/i.exec(lines[i]);
        var bitrate = /(?:^|[:,])BANDWIDTH=(\d+)/i.exec(lines[i]);
        if (lines[i].indexOf('#EXT-X-STREAM-INF:') !== 0 || !resolution || Number(resolution[1]) < 720) { continue; }
        var uri = lines[i + 1].replace(/^\s+|\s+$/g, '');
        if (!uri || uri.charAt(0) === '#') { continue; }
        var base = document.createElement('a');
        base.href = xhr.responseURL || channel.url;
        var full = /^https?:\/\//i.test(uri) ? uri : uri.indexOf('//') === 0 ? base.protocol + uri : base.protocol + '//' + base.host + (uri.charAt(0) === '/' ? uri : base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + uri);
        if (!/^https?:\/\//i.test(full)) { continue; }
        var rate = bitrate ? Number(bitrate[1]) : Number(resolution[1]);
        if (!best || rate < best.rate) { best = { url: full, rate: rate }; }
      }
      if (best) { prepared[channel.url] = { url: best.url, at: Date.now() }; }
    };
    xhr.onerror = xhr.ontimeout = xhr.onabort = function () { if (warmRequest === xhr) { warmRequest = null; } };
    xhr.send();
  }
  function readCache() { try { return localStorage.getItem('home.iptv.bel.v1'); } catch (e) { return null; } }
  function render(text, label) {
    var parsed = hdChannels(parse(text));
    if (opened) { return false; }
    stopChecks();
    renderVersion++;
    channels = parsed;
    el('channels').textContent = '';
    channels.forEach(function (channel, index) {
      var button = document.createElement('button');
      button.className = 'tile channel-tile';
      button.setAttribute('data-item', 'channel-' + index);
      button.setAttribute('data-channel', index);
      button.setAttribute('data-order-key', channel.url);
      button.setAttribute('aria-label', 'Смотреть ' + channel.name);
      var mark = document.createElement('span');
      mark.className = 'channel-mark';
      mark.textContent = channel.name.replace(/\s*\(.*$/, '').slice(0, 2).toUpperCase();
      if (channel.logo) {
        var image = document.createElement('img');
        image.className = 'channel-logo';
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        image.onerror = function () { image.style.display = 'none'; };
        image.onload = function () { mark.className = 'channel-mark has-logo'; };
        var localLogo = window.CHANNEL_LOGOS && window.CHANNEL_LOGOS[channel.id];
        image.src = localLogo || channel.logo;
        mark.appendChild(image);
      }
      var name = document.createElement('span');
      name.className = 'channel-name';
      name.textContent = channel.name.replace(/\s*\[.*?\]/g, '');
      var detail = document.createElement('span');
      detail.className = 'channel-detail';
      detail.textContent = '';
      button.appendChild(mark); button.appendChild(name); button.appendChild(detail);
      el('channels').appendChild(button);
    });
    window.HomeOrder.apply(el('channels'));
    el('channels-status').textContent = channels.length + ' каналов HD · ' + label;
    onRender();
    scheduleChecks();
    return true;
  }
  function fetchList(url, done) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 12000;
    xhr.onload = function () { done(xhr.status >= 200 && xhr.status < 300 || xhr.status === 0 ? xhr.responseText : null); };
    xhr.onerror = xhr.ontimeout = function () { done(null); };
    xhr.send();
    return xhr;
  }
  function refresh() {
    if (request || navigator.onLine === false) { return; }
    request = fetchList(source, function (text) {
      request = null;
      if (text && parse(text).length) {
        try { localStorage.setItem('home.iptv.bel.v1', text); } catch (e) { /* Cache optional. */ }
        render(text, 'iptv-org');
      } else { el('channels-status').textContent = channels.length + ' каналов HD · сохранённый список'; }
    });
  }
  function close() {
    opened = false; generation++; clearTimeout(timeout); hideBack();
    status('');
    var video = el('tv-video');
    video.pause(); video.removeAttribute('src'); video.load();
    el('tv-player').hidden = true;
    el('screen').removeAttribute('aria-hidden');
    onClose();
    scheduleChecks();
  }
  function play(index) {
    if (!channels.length) { return; }
    active = (index + channels.length) % channels.length;
    var channel = channels[active];
    if (channel.blocked) { return; }
    stopChecks();
    if (warmRequest) { warmRequest.abort(); }
    var video = el('tv-video');
    generation++;
    var token = generation;
    opened = true;
    el('tv-player').hidden = false;
    el('screen').setAttribute('aria-hidden', 'true');
    el('tv-player').setAttribute('aria-label', 'IPTV: ' + channel.name);
    el('tv-player').focus();
    hideBack();
    startedAt = Date.now();
    firstFrame = false;
    clearTimeout(timeout); video.pause();
    status('Подключение к эфиру…');
    var ready = prepared[channel.url];
    video.src = ready && Date.now() - ready.at < 45000 ? ready.url : channel.url;
    /* Setting src then play starts resource selection; load() would reset it. */
    if (/\/mpegts(?:\?|$)/i.test(channel.url)) { status('MPEG-TS: совместимость этого потока с ТВ нужно проверить'); }
    else if (!video.canPlayType('application/vnd.apple.mpegurl') && !video.canPlayType('application/x-mpegURL')) {
      status('Браузер не поддерживает HLS. Нажмите Back для возврата.', true);
      return;
    }
    timeout = setTimeout(function () { if (opened && token === generation) { status('Поток не ответил. Нажмите Back и выберите другой канал.', true); } }, 20000);
    var promise = video.play();
    if (promise && promise.catch) { promise.catch(function () { if (opened && token === generation) { status('Не удалось запустить эфир. OK — повторить, Back — выйти.', true); } }); }
  }
  root.IPTV = {
    isOpen: function () { return opened; },
    play: play,
    prepare: prepare,
    init: function (rendered, closed) {
      onRender = rendered; onClose = closed;
      var cached = readCache();
      if (cached) { render(cached, 'сохранённый список'); }
      fetchList('channels.m3u', function (text) {
        if (!channels.length && text) { render(text, 'локальный список'); }
        if (!channels.length) { el('channels-status').textContent = 'Не удалось загрузить каналы'; }
        refresh();
      });
      window.addEventListener('online', function () { refresh(); scheduleChecks(); });
      window.addEventListener('offline', function () {
        stopChecks();
        channels.forEach(function (channel, index) { setHealth(index, { state: 'unknown', reason: 'Нет сети для проверки' }); });
      });
      el('player-close').addEventListener('click', close);
      el('tv-player').addEventListener('mousemove', showBack);
      el('tv-player').addEventListener('mouseleave', hideBack);
      el('player-close').addEventListener('mouseenter', function () { clearTimeout(pointerTimer); });
      el('player-close').addEventListener('mouseleave', showBack);
      var video = el('tv-video');
      video.addEventListener('playing', function () { if (opened) { clearTimeout(timeout); status('');
        setHealth(active, { state: 'available', reason: 'Эфир воспроизводится' });
        if (!firstFrame) { firstFrame = true; console.info('IPTV first frame: ' + (Date.now() - startedAt) + ' ms'); } } });
      video.addEventListener('waiting', function () { if (opened) { status('Буферизация…'); } });
      video.addEventListener('error', function () {
        if (opened && video.getAttribute('src')) {
          var original = channels[active].url;
          if (video.getAttribute('src') !== original) {
            delete prepared[original];
            play(active);
            return;
          }
          if (navigator.onLine !== false && video.error && video.error.code !== 1) {
            setHealth(active, { state: 'unavailable', reason: 'Ошибка воспроизведения' });
          }
          clearTimeout(timeout); status('Канал недоступен или формат не поддерживается. Back — выйти.', true);
        }
      });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { stopChecks(); if (opened) { close(); } }
        else { scheduleChecks(); }
      });
      setInterval(function () { if (!opened && !document.hidden) { checkChannels(); } }, 300000);
      var lastChannelKey = 0;
      window.addEventListener('keydown', function (event) {
        var direction = window.HomeRemote.channelDirection(event);
        if (!opened || !direction) { return; }
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.repeat && Date.now() - lastChannelKey < 300) { return; }
        lastChannelKey = Date.now();
        var buttons = el('channels').querySelectorAll('[data-channel]');
        var order = Array.prototype.map.call(buttons, function (button) { return Number(button.getAttribute('data-channel')); });
        var next = window.HomeRemote.nextAvailable(order, active, direction, function (index) { return channels[index].blocked; });
        if (next !== null && next !== active) { play(next); }
      }, true);
      document.addEventListener('keydown', function (event) {
        if (!opened) { return; }
        var key = event.keyCode;
        if (key === 27 || key === 461) { event.preventDefault(); event.stopImmediatePropagation(); close(); }
        else if (key === 13 || key === 32) {
          event.preventDefault();
          if (video.paused) {
            var attempt = video.play();
            if (attempt && attempt.catch) { attempt.catch(function () { status('Эфир недоступен. Back — выйти.', true); }); }
          }
        } else if (key === 9) { event.preventDefault(); }

      });
    }
  };
}(this));
