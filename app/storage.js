/* One persistence boundary. Existing keys remain compatible with older installs. */
(function (root) {
  'use strict';
  function create(backend) {
    return {
      get: function (key, fallback) {
        try { var value = backend.getItem(key); return value === null ? fallback : JSON.parse(value); }
        catch (error) { return fallback; }
      },
      set: function (key, value) {
        try { backend.setItem(key, JSON.stringify(value)); return true; }
        catch (error) { return false; }
      }
    };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = create; }
  else {
    var backend;
    try { backend = root.localStorage; } catch (error) {}
    root.HomeStorage = create(backend);
  }
}(this));
