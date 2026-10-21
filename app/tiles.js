/* Shared artwork creation. Text always enters the DOM through textContent. */
(function () {
  'use strict';
  var backgrounds = Object.create(null);
  function matchBackground(image, art) {
    var source = image.getAttribute('src');
    if (backgrounds[source]) { art.style.background = backgrounds[source]; return; }
    try {
      // Sample only 16x16 border pixels once per image, never on focus or animation.
      var canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
      var context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 16, 16);
      var pixels = context.getImageData(0, 0, 16, 16).data;
      var buckets = Object.create(null); var best = null;
      for (var y = 1; y < 15; y++) {
        for (var x = 1; x < 15; x++) {
          if (x > 2 && x < 13 && y > 2 && y < 13) { continue; }
          var offset = (y * 16 + x) * 4;
          if (pixels[offset + 3] < 230) { continue; }
          var key = (pixels[offset] >> 4) + ',' + (pixels[offset + 1] >> 4) + ',' + (pixels[offset + 2] >> 4);
          var bucket = buckets[key] || (buckets[key] = { count: 0, r: 0, g: 0, b: 0 });
          bucket.count++; bucket.r += pixels[offset]; bucket.g += pixels[offset + 1]; bucket.b += pixels[offset + 2];
          if (!best || bucket.count > best.count) { best = bucket; }
        }
      }
      if (best) {
        backgrounds[source] = 'rgb(' + Math.round(best.r / best.count) + ',' + Math.round(best.g / best.count) + ',' + Math.round(best.b / best.count) + ')';
        art.style.background = backgrounds[source];
      }
    } catch (unavailable) { /* Keep the configured background if canvas access is unavailable. */ }
  }
  function appTile(app) {
    var button = document.createElement('button'); button.className = 'tile app-tile';
    button.setAttribute('data-item', 'app-' + app.key);
    button.setAttribute('data-launch-id', app.id);
    button.setAttribute('data-order-key', app.key);
    button.setAttribute('aria-label', 'Открыть ' + app.title);
    if (app.configIndex !== undefined) { button.setAttribute('data-app', app.configIndex); button.setAttribute('data-app-key', app.key); }
    var art = document.createElement('span'); art.className = 'tile-art';
    if (typeof app.color === 'string' && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(app.color)) { art.style.background = app.color; }
    var fallback = document.createElement('span'); fallback.className = 'app-initial'; fallback.hidden = true; art.appendChild(fallback);
    if (app.icon) {
      var image = document.createElement('img'); image.alt = ''; image.draggable = false;
      image.onload = function () { matchBackground(image, art); };
      image.onerror = function () { image.hidden = true; };
      image.src = app.icon; art.appendChild(image);
    }
    var caption = document.createElement('span'); caption.className = 'tile-caption'; caption.textContent = app.title;
    button.appendChild(art); button.appendChild(caption); return button;
  }
  window.HomeTiles = { app: appTile };
  // cloneNode does not copy onload callbacks. The library clones shelf tiles,
  // so capture image loads there too and use the same per-source color cache.
  document.addEventListener('load', function (event) {
    var image = event.target;
    var art = image && image.parentNode;
    if (image && image.tagName === 'IMG' && art && art.classList.contains('tile-art')) { matchBackground(image, art); }
  }, true);
}());
