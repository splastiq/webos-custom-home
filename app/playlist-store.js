/* Data and persistence only: parse once per document change, index URLs once. */
(function (root) {
  'use strict';
  function create(parse, storage) {
    var key = 'home.playlists.v1';
    var defaultText = '';
    var custom = storage.get(key, []);
    var hideDefault = storage.get('home.playlists.hideDefault.v1', false) === true;
    var cache = null;
    if (!Array.isArray(custom)) { custom = []; }
    var ids = Object.create(null);
    custom = custom.filter(function (item) {
      if (!item || typeof item.id !== 'string' || ids[item.id] || item.id === 'bel' || item.id === 'favorites' || typeof item.name !== 'string' || typeof item.text !== 'string') { return false; }
      ids[item.id] = true; return true;
    });
    function documents() { return (hideDefault ? [] : [{ id: 'bel', name: 'Беларусь · iptv-org', text: defaultText }]).concat(custom); }
    function index() {
      if (cache) { return cache; }
      cache = { channels: [], membership: Object.create(null), defaults: Object.create(null) };
      var seen = Object.create(null);
      documents().forEach(function (doc) {
        var urls = Object.create(null);
        parse(doc.text).forEach(function (channel) {
          urls[channel.url] = true;
          if (doc.id === 'bel') { cache.defaults[channel.url] = channel.height >= 720; }
          if (!seen[channel.url]) { seen[channel.url] = true; cache.channels.push(channel); }
        });
        cache.membership[doc.id] = urls;
      });
      return cache;
    }
    return {
      documents: documents,
      setDefault: function (text) { if (defaultText !== text) { defaultText = text; cache = null; } },
      defaultText: function () { return defaultText; },
      channels: function () { return index().channels; },
      contains: function (id, url) { var urls = index().membership[id]; return !!(urls && urls[url]); },
      isDefaultFavorite: function (url) { return index().defaults[url] === true; },
      add: function (name, text, url) {
        if (!parse(text).length) { return { error: 'empty' }; }
        var id = 'list-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
        var next = custom.concat([{ id: id, name: name, text: text, url: url || '' }]);
        if (!storage.set(key, next)) { return { error: 'storage' }; }
        custom = next; cache = null; return { id: id };
      },
      remove: function (id) {
        if (id === 'bel') {
          if (!storage.set('home.playlists.hideDefault.v1', true)) { return false; } hideDefault = true;
        } else {
          if (!custom.some(function (doc) { return doc.id === id; })) { return false; }
          var next = custom.filter(function (doc) { return doc.id !== id; });
          if (!storage.set(key, next)) { return false; } custom = next;
        }
        cache = null; return true;
      }
    };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = create; }
  else { root.HomePlaylistStore = create; }
}(this));
