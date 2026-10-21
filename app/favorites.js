(function () {
  'use strict';
  var input = window.HomeStorage.get('home.favorites.v1', {}) || {};
  var saved = { apps: Object.create(null), channels: Object.create(null), catalog: Object.create(null) };
  ['apps', 'channels'].forEach(function (type) {
    var values = input[type];
    if (values && typeof values === 'object' && !Array.isArray(values)) {
      Object.keys(values).forEach(function (id) { if (typeof values[id] === 'boolean') { saved[type][id] = values[id]; } });
    }
  });
  if (input.catalog && typeof input.catalog === 'object') {
    Object.keys(input.catalog).forEach(function (id) {
      var item = input.catalog[id];
      if (item && typeof item.title === 'string') { saved.catalog[id] = { title: item.title, icon: typeof item.icon === 'string' ? item.icon : '' }; }
    });
  }
  function key(button, type) {
    if (type === 'channels') { return button.getAttribute('data-order-key') || button._channelUrl; }
    var index = button.getAttribute('data-app');
    return index !== null ? window.HOME_CONFIG.apps[Number(index)].id : button.getAttribute('data-launch-id');
  }
  window.HomeFavorites = {
    catalog: function () { return saved.catalog; },
    has: function (button, type) {
      var id = key(button, type);
      if (Object.prototype.hasOwnProperty.call(saved[type], id)) { return saved[type][id]; }
      return type === 'apps' ? button.hasAttribute('data-app') : button.getAttribute('data-default-favorite') === 'true';
    },
    apply: function (type) {
      var buttons = document.getElementById(type).querySelectorAll('button');
      for (var i = 0; i < buttons.length; i++) { buttons[i].hidden = !this.has(buttons[i], type); }
    },
    toggle: function (button, type) {
      var id = key(button, type);
      var previous = saved[type][id];
      var previousCatalog = saved.catalog[id];
      saved[type][id] = !this.has(button, type);
      if (type === 'apps' && !button.hasAttribute('data-app')) {
        var image = button.querySelector('img');
        saved.catalog[key(button, type)] = { title: button.querySelector('.tile-caption').textContent, icon: image ? image.getAttribute('src') : '' };
      }
      if (!window.HomeStorage.set('home.favorites.v1', saved)) {
        if (previous === undefined) { delete saved[type][id]; } else { saved[type][id] = previous; }
        if (previousCatalog === undefined) { delete saved.catalog[id]; } else { saved.catalog[id] = previousCatalog; }
        return null;
      }
      this.apply(type);
      return saved[type][key(button, type)];
    }
  };
}());
