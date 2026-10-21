/* Validated Apple metadata. Video stays on the CDN and is never written to storage. */
(function (root) {
  'use strict';
  var labels = {
    'San Francisco': 'Сан-Франциско', 'New York': 'Нью-Йорк', 'Los Angeles': 'Лос-Анджелес',
    'Hong Kong': 'Гонконг', 'Dubai': 'Дубай', 'Greenland': 'Гренландия', 'Liwa': 'Пустыня Лива',
    'China': 'Китай', 'Antarctica': 'Антарктида', 'Hawaii': 'Гавайи', 'London': 'Лондон',
    'Africa': 'Африка', 'Africa Night': 'Африка ночью'
  };
  function appleURL(url) {
    return typeof url === 'string' && /^https:\/\/(?:sylvan\.apple\.com|a1\.phobos\.apple\.com)\/[A-Za-z0-9_./%+~-]+\.(?:mov|mp4)$/i.test(url) ? url : '';
  }
  var places = {
    'San Francisco': 'Калифорния, США', 'New York': 'США', 'Los Angeles': 'Калифорния, США',
    'Hong Kong': 'Китай', 'Dubai': 'Объединённые Арабские Эмираты', 'Liwa': 'Объединённые Арабские Эмираты',
    'Greenland': 'Гренландия', 'China': 'Китай', 'Antarctica': 'Антарктида', 'Hawaii': 'США', 'London': 'Великобритания'
  };
  function normalize(raw) {
    var assets = raw && raw.assets;
    if (!Array.isArray(assets)) { return []; }
    var seen = Object.create(null);
    var result = [];
    assets.slice(0, 200).forEach(function (asset) {
      if (!asset || typeof asset.id !== 'string' || !asset.id || seen[asset.id]) { return; }
      var sources = {
        hevc4k: appleURL(asset['url-4K-SDR']),
        hevc1080: appleURL(asset['url-1080-SDR']),
        h264: appleURL(asset['url-1080-H264'])
      };
      if (!sources.hevc4k && !sources.hevc1080 && !sources.h264) { return; }
      seen[asset.id] = true;
      var label = typeof asset.accessibilityLabel === 'string' ? asset.accessibilityLabel.slice(0, 120) : 'Apple Aerial';
      var location = typeof asset.location === 'string' ? asset.location.slice(0, 160) : places[label] || '';
      if (location === (labels[label] || label)) { location = ''; }
      var preview = asset.previewImage || asset['previewImage-900x580'] || '';
      if (typeof preview !== 'string' || !/^https:\/\/(?:sylvan\.apple\.com|a1\.phobos\.apple\.com)\/[A-Za-z0-9_./%+~-]+\.(?:png|jpe?g)$/i.test(preview)) { preview = ''; }
      if (typeof asset.previewLocal === 'string' && /^aerial-thumbs\/[A-Za-z0-9_-]+\.jpg$/.test(asset.previewLocal)) { preview = asset.previewLocal; }
      var metadata = {};
      try {
        var encoded = JSON.stringify(asset.metadata || asset);
        if (encoded.length <= 16384) { metadata = JSON.parse(encoded); delete metadata.previewLocal; }
      } catch (invalid) { /* Playback remains available even without detailed metadata. */ }
      result.push({ id: asset.id, label: labels[label] || label, location: location, preview: preview, metadata: metadata, sources: sources });
    });
    return result;
  }
  function variants(asset, hevc) {
    var values = hevc ? [asset.sources.hevc4k, asset.sources.hevc1080, asset.sources.h264] : [asset.sources.h264];
    return values.filter(function (url, index) { return url && values.indexOf(url) === index; });
  }
  function create(options) {
    var bundled = normalize(options.bundled);
    var cached = options.storage.get('home.aerial.catalog.v1', null);
    var remote = normalize(cached && cached.manifest);
    var pending = null;
    var lastRequest = 0;
    function all() {
      var result = bundled.slice();
      var known = Object.create(null);
      result.forEach(function (asset) { known[asset.id] = true; });
      remote.forEach(function (asset) { if (!known[asset.id]) { result.push(asset); } });
      return result;
    }
    return {
      assets: all,
      refresh: function (now, online) {
        var updated = cached && typeof cached.updated === 'number' ? cached.updated : 0;
        if (!online || pending || now - updated < 7 * 86400000 || (lastRequest && now - lastRequest < 3600000)) { return; }
        lastRequest = now;
        var xhr = new options.XMLHttpRequest(); pending = xhr;
        xhr.open('GET', 'https://sylvan.apple.com/Aerials/2x/entries.json', true); xhr.timeout = 8000;
        xhr.onload = function () {
          if (pending !== xhr) { return; } pending = null;
          if (xhr.status < 200 || xhr.status >= 300 || xhr.responseText.length > 1024 * 1024) { return; }
          try {
            var manifest = JSON.parse(xhr.responseText);
            var valid = normalize(manifest);
            if (!valid.length) { return; }
            // Cache validated, bounded fields only, never a downloaded video or arbitrary JSON.
            var assets = valid.map(function (asset) { return { id: asset.id, accessibilityLabel: asset.label, location: asset.location, metadata: asset.metadata, previewImage: asset.preview, 'url-4K-SDR': asset.sources.hevc4k, 'url-1080-SDR': asset.sources.hevc1080, 'url-1080-H264': asset.sources.h264 }; });
            cached = { updated: now, manifest: { assets: assets } }; remote = normalize(cached.manifest);
            options.storage.set('home.aerial.catalog.v1', cached);
          } catch (error) { /* The packaged snapshot remains usable without CORS or valid JSON. */ }
        };
        xhr.onerror = xhr.ontimeout = function () { if (pending === xhr) { pending = null; } };
        xhr.send();
      },
      cancel: function () { if (pending) { var xhr = pending; pending = null; xhr.abort(); } }
    };
  }
  var api = { normalize: normalize, variants: variants, create: create };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.HomeAerialCatalog = api; }
}(this));
