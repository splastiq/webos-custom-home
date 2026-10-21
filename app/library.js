/* Fullscreen, remote-friendly grids. Source shelves remain the source of truth. */
(function () {
  'use strict';
  var opened = false;
  var kind;
  var focused = 0;
  var returnTo;
  var activate;
  var changed;
  var requestId = 0;
  var backgrounds = [];
  var channelViews = Object.create(null);
  var visibleButtons = null;
  var highlighted = null;
  var geometry = null;
  function el(id) { return document.getElementById(id); }
  function buttons() {
    if (!visibleButtons) { visibleButtons = el('library-grid').querySelectorAll('button:not(:disabled):not([hidden])'); }
    return visibleButtons;
  }
  function invalidate() { visibleButtons = null; geometry = null; }
  function highlight(button) {
    if (highlighted !== button) {
      if (highlighted) { highlighted.classList.remove('selected'); highlighted.tabIndex = -1; }
      highlighted = button;
      if (button) { button.classList.add('selected'); button.tabIndex = 0; }
    }
  }
  function gridTarget(event) {
    var node = event.target;
    while (node && node !== el('library-grid')) {
      if (node.hasAttribute && node.hasAttribute('data-library-item')) { return node; }
      node = node.parentNode;
    }
    return null;
  }
  function filterChannels() {
    if (kind !== 'channels') { return; }
    var items = el('library-grid').querySelectorAll('button');
    for (var i = 0; i < items.length; i++) { items[i].hidden = !window.HomePlaylists.matches(items[i]); }
    invalidate();
    var visible = buttons().length;
    el('channels-status').textContent = 'Каналов: ' + visible + ' · ' + window.HomePlaylists.title();
    el('library').classList.add('has-playlists');
  }
  function focus(index) {
    var list = buttons();
    focused = Math.max(0, Math.min(list.length - 1, index));
    highlight(list[focused]);
    if (list[focused]) { list[focused].focus(); }
    else { el('library-close').focus(); }
  }
  function add(button, source) {
    button.hidden = false;
    if (kind === 'apps' || kind === 'channels') {
      button.classList.toggle('favorite', window.HomeFavorites.has(source || button, kind));
    }
    if (kind === 'channels') {
      button.disabled = false;
      var logo = button.querySelector('img[data-logo-src]');
      if (logo && logo.getAttribute('data-logo-loaded') !== 'true') { logo.removeAttribute('src'); }
    }
    button.removeAttribute('data-item');
    if (kind !== 'channels') { button.removeAttribute('data-order-key'); }
    button.removeAttribute('data-bound');
    button.classList.remove('selected'); button.classList.remove('reordering');
    button.setAttribute('data-library-item', 'true');
    button._source = source;
    button._channelUrl = source && source.getAttribute('data-order-key');
    if (kind === 'channels') { channelViews[button._channelUrl] = button; button._detail = button.querySelector('.channel-detail'); }
    button.tabIndex = -1; invalidate();
    el('library-grid').appendChild(button);
  }
  function open(type, opener) {
    kind = type; opened = true; returnTo = opener; requestId++;
    var token = requestId;
    el('library').hidden = false;
    el('library').classList.toggle('has-playlists', type === 'channels');
    el('playlist-tools').hidden = type !== 'channels';
    window.HomePlaylists.close();
    backgrounds = Array.prototype.slice.call(el('screen').children).filter(function (node) { return node.id !== 'library' && node.id !== 'toast'; });
    backgrounds.forEach(function (node) { node.setAttribute('aria-hidden', 'true'); });
    el('library-title').textContent = type === 'apps' ? 'Все приложения' : type === 'inputs' ? 'Все источники' : 'Все каналы';
    el('library-note').hidden = false;
    el('channels-status').hidden = type !== 'channels';
    el('library-grid').textContent = ''; channelViews = Object.create(null); invalidate();
    el('library-body').scrollTop = 0;
    var source = el(type).querySelectorAll('button');
    for (var i = 0; i < source.length; i++) {
      var item = source[i];
      add(item.cloneNode(true), item);
    }
    el('library-note').textContent = type === 'inputs' ? 'Доступно источников: ' + source.length : source.length + (type === 'apps' ? ' программ' : ' каналов');
    if (type === 'apps') { el('library-note').textContent = 'Красная кнопка: добавить / удалить из избранного'; }
    if (type === 'channels') { el('library-note').textContent = ''; }
    if (type === 'channels') { window.HomePlaylists.open(function () { filterChannels(); }); filterChannels(); }
    focus(0);
    if (type === 'apps' && window.TV.available) {
      el('library-note').textContent = 'Получение установленных приложений…';
      window.HomeApps.refresh(function (error) {
        // Reconcile the home shelf even if the user left this page during the request.
        changed();
        if (!opened || kind !== type || requestId !== token) { return; }
        if (error) { el('library-note').textContent = 'Сохранённые приложения · полный список ТВ недоступен'; return; }
        el('library-grid').textContent = ''; channelViews = Object.create(null); invalidate();
        var source = el('apps').querySelectorAll('button');
        for (var i = 0; i < source.length; i++) { add(source[i].cloneNode(true), source[i]); }
        el('library-note').textContent = 'Приложений: ' + source.length + ' · Красная кнопка: избранное';
        focus(0);
      });
    }
  }
  function close() {
    opened = false; requestId++; window.HomePlaylists.close(); el('library').hidden = true;
    backgrounds.forEach(function (node) { node.removeAttribute('aria-hidden'); });
    if (returnTo && document.documentElement.contains(returnTo)) { returnTo.focus(); }
  }
  window.HomeLibrary = {
    isOpen: function () { return opened; },
    orderChanged: invalidate,
    canReorder: function () { return opened && kind === 'channels' && window.HomePlaylists.selectedId() === 'favorites'; }, open: open,
    catalogChanged: function () {
      if (!opened || kind !== 'channels') { return; }
      var wasInGrid = el('library-grid').contains(document.activeElement);
      el('library-grid').textContent = ''; channelViews = Object.create(null); invalidate();
      var source = el('channels').querySelectorAll('button');
      for (var i = 0; i < source.length; i++) { add(source[i].cloneNode(true), source[i]); }
      filterChannels(); if (wasInGrid) { focus(focused); }
    },
    restoreFocus: function () { if (opened) { focus(focused); } },
    refresh: function (source) {
      if (!opened) { return; }
      if (kind === 'inputs') {
        var sourcesNow = el('inputs').querySelectorAll('button');
        var existing = el('library-grid').querySelectorAll('button');
        var sourcesChanged = sourcesNow.length !== existing.length;
        for (var n = 0; !sourcesChanged && n < sourcesNow.length; n++) { sourcesChanged = sourcesNow[n].getAttribute('data-launch-id') !== existing[n].getAttribute('data-launch-id'); }
        if (sourcesChanged) {
          var onClose = document.activeElement === el('library-close');
          el('library-grid').textContent = ''; channelViews = Object.create(null); invalidate();
          for (var k = 0; k < sourcesNow.length; k++) { add(sourcesNow[k].cloneNode(true), sourcesNow[k]); }
          el('library-note').textContent = 'Доступно источников: ' + sourcesNow.length;
          if (!onClose) { focus(focused); }
        }
        return;
      }
      if (kind !== 'channels') { return; }
      if (!source) { return; }
      var item = channelViews[source.getAttribute('data-order-key')];
      if (!item) { return; }
      item.setAttribute('data-channel', source.getAttribute('data-channel'));
      item.setAttribute('aria-disabled', source.disabled ? 'true' : 'false');
      item.setAttribute('data-health', source.getAttribute('data-health') || '');
      item.title = source.title;
      item._detail.textContent = source._detail.textContent;
    },
    init: function (onActivate, onChanged) {
      activate = onActivate; changed = onChanged; window.HomePlaylists.init();
      el('library-grid').addEventListener('focus', function (event) {
        var button = gridTarget(event); if (!button) { return; }
        focused = Array.prototype.indexOf.call(buttons(), button); highlight(button);
      }, true);
      el('library-grid').addEventListener('mouseover', function (event) {
        var button = gridTarget(event);
        if (button && !button.disabled && !(event.relatedTarget && button.contains(event.relatedTarget))) { button.focus(); }
      });
      el('library-grid').addEventListener('click', function (event) {
        var button = gridTarget(event); if (button && !button.disabled) { activate(button); }
      });
      el('library-close').addEventListener('click', close);
      document.addEventListener('keydown', function (event) {
        if (!opened || window.IPTV.isOpen()) { return; }
        var key = event.keyCode;
        var formOpen = !el('playlist-form').hidden || !el('playlist-delete-form').hidden;
        if (kind === 'channels' && formOpen) {
          if (key === 27 || key === 461) { event.preventDefault(); event.stopImmediatePropagation(); window.HomePlaylists.close(); el('playlist-add').focus(); }
          if ((key === 38 || key === 40 || key === 37 || key === 39) && event.target.tagName !== 'TEXTAREA') {
            var isText = event.target.tagName === 'INPUT';
            if (!isText || key === 38 || key === 40) {
              event.preventDefault(); event.stopImmediatePropagation();
              var panel = !el('playlist-form').hidden ? el('playlist-form') : el('playlist-delete-form');
              var fields = panel.querySelectorAll('input,textarea,button:not(:disabled)');
              var currentField = Array.prototype.indexOf.call(fields, document.activeElement);
              fields[Math.max(0, Math.min(fields.length - 1, currentField + (key === 38 || key === 37 ? -1 : 1)))].focus();
            }
          }
          return;
        }
        var inTools = el('playlist-tools').contains(document.activeElement);
        if (kind === 'channels' && inTools) {
          if (key === 27 || key === 461) { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
          if (key === 40) { event.preventDefault(); event.stopImmediatePropagation(); focus(0); return; }
          if (key === 37 || key === 39) {
            event.preventDefault(); event.stopImmediatePropagation();
            var controls = el('playlist-tools').querySelectorAll('button:not([hidden])');
            var position = Array.prototype.indexOf.call(controls, document.activeElement);
            controls[Math.max(0, Math.min(controls.length - 1, position + (key === 37 ? -1 : 1)))].focus(); return;
          }
          return;
        }
        if ((key === 403 || event.key === 'ColorF0Red' || (!window.TV.available && key === 82)) && (kind === 'apps' || kind === 'channels')) {
          event.preventDefault(); event.stopImmediatePropagation();
          var selected = event.target;
          while (selected && selected !== el('library') && !selected.hasAttribute('data-library-item')) { selected = selected.parentElement; }
          if (!selected || !selected.hasAttribute('data-library-item')) { selected = null; }
          if (selected && document.activeElement !== el('library-close')) {
            var favorite = window.HomeFavorites.toggle(selected._source || selected, kind);
            if (favorite === null) { el('library-note').textContent = 'Не удалось сохранить избранное. Проверьте свободное место.'; return; }
            selected.classList.toggle('favorite', favorite); changed(); filterChannels(); if (selected.hidden) { focus(focused); } else { selected.focus(); }
            el('library-note').hidden = false;
            el('library-note').textContent = '';
          }
          return;
        }
        var list = buttons();
        var onBack = document.activeElement === el('library-close');
        if ([27, 461, 37, 38, 39, 40, 9, 13, 32].indexOf(key) === -1) { return; }
        event.preventDefault(); event.stopImmediatePropagation();
        if (key === 27 || key === 461) { close(); return; }
        if (key === 13 || key === 32) { if (onBack) { close(); } else if (list[focused]) { activate(list[focused]); } return; }
        if (key === 9) {
          if (onBack) { focus(event.shiftKey ? list.length - 1 : 0); }
          else if ((!event.shiftKey && focused === list.length - 1) || (event.shiftKey && focused === 0)) { el('library-close').focus(); }
          else { focus(focused + (event.shiftKey ? -1 : 1)); }
          return;
        }
        if (onBack) { if (key === 40 || key === 38) { if (kind === 'channels') { el('playlist-tabs').querySelector('[aria-selected="true"]').focus(); } else { focus(0); } } return; }
        if (key === 38 || key === 40) {
          var current = list[focused];
          if (!current) { return; }
          if (!geometry) {
            geometry = [];
            for (var g = 0; g < list.length; g++) { geometry.push({ top: list[g].offsetTop, left: list[g].offsetLeft }); }
          }
          var rect = geometry[focused];
          var best = -1;
          var score = Infinity;
          for (var i = 0; i < list.length; i++) {
            var candidate = geometry[i];
            var dy = candidate.top - rect.top;
            if ((key === 38 && dy >= -5) || (key === 40 && dy <= 5)) { continue; }
            var value = Math.abs(dy) * 10 + Math.abs(candidate.left - rect.left);
            if (value < score) { best = i; score = value; }
          }
          if (best >= 0) { focus(best); } else if (key === 38) { if (kind === 'channels') { el('playlist-tabs').querySelector('[aria-selected="true"]').focus(); } else { el('library-close').focus(); } }
        } else { focus(focused + (key === 37 ? -1 : 1)); }
      }, true);
    }
  };
}());
