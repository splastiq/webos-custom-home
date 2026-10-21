/* Playlist documents are cached locally, including URL downloads, for offline use. */
(function () {
  'use strict';
  var selected = 'favorites';
  var changed = function () {};
  var pending = null;
  var sequence = 0;
  var data;
  function store() {
    if (!data) { data = window.HomePlaylistStore(window.IPTV.parse, window.HomeStorage); }
    return data;
  }
  function el(id) { return document.getElementById(id); }
  function documents() { return store().documents(); }
  function tabs() {
    el('playlist-tabs').textContent = '';
    [{ id: 'favorites', name: 'Избранное' }].concat(documents()).forEach(function (item) {
      var button = document.createElement('button'); button.type = 'button';
      button.className = 'playlist-tab'; button.textContent = item.name;
      button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', item.id === selected ? 'true' : 'false');
      button.setAttribute('data-playlist', item.id);
      button.addEventListener('click', function () { selected = item.id; tabs(); changed();
        var active = el('playlist-tabs').querySelector('[aria-selected="true"]'); if (active) { active.focus(); }
      });
      el('playlist-tabs').appendChild(button);
    });
    el('playlist-delete').hidden = selected === 'favorites';
  }
  function message(text) { el('playlist-message').textContent = text; }
  function closeForm() {
    sequence++; if (pending) { pending.abort(); pending = null; }
    el('playlist-submit').disabled = false;
    el('playlist-form').hidden = true; el('playlist-add').focus();
  }
  function accept(text, url) {
    var name = el('playlist-name').value.replace(/^\s+|\s+$/g, '') || 'Плейлист ' + documents().length;
    var result = store().add(name, text, url);
    if (result.error === 'empty') { message('В плейлисте не найдено каналов HTTP/HTTPS в формате M3U.'); return; }
    if (result.error) { message('Не удалось сохранить плейлист: недостаточно места.'); return; }
    selected = result.id; closeForm(); tabs(); window.IPTV.rebuild(); changed();
  }

  window.HomePlaylists = {
    setDefault: function (text) { store().setDefault(text); },
    channels: function () { return store().channels(); },
    defaultText: function () { return store().defaultText(); },
    title: function () {
      if (selected === 'favorites') { return 'Избранное'; }
      var item = documents().filter(function (doc) { return doc.id === selected; })[0];
      return item ? item.name : '';
    },
    isDefault: function (url) { return store().isDefaultFavorite(url); },
    selectedId: function () { return selected; },
    matches: function (button, scope) {
      var id = scope === undefined ? selected : scope;
      if (id === 'favorites') { return window.HomeFavorites.has(button, 'channels'); }
      return store().contains(id, button.getAttribute('data-order-key') || button._channelUrl);
    },
    open: function (onChanged) { changed = onChanged; tabs(); },
    close: function () { sequence++; if (pending) { pending.abort(); pending = null; } el('playlist-submit').disabled = false; el('playlist-form').hidden = true; el('playlist-delete-form').hidden = true; },
    init: function () {
      el('playlist-add').addEventListener('click', function () {
        el('playlist-delete-form').hidden = true;
        el('playlist-form').hidden = false;
        el('playlist-name').value = ''; el('playlist-input').value = ''; message(''); el('playlist-name').focus();
      });
      el('playlist-cancel').addEventListener('click', closeForm);
      el('playlist-form').addEventListener('submit', function (event) {
        event.preventDefault(); if (pending) { return; }
        var input = el('playlist-input').value.replace(/^\s+|\s+$/g, '');
        if (!input) { message('Вставьте ссылку или содержимое M3U.'); return; }
        if (/^https?:\/\/\S+$/i.test(input)) {
          var token = ++sequence;
          var xhr = new XMLHttpRequest(); pending = xhr; el('playlist-submit').disabled = true; message('Загрузка плейлиста…');
          xhr.open('GET', input, true); xhr.timeout = 15000;
          var finish = function (text) {
            if (token !== sequence) { return; } pending = null; el('playlist-submit').disabled = false;
            if (text) { accept(text, input); } else { message('Не удалось загрузить ссылку. Проверьте адрес и доступность. Можно вставить содержимое M3U напрямую.'); }
          };
          xhr.onload = function () { finish(xhr.status >= 200 && xhr.status < 300 ? xhr.responseText : null); };
          xhr.onerror = xhr.ontimeout = function () { finish(null); }; xhr.send();
        } else { accept(input, ''); }
      });
      el('playlist-delete').addEventListener('click', function () {
        el('playlist-form').hidden = true; el('playlist-delete-form').hidden = false;
        var doc = documents().filter(function (item) { return item.id === selected; })[0];
        el('playlist-delete-label').textContent = 'Удалить плейлист «' + (doc ? doc.name : '') + '»?';
        el('playlist-delete-cancel').focus();
      });
      el('playlist-delete-cancel').addEventListener('click', function () { el('playlist-delete-form').hidden = true; el('playlist-delete').focus(); });
      el('playlist-delete-confirm').addEventListener('click', function () {
        if (!store().remove(selected)) { el('playlist-delete-label').textContent = 'Не удалось сохранить изменения. Повторите удаление.'; return; }
        selected = 'favorites'; el('playlist-delete-form').hidden = true; tabs(); window.IPTV.rebuild(); changed();
        el('playlist-tabs').querySelector('button').focus();
      });
    }
  };
}());
