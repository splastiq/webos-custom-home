(function () {
  'use strict';
  var config = window.HOME_CONFIG;
  var selected = 0;
  var tiles;
  var selectedTile = null;
  var toastTimer;
  var lastWheel = 0;
  function el(id) { return document.getElementById(id); }
  function resize() {
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    el('screen').style.transform = 'scale(' + scale + ')';
    el('screen').style.marginLeft = Math.max(0, (window.innerWidth - 1920 * scale) / 2) + 'px';
  }
  function toast(message) {
    clearTimeout(toastTimer);
    el('toast').textContent = message;
    el('toast').className = 'visible';
    toastTimer = setTimeout(function () { el('toast').className = ''; }, 4000);
  }
  function select(index, focus) {
    selected = Math.max(0, Math.min(tiles.length - 1, index));
    if (!tiles.length) { selectedTile = null; return; }
    if (selectedTile !== tiles[selected]) {
      if (selectedTile) { selectedTile.classList.remove('selected'); selectedTile.tabIndex = -1; }
      selectedTile = tiles[selected]; selectedTile.classList.add('selected'); selectedTile.tabIndex = 0;
    }
    if (tiles[selected].hasAttribute('data-channel')) { window.IPTV.prepare(Number(tiles[selected].getAttribute('data-channel'))); }
    if (tiles[selected].parentNode.id === 'channels' || tiles[selected].parentNode.id === 'apps') {
      var viewport = el(tiles[selected].parentNode.id + '-viewport');
      var tile = tiles[selected];
      if (tile.offsetLeft < viewport.scrollLeft + 65) { viewport.scrollLeft = Math.max(0, tile.offsetLeft - 65); }
      else if (tile.offsetLeft + tile.offsetWidth > viewport.scrollLeft + viewport.clientWidth - 65) { viewport.scrollLeft = tile.offsetLeft + tile.offsetWidth - viewport.clientWidth + 65; }
    }
    if (focus) { tiles[selected].focus(); }
  }
  function activate(index, key) { activateTile(tiles[index], key); }
  function activateTile(tile, key) {
    if (!tile || tile.disabled) { return; }
    if (tile.id === 'clock') { window.HomeScreensaver.start(key); return; }
    if (tile.id === 'settings-open') { window.HomeSettings.open(tile); return; }
    if (tile.hasAttribute('data-library')) { window.HomeLibrary.open(tile.getAttribute('data-library'), tile); return; }
    if (tile.hasAttribute('data-channel') && tile.getAttribute('aria-disabled') === 'true') { toast('Поток недоступен'); return; }
    if (tile.hasAttribute('data-channel')) {
      window.IPTV.play(Number(tile.getAttribute('data-channel')), window.HomeLibrary.isOpen() ? window.HomePlaylists.selectedId() : 'favorites'); return;
    }
    var appIndex = tile.getAttribute('data-app');
    var id = appIndex !== null ? config.apps[Number(appIndex)].id : tile.getAttribute('data-launch-id');
    if (!window.TV.available) { toast('Предпросмотр: ' + tile.textContent); return; }
    if (!id) { toast('Не задан идентификатор приложения'); return; }
    window.TV.launch(id, function (error) { if (error) { toast(error); } });
  }
  function move(key) {
    var rows = [el('clock-widget'), el('apps-heading'), el('apps'), el('channels-heading'), el('channels'), el('inputs-heading'), el('inputs')];
    var row = tiles[selected].parentNode;
    var rowIndex = rows.indexOf(row);
    var members = row.querySelectorAll('[data-item]:not(:disabled):not([hidden])');
    var column = Array.prototype.indexOf.call(members, tiles[selected]);
    var target = tiles[selected];
    if (key === 37 || key === 39) { target = members[Math.max(0, Math.min(members.length - 1, column + (key === 37 ? -1 : 1)))]; }
    else {
      var step = key === 38 ? -1 : 1;
      var nextRow = rowIndex + step;
      while (nextRow >= 0 && nextRow < rows.length) {
        var candidates = rows[nextRow].querySelectorAll('[data-item]:not(:disabled):not([hidden])');
        if (candidates.length) { target = candidates[Math.min(column, candidates.length - 1)]; break; }
        nextRow += step;
      }
    }
    select(Array.prototype.indexOf.call(tiles, target), true);
  }

  window.HomeApps.init(el('apps'));
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
    if (!window.TV.available || usbRequest || document.hidden || window.HomeScreensaver.isActive()) { return; }
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
      window.HomeLibrary.refresh();
    });
  }
  function bindTiles() {
    var old = tiles && tiles[selected];
    var hadFocus = old && document.activeElement === old;
    window.HomeFavorites.apply('apps'); window.HomeFavorites.apply('channels');
    var all = document.querySelectorAll('[data-item]');
    for (var k = 0; k < all.length; k++) {
      if (all[k].disabled) { all[k].classList.remove('selected'); all[k].tabIndex = -1; }
    }
    tiles = document.querySelectorAll('[data-item]:not(:disabled):not([hidden])');
    for (var j = 0; j < tiles.length; j++) { if (tiles[j] !== selectedTile) { tiles[j].tabIndex = -1; } }
    var current = old ? Array.prototype.indexOf.call(tiles, old) : Array.prototype.indexOf.call(tiles, el('apps-heading').querySelector('button'));
    select(current < 0 ? Math.min(selected, tiles.length - 1) : current, hadFocus && !window.IPTV.isOpen() && !window.HomeLibrary.isOpen() && !window.HomeOrder.busy());
  }
  function homeTarget(event) {
    if (window.HomeScreensaver.isActive() || window.IPTV.isOpen() || window.HomeLibrary.isOpen() || window.HomeSettings.isOpen() || window.HomeOrder.busy()) { return null; }
    var node = event.target;
    while (node && node !== el('screen')) {
      if (node.hasAttribute && node.hasAttribute('data-item')) { return node; }
      node = node.parentNode;
    }
    return null;
  }
  el('screen').addEventListener('mouseover', function (event) {
    var tile = homeTarget(event); if (!tile || (event.relatedTarget && tile.contains(event.relatedTarget))) { return; }
    select(Array.prototype.indexOf.call(tiles, tile), true);
  });
  el('screen').addEventListener('focus', function (event) {
    var tile = homeTarget(event); if (tile) { select(Array.prototype.indexOf.call(tiles, tile), false); }
  }, true);
  el('screen').addEventListener('click', function (event) {
    var tile = homeTarget(event); if (tile) { select(Array.prototype.indexOf.call(tiles, tile), false); activateTile(tile); }
  });
  window.HomeLibrary.init(activateTile, bindTiles);
  bindTiles();
  window.HomeOrder.init(bindTiles, toast, function () { return !window.IPTV.isOpen() && !window.HomeLibrary.isOpen(); });
  refreshUSB();
  setInterval(refreshUSB, 15000);
  window.IPTV.init(bindTiles, function () { if (window.HomeLibrary.isOpen()) { window.HomeLibrary.restoreFocus(); } else { select(selected, true); } });
  document.addEventListener('keydown', function (event) {
    var key = event.keyCode;
    if (window.IPTV.isOpen() || window.HomeLibrary.isOpen() || window.HomeSettings.isOpen()) { return; }
    if (key >= 37 && key <= 40) { event.preventDefault(); move(key); }
    if (key === 13 || key === 32) { event.preventDefault(); activate(selected, key); }
    if (key === 9) { event.preventDefault(); select((selected + (event.shiftKey ? tiles.length - 1 : 1)) % tiles.length, true); }
    if (key === 27 || key === 461) { event.preventDefault(); select(0, true); }
  });
  el('screen').addEventListener('wheel', function (event) {
    if (window.IPTV.isOpen() || window.HomeLibrary.isOpen() || window.HomeSettings.isOpen() || window.HomeOrder.busy() || Date.now() - lastWheel < 180 || (!event.deltaY && !event.deltaX)) { return; }
    event.preventDefault(); lastWheel = Date.now(); select((selected + ((event.deltaY || event.deltaX) > 0 ? 1 : tiles.length - 1)) % tiles.length, true);
  });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { refreshUSB(); } });
  resize(); select(selected, false); window.HomeWidgets.init(); window.HomeScreensaver.init(); window.HomeSettings.init();
}());
