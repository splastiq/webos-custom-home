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
    function documents() { return (hideDefault ? [] : [{ id: 'bel', name: 'Беларусь · iptv-org', text: defaultText }]).concat(custom.filter(function(item){return !item.hidden;})); }
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
      syncFolder: function (report) {
        if (!report || !Array.isArray(report.files) || !Array.isArray(report.errors)) { return {error:'invalid'}; }
        var present = Object.create(null), existing = Object.create(null), incoming = Object.create(null), skipped = 0;
        custom.forEach(function(doc){ if (doc.source === 'tv-folder') { existing[doc.id] = doc; } });
        report.errors.forEach(function(item){ if (item && typeof item.fileName === 'string') { present[item.fileName] = true; } });
        for (var i = 0; i < report.files.length; i++) {
          var file = report.files[i];
          if (!file || !/^folder-[a-f0-9]{40}$/.test(file.id) || typeof file.fileName !== 'string' || !/^[^\/\\\x00]+\.m3u8?$/i.test(file.fileName) || typeof file.text !== 'string' || typeof file.name !== 'string' || !/^[a-f0-9]{64}$/.test(file.fingerprint) || incoming[file.id]) { return {error:'invalid'}; }
          present[file.fileName] = true;
          var previous = existing[file.id];
          if (previous && previous.fingerprint === file.fingerprint) { incoming[file.id] = previous; continue; }
          if (!parse(file.text).length) { skipped++; if (previous) { incoming[file.id] = previous; } continue; }
          incoming[file.id] = {id:file.id, name:file.name.slice(0,80), text:file.text, source:'tv-folder', fileName:file.fileName, fingerprint:file.fingerprint};
        }
        var next = custom.filter(function(doc){return doc.source !== 'tv-folder' || !incoming[doc.id] && (report.complete !== true || present[doc.fileName]);});
        report.files.forEach(function(file){if(incoming[file.id]) { next.push(incoming[file.id]); }});
        // Preserve document order and avoid writes/rebuilds when content is unchanged.
        var ordered = [], used = Object.create(null), byId = Object.create(null);
        next.forEach(function(item){byId[item.id] = item;});
        custom.forEach(function(doc){if(byId[doc.id] && !used[doc.id]) {ordered.push(byId[doc.id]);used[doc.id]=true;}});
        next.forEach(function(item){if(!used[item.id]) {ordered.push(item);used[item.id]=true;}});
        if (ordered.length === custom.length && ordered.every(function(item,index){return item === custom[index];})) { return {changed:false, skipped:skipped}; }
        if (!storage.set(key,ordered)) { return {error:'storage'}; }
        custom = ordered; cache = null; return {changed:true, skipped:skipped};
      },
      remove: function (id) {
        if (id === 'bel') {
          if (!storage.set('home.playlists.hideDefault.v1', true)) { return false; } hideDefault = true;
        } else {
          if (!custom.some(function (doc) { return doc.id === id; })) { return false; }
          var next = custom.filter(function (doc) { return doc.id !== id || doc.source === 'tv-folder'; }).map(function(doc){
            if (doc.id !== id) { return doc; }
            return {id:doc.id, name:doc.name, text:'', source:'tv-folder', fileName:doc.fileName, fingerprint:doc.fingerprint, hidden:true};
          });
          if (!storage.set(key, next)) { return false; } custom = next;
        }
        cache = null; return true;
      }
    };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = create; }
  else { root.HomePlaylistStore = create; }
}(this));
