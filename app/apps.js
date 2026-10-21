/* Application catalog owns TV enumeration; the library only presents its result. */
(function () {
  'use strict';
  var row;
  function appId(button) { return button.getAttribute('data-launch-id'); }
  function iconPath(app) {
    if (typeof app.localIcon === 'string' && /^runtime-icons\/[A-Za-z0-9_.-]+$/.test(app.localIcon)) { return app.localIcon; }
    var icon = app.largeIcon || app.icon || '';
    if (!icon || icon.indexOf('$') !== -1) { return ''; }
    if (/^(?:https?:\/\/|file:\/\/)/i.test(icon)) { return icon; }
    if (icon.charAt(0) === '/') { return 'file://' + icon; }
    return app.folderPath ? 'file://' + app.folderPath.replace(/\/$/, '') + '/' + icon.replace(/^\.\//, '') : '';
  }
  window.HomeApps = {
    init: function (container) {
      row = container;
      var fragment = document.createDocumentFragment();
      var configured = Object.create(null);
      var overrides = window.HomeStorage.get('home.apps.v2', {}) || {};
      var legacy = window.HomeStorage.get('home.apps.v1', []);
      window.HOME_CONFIG.apps.forEach(function (app, index) {
        var saved = overrides[app.key];
        if (saved === undefined && legacy && index < 3) { saved = legacy[index]; }
        if (typeof saved === 'string' && saved) { app.id = saved; }
        configured[app.id] = true;
        fragment.appendChild(window.HomeTiles.app({ id: app.id, key: app.key, title: app.name, icon: app.icon, configIndex: index }));
      });
      var catalog = window.HomeFavorites.catalog();
      Object.keys(catalog).forEach(function (id) {
        if (!configured[id]) { fragment.appendChild(window.HomeTiles.app({ id: id, key: id, title: catalog[id].title, icon: catalog[id].icon })); }
      });
      row.appendChild(fragment); window.HomeOrder.apply(row);
    },
    refresh: function (done) {
      window.TV.listApps(function (error, apps) {
        if (error) { done(error); return; }
        var existing = Object.create(null);
        var installed = Object.create(null);
        var buttons = row.querySelectorAll('button');
        var fragment = document.createDocumentFragment();
        for (var i = 0; i < buttons.length; i++) { existing[appId(buttons[i])] = buttons[i]; }
        apps.forEach(function (app) {
          if (!app || typeof app.id !== 'string' || installed[app.id]) { return; }
          installed[app.id] = true;
          if (!existing[app.id]) { fragment.appendChild(window.HomeTiles.app({ id: app.id, key: app.id, title: app.title || app.id, icon: iconPath(app), color: app.iconColor })); }
          else if (existing[app.id].getAttribute('data-app') === null) {
            var previous = existing[app.id];
            row.replaceChild(window.HomeTiles.app({ id: app.id, key: previous.getAttribute('data-order-key') || app.id, title: app.title || app.id, icon: iconPath(app), color: app.iconColor }), previous);
          }
        });
        for (var j = 0; j < buttons.length; j++) { if (!installed[appId(buttons[j])]) { row.removeChild(buttons[j]); } }
        row.appendChild(fragment); window.HomeOrder.apply(row); done(null);
      });
    }
  };
}());
