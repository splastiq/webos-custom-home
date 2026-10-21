/* Persist explicit Aerial IDs; an empty selection never falls back to all videos. */
(function (root) {
  'use strict';
  function create(storage) {
    var saved = storage.get('home.aerial.favorites.v1', []);
    var ids = Array.isArray(saved) ? saved.filter(function (id, index) { return typeof id === 'string' && saved.indexOf(id) === index; }) : [];
    return {
      has: function (id) { return ids.indexOf(id) !== -1; },
      filter: function (assets) { return assets.filter(function (asset) { return ids.indexOf(asset.id) !== -1; }); },
      toggle: function (id) {
        if (typeof id !== 'string' || !id) { return null; }
        var next = ids.slice(); var index = next.indexOf(id);
        if (index === -1) { next.push(id); } else { next.splice(index, 1); }
        if (!storage.set('home.aerial.favorites.v1', next)) { return null; }
        ids = next; return index === -1;
      }
    };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = create; }
  else { root.HomeAerialSelection = create(root.HomeStorage); }
}(this));
