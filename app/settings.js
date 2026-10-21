/* Settings UI: bounded thumbnail work, delegated controls, ES5 remote navigation. */
(function () {
  'use strict';
  var opened = false;
  var returnTo;
  var cards = [];
  var focused = 0;
  var previewTimer;
  var previewAsset = null;
  var assets = Object.create(null);
  function el(id) { return document.getElementById(id); }
  function status() {
    var count = window.HomeAerialSelection.filter(window.HomeScreensaver.assets()).length;
    el('aerial-selection-status').textContent = 'Apple Aerial · ' + cards.length + ' заставок · В избранном: ' + count +
      (count ? '' : ' · Выберите заставки. Пока показываются только часы.');
  }
  function loadPreviews() {
    clearTimeout(previewTimer);
    if (!opened) { return; }
    var bounds = el('aerial-settings-body').getBoundingClientRect();
    cards.forEach(function (card) {
      if (!card._preview) { return; }
      var rect = card.getBoundingClientRect();
      if (rect.bottom < bounds.top - 150 || rect.top > bounds.bottom + 200) { return; }
      var image = document.createElement('img'); image.alt = ''; image.draggable = false;
      image.onerror = function () { image.hidden = true; };
      image.src = card._preview; card._preview = ''; card.querySelector('.aerial-art').appendChild(image);
    });
  }
  function focus(index) {
    focused = Math.max(0, Math.min(cards.length - 1, index));
    if (!cards[focused]) { el('settings-close').focus(); return; }
    cards[focused].focus();
    var body = el('aerial-settings-body'); var card = cards[focused];
    if (card.offsetTop < body.scrollTop) { body.scrollTop = card.offsetTop; }
    else if (card.offsetTop + card.offsetHeight > body.scrollTop + body.clientHeight) { body.scrollTop = card.offsetTop + card.offsetHeight - body.clientHeight; }
    loadPreviews();
  }
  function toggle(card) {
    var selected = window.HomeAerialSelection.toggle(card.getAttribute('data-aerial-id'));
    if (selected === null) { el('aerial-settings-error').textContent = 'Не удалось сохранить выбор: недостаточно места.'; return; }
    el('aerial-settings-error').textContent = '';
    card.setAttribute('data-favorite', selected ? 'true' : 'false');
    window.HomeScreensaver.selectionChanged(); status();
  }
  function target(event) {
    var node = event.target;
    while (node && node !== el('aerial-settings-grid')) {
      if (node.hasAttribute && node.hasAttribute('data-aerial-id')) { return node; }
      node = node.parentNode;
    }
    return null;
  }
  function closePreview() {
    previewAsset = null;
    window.HomeAerialPreview.close();
    el('aerial-preview-panel').hidden = true; el('settings').classList.remove('has-aerial-preview');
    window.IPTV.setAmbient(false); focus(focused);
  }
  function showPreview(card) {
    var asset = assets[card.getAttribute('data-aerial-id')];
    if (!asset) { return; }
    focused = cards.indexOf(card); previewAsset = asset;
    el('settings').classList.add('has-aerial-preview'); el('aerial-preview-panel').hidden = false;
    el('aerial-preview-title').textContent = asset.label;
    var metadata = el('aerial-preview-metadata'); metadata.textContent = '';
    var details = asset.metadata || {};
    var capitalize = function (value) { return typeof value === 'string' && value ? value.charAt(0).toUpperCase() + value.slice(1) : ''; };
    var values = [details.accessibilityLabel || '', [capitalize(details.timeOfDay), capitalize(details.scene)].filter(function (value) { return !!value; }).join(' | ')];
    values.forEach(function (text) {
      if (!text) { return; }
      var value = document.createElement('dd'); value.textContent = text; metadata.appendChild(value);
    });
    el('aerial-preview-info').scrollTop = 0; window.IPTV.setAmbient(true);
    window.HomeAerialPreview.play(asset); focus(focused);
  }
  function close() {
    if (previewAsset) { closePreview(); }
    opened = false; clearTimeout(previewTimer); el('settings').hidden = true;
    el('settings').parentNode.removeAttribute('data-settings-open');
    ['hero','apps-section','channels-section','inputs-section'].forEach(function (name) {
      var node = document.querySelector('.' + name); if (node) { node.removeAttribute('aria-hidden'); }
    });
    if (returnTo && document.documentElement.contains(returnTo)) { returnTo.focus(); }
  }
  window.HomeSettings = {
    isOpen: function () { return opened; },
    open: function (button) {
      if (opened) { return; }
      opened = true; returnTo = button || document.activeElement; cards = []; assets = Object.create(null);
      el('settings').hidden = false; el('settings').parentNode.setAttribute('data-settings-open', 'true');
      ['hero','apps-section','channels-section','inputs-section'].forEach(function (name) {
        var node = document.querySelector('.' + name); if (node) { node.setAttribute('aria-hidden', 'true'); }
      });
      el('aerial-settings-grid').textContent = ''; el('aerial-settings-error').textContent = '';
      var fragment = document.createDocumentFragment();
      window.HomeScreensaver.assets().forEach(function (asset) {
        assets[asset.id] = asset;
        var card = document.createElement('button'); card.type = 'button'; card.className = 'aerial-card';
        card.setAttribute('data-aerial-id', asset.id); card.setAttribute('data-favorite', window.HomeAerialSelection.has(asset.id) ? 'true' : 'false');
        card.setAttribute('aria-label', asset.label);
        var art = document.createElement('span'); art.className = 'aerial-art'; card.appendChild(art);
        var title = document.createElement('span'); title.className = 'aerial-title'; title.textContent = asset.label; card.appendChild(title);
        var place = document.createElement('span'); place.className = 'aerial-place'; place.textContent = asset.location || ''; card.appendChild(place);
        card._preview = asset.preview; cards.push(card); fragment.appendChild(card);
      });
      el('aerial-settings-grid').appendChild(fragment); el('aerial-settings-body').scrollTop = 0; status(); focus(0);
    },
    init: function () {
      window.HomeAerialPreview.init(el('aerial-preview-video'), el('aerial-preview-status'), el('aerial-preview-slot'), el('aerial-preview-surface'), el('aerial-preview-cover'));
      el('aerial-preview-close').addEventListener('click', closePreview);
      el('settings-close').addEventListener('click', close);
      el('aerial-settings-grid').addEventListener('click', function (event) { var card = target(event); if (card) { showPreview(card); } });
      el('aerial-settings-grid').addEventListener('mouseover', function (event) { var card = target(event); if (card && !(event.relatedTarget && card.contains(event.relatedTarget))) { card.focus(); } });
      el('aerial-settings-grid').addEventListener('focus', function (event) { var card = target(event); if (card) { focused = cards.indexOf(card); loadPreviews(); } }, true);
      el('aerial-settings-body').addEventListener('scroll', function () { clearTimeout(previewTimer); previewTimer = setTimeout(loadPreviews, 80); });
      document.addEventListener('keydown', function (event) {
        if (!opened) { return; }
        var key = event.keyCode; var card = target(event);
        if ([27,461,37,38,39,40,13,32,403,82,9,33,34].indexOf(key) === -1) { return; }
        event.preventDefault(); event.stopImmediatePropagation();
        if (key === 27 || key === 461) { if (previewAsset) { closePreview(); } else { close(); } return; }
        if (key === 403 || (key === 82 && !window.TV.available)) {
          if (event.repeat) { return; }
          if (card) { toggle(card); } return;
        }
        if (key === 13 || key === 32) {
          if (event.repeat) { return; }
          if (card) { showPreview(card); }
          else if (event.target === el('aerial-preview-close')) { closePreview(); }
          else if (event.target === el('settings-close')) { close(); }
          return;
        }
        if (previewAsset && !card) {
          if (key === 37) { focus(focused); return; }
          if (key === 9) {
            if (event.target === el('aerial-preview-close')) { el('aerial-preview-info').focus(); }
            else if (event.target === el('aerial-preview-info')) { el('settings-close').focus(); }
            else { focus(focused); } return;
          }
          if (event.target === el('aerial-preview-close')) { el('aerial-preview-info').focus(); return; }
          if (event.target === el('aerial-preview-info')) {
            var amount = key === 33 || key === 34 ? 240 : 65;
            el('aerial-preview-info').scrollTop += key === 38 || key === 33 ? -amount : amount; return;
          }
        }
        if (!card) { focus(0); return; }
        var columns = previewAsset ? 2 : Math.max(1, Math.floor(el('aerial-settings-grid').clientWidth / 324));
        if (previewAsset && (key === 9 || (key === 39 && focused % 2 === 1))) { el('aerial-preview-close').focus(); return; }
        if (key === 9) { if (!event.shiftKey && focused === cards.length - 1) { el('settings-close').focus(); } else { focus(focused + (event.shiftKey ? -1 : 1)); } }
        else if (key === 37 || key === 39) { focus(focused + (key === 37 ? -1 : 1)); }
        else if (key === 34 || key === 33) { focus(focused + columns * (key === 33 ? -2 : 2)); }
        else if (key === 40 && focused + columns >= cards.length) { el('settings-close').focus(); }
        else { focus(focused + (key === 38 ? -columns : columns)); }
      }, true);
    }
  };
}());
