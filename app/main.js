(function () {
  'use strict';
  var config = window.HOME_CONFIG;
  var selected = 0;
  var tiles;
  var toastTimer;
  var weatherRequest = null;
  var lastWheel = 0;
  var storage = {
    get: function (key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } },
    set: function (key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* Storage may be unavailable. */ } }
  };
  function el(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function resize() {
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    el('screen').style.transform = 'scale(' + scale + ')';
    el('screen').style.marginLeft = Math.max(0, (window.innerWidth - 1920 * scale) / 2) + 'px';
  }
  function clock() {
    var now = new Date();
    var minsk = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
    var hour = minsk.getHours();
    el('clock').textContent = pad(hour) + ':' + pad(minsk.getMinutes());
    el('date').textContent = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'][minsk.getDay()] + ', ' + minsk.getDate() + ' ' + ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][minsk.getMonth()] + ' ' + minsk.getFullYear();
    el('greeting').textContent = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  }
  function toast(message) {
    clearTimeout(toastTimer);
    el('toast').textContent = message;
    el('toast').className = 'visible';
    toastTimer = setTimeout(function () { el('toast').className = ''; }, 4000);
  }
  function select(index, focus) {
    selected = Math.max(0, Math.min(tiles.length - 1, index));
    for (var i = 0; i < tiles.length; i++) {
      tiles[i].classList.toggle('selected', i === selected);
      tiles[i].tabIndex = i === selected ? 0 : -1;
    }
    if (tiles[selected].hasAttribute('data-channel')) { window.IPTV.prepare(Number(tiles[selected].getAttribute('data-channel'))); }
    if (tiles[selected].parentNode.id === 'channels' || tiles[selected].parentNode.id === 'apps') {
      var viewport = el(tiles[selected].parentNode.id + '-viewport');
      var tile = tiles[selected];
      if (tile.offsetLeft < viewport.scrollLeft) { viewport.scrollLeft = tile.offsetLeft; }
      else if (tile.offsetLeft + tile.offsetWidth > viewport.scrollLeft + viewport.clientWidth) { viewport.scrollLeft = tile.offsetLeft + tile.offsetWidth - viewport.clientWidth + 12; }
    }
    if (focus) { tiles[selected].focus(); }
  }
  function activate(index) {
    var tile = tiles[index];
    if (!tile || tile.disabled) { return; }
    if (tile.hasAttribute('data-channel')) { window.IPTV.play(Number(tile.getAttribute('data-channel'))); return; }
    var appIndex = tile.getAttribute('data-app');
    var id = appIndex !== null ? config.apps[Number(appIndex)].id : tile.getAttribute('data-launch-id');
    if (!window.TV.available) { toast('Предпросмотр: ' + tile.textContent); return; }
    if (!id) { toast('Не задан идентификатор приложения'); return; }
    window.TV.launch(id, function (error) { if (error) { toast(error); } });
  }
  function move(key) {
    var rows = [el('apps'), el('channels'), el('inputs')];
    var row = tiles[selected].parentNode;
    var rowIndex = rows.indexOf(row);
    var members = row.querySelectorAll('[data-item]:not(:disabled)');
    var column = Array.prototype.indexOf.call(members, tiles[selected]);
    var target = tiles[selected];
    if (key === 37 || key === 39) { target = members[Math.max(0, Math.min(members.length - 1, column + (key === 37 ? -1 : 1)))]; }
    else {
      var step = key === 38 ? -1 : 1;
      var nextRow = rowIndex + step;
      while (nextRow >= 0 && nextRow < rows.length) {
        var candidates = rows[nextRow].querySelectorAll('[data-item]:not(:disabled)');
        if (candidates.length) { target = candidates[Math.min(column, candidates.length - 1)]; break; }
        nextRow += step;
      }
    }
    select(Array.prototype.indexOf.call(tiles, target), true);
  }

  function weatherInfo(code) {
    if (code === 0) { return ['☀', 'Ясно']; }
    if (code <= 3) { return ['☁', 'Облачно']; }
    if (code <= 48) { return ['≋', 'Туман']; }
    if (code <= 67 || (code >= 80 && code <= 82)) { return ['☂', 'Дождь']; }
    if (code <= 77 || code === 85 || code === 86) { return ['❄', 'Снег']; }
    return ['ϟ', 'Гроза'];
  }
  function renderWeather(data, cached) {
    var info = weatherInfo(data.code);
    el('weather-icon').textContent = info[0];
    el('temperature').textContent = Math.round(data.temperature) + '°';
    el('weather-description').textContent = info[1] + ' · Минск';
    var age = Math.max(0, Math.floor((Date.now() - data.savedAt) / 60000));
    el('weather-note').textContent = cached ? 'Сохранено · ' + (age < 60 ? age + ' мин назад' : Math.floor(age / 60) + ' ч назад') : 'Обновлено сейчас';
  }
  function network() {
    var offline = navigator.onLine === false;
    el('network').textContent = offline ? 'Нет сети' : 'Сеть подключена';
    el('network').classList.toggle('offline', offline);
  }
  function weather() {
    network();
    var cached = storage.get('home.weather.v1');
    if (cached && typeof cached.temperature === 'number' && typeof cached.code === 'number' && typeof cached.savedAt === 'number') { renderWeather(cached, true); }
    if (navigator.onLine === false || weatherRequest || document.hidden) {
      if (!cached) { el('weather-note').textContent = 'Прогноз пока недоступен'; }
      return;
    }
    var xhr = new XMLHttpRequest();
    weatherRequest = xhr;
    function failed() { weatherRequest = null; if (!cached) { el('weather-note').textContent = 'Не удалось загрузить прогноз'; } }
    xhr.open('GET', config.weatherUrl, true);
    xhr.timeout = 10000;
    xhr.onload = function () {
      weatherRequest = null;
      try {
        if (xhr.status < 200 || xhr.status >= 300) { failed(); return; }
        var current = JSON.parse(xhr.responseText).current;
        if (!current || typeof current.temperature_2m !== 'number' || typeof current.weather_code !== 'number') { failed(); return; }
        var data = { temperature: current.temperature_2m, code: current.weather_code, savedAt: Date.now() };
        storage.set('home.weather.v1', data);
        renderWeather(data, false);
      } catch (e) { failed(); }
    };
    xhr.onerror = failed;
    xhr.ontimeout = failed;
    xhr.onabort = function () { weatherRequest = null; };
    xhr.send();
  }
  var savedApps = storage.get('home.apps.v2') || {};
  var legacy = storage.get('home.apps.v1');
  config.apps.forEach(function (app, index) {
    var stored = savedApps[app.key];
    if (stored === undefined && legacy && index < 3) { stored = legacy[index]; }
    if (typeof stored === 'string' && stored) { app.id = stored; }
    var button = document.createElement('button');
    button.className = 'tile app-tile';
    button.setAttribute('data-item', 'app-' + app.key);
    button.setAttribute('data-app', index);
    button.setAttribute('data-order-key', app.key);
    button.setAttribute('aria-label', 'Открыть ' + app.name);
    var art = document.createElement('span'); art.className = 'tile-art';
    var image = document.createElement('img'); image.src = app.icon; image.alt = ''; image.draggable = false;
    art.appendChild(image); button.appendChild(art);
    var caption = document.createElement('span'); caption.className = 'tile-caption'; caption.textContent = app.name;
    button.appendChild(caption); el('apps').appendChild(button);

  });
  window.HomeOrder.apply(el('apps'));
  function inputButton(name, id, detail, key, iconPath) {
    var button = document.createElement('button');
    button.className = 'tile input-tile';
    button.setAttribute('data-item', key);
    button.setAttribute('data-launch-id', id);
    var icon = document.createElement('span'); icon.className = 'input-icon';
    if (iconPath) {
      icon.className = 'input-brand-icon';
      var image = document.createElement('img'); image.src = iconPath; image.alt = ''; image.draggable = false; icon.appendChild(image);
    }
    var text = document.createElement('span'); text.className = 'input-name'; text.textContent = name;
    var sub = document.createElement('span'); sub.className = 'input-detail'; sub.textContent = detail;
    text.appendChild(sub); button.appendChild(icon); button.appendChild(text);
    el('inputs').appendChild(button);
    return button;
  }
  config.inputs.forEach(function (input, index) { inputButton(input.name, input.id, input.port, 'input-' + index, input.icon); });
  var usbRequest = false;
  function refreshUSB() {
    if (!window.TV.available || usbRequest || document.hidden) { return; }
    usbRequest = true;
    window.TV.usbDevices(function (error, devices) {
      usbRequest = false;
      if (error) { return; }
      var previous = el('usb-source');
      var hadFocus = previous && document.activeElement === previous;
      if (!devices.length && previous) { previous.parentNode.removeChild(previous); bindTiles(); if (hadFocus) { select(selected, true); } }
      if (devices.length && !previous) {
        var button = inputButton('USB', 'com.webos.app.photovideo', devices.map(function (device) { return device.deviceName || 'Накопитель'; }).join(', '), 'usb');
        button.id = 'usb-source'; bindTiles();
      }
    });
  }
  function bindTiles() {
    var old = tiles && tiles[selected];
    var hadFocus = old && document.activeElement === old;
    var all = document.querySelectorAll('[data-item]');
    for (var k = 0; k < all.length; k++) {
      if (all[k].disabled) { all[k].classList.remove('selected'); all[k].tabIndex = -1; }
    }
    tiles = document.querySelectorAll('[data-item]:not(:disabled)');
    for (var j = 0; j < tiles.length; j++) {
      (function (tile) {
        if (tile.getAttribute('data-bound')) { return; }
        tile.setAttribute('data-bound', 'true');
        function index() { return Array.prototype.indexOf.call(tiles, tile); }
        tile.addEventListener('mouseenter', function () { if (!window.IPTV.isOpen() && !window.HomeOrder.busy()) { select(index(), false); } });
        tile.addEventListener('focus', function () { if (!window.IPTV.isOpen() && !window.HomeOrder.busy()) { select(index(), false); } });
        tile.addEventListener('click', function () { if (!window.IPTV.isOpen() && !window.HomeOrder.busy()) { select(index(), false); activate(index()); } });
      }(tiles[j]));
    }
    var current = old ? Array.prototype.indexOf.call(tiles, old) : 0;
    select(current < 0 ? Math.min(selected, tiles.length - 1) : current, hadFocus && !window.IPTV.isOpen() && !window.HomeOrder.busy());
  }
  bindTiles();
  window.HomeOrder.init(bindTiles, toast, function () { return !window.IPTV.isOpen(); });
  refreshUSB();
  setInterval(refreshUSB, 15000);
  window.IPTV.init(bindTiles, function () { select(selected, true); });
  document.addEventListener('keydown', function (event) {
    var key = event.keyCode;
    if (window.IPTV.isOpen()) { return; }
    if (key >= 37 && key <= 40) { event.preventDefault(); move(key); }
    if (key === 13 || key === 32) { event.preventDefault(); activate(selected); }
    if (key === 9) { event.preventDefault(); select((selected + (event.shiftKey ? tiles.length - 1 : 1)) % tiles.length, true); }
    if (key === 27 || key === 461) { event.preventDefault(); select(0, true); }
  });
  el('screen').addEventListener('wheel', function (event) {
    if (window.IPTV.isOpen() || window.HomeOrder.busy() || Date.now() - lastWheel < 180 || (!event.deltaY && !event.deltaX)) { return; }
    event.preventDefault(); lastWheel = Date.now(); select((selected + ((event.deltaY || event.deltaX) > 0 ? 1 : tiles.length - 1)) % tiles.length, true);
  });
  window.addEventListener('resize', resize);
  window.addEventListener('online', weather);
  window.addEventListener('offline', weather);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { clock(); weather(); refreshUSB(); } else if (weatherRequest) { weatherRequest.abort(); } });
  el('mode').textContent = window.TV.available ? 'webOS · Home' : 'Предпросмотр на Mac';
  resize(); clock(); select(0, false); weather();
  setInterval(function () { if (!document.hidden) { clock(); } }, 1000);
  setInterval(weather, config.weatherInterval);
}());
