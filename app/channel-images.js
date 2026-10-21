/* Bounded, viewport-only image loading; works without IntersectionObserver on webOS 3.5. */
(function () {
  'use strict';
  var active = 0, timer = null, resolving = false, replacements = Object.create(null);
  function fallback(image) {
    if (resolving || !window.TV || !window.TV.available || !window.TV.resolveChannelLogo || !window.HomeFavorites) { return; }
    var button = image.parentNode && image.parentNode.parentNode;
    if (!button || !window.HomeFavorites.has(button, 'channels')) { return; }
    var id = image.getAttribute('data-logo-id') || '', name = image.getAttribute('data-logo-name') || '';
    var key = id + '|' + name;
    if (Object.prototype.hasOwnProperty.call(replacements,key)) {
      if (replacements[key]) { image.setAttribute('data-logo-src',replacements[key]); image._logoAttempts=0; image._logoRetry=0; }
      image._logoResolved = true; return;
    }
    resolving = true;
    window.TV.resolveChannelLogo(id,name,function(file){
      resolving = false; replacements[key] = file; schedule();
    });
  }
  function schedule() {
    if (timer !== null) { return; }
    timer = setTimeout(function () { timer = null; scan(); }, 100);
  }
  function visible(image) {
    var rect = image.getBoundingClientRect();
    return image.getClientRects().length && rect.width > 0 && rect.height > 0 &&
      rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
  }
  function load(image) {
    active++; image._logoLoading = true; image._logoAttempts = (image._logoAttempts || 0) + 1;
    var finished = false;
    var timeout = setTimeout(function () { finish(false); }, 15000);
    function finish(ok) {
      if (finished) { return; } finished = true; clearTimeout(timeout);
      image.onload = image.onerror = null; image._logoLoading = false; active--;
      if (ok) {
        image.setAttribute('data-logo-loaded', 'true');
        image.style.visibility = '';
        if (image.parentNode) { image.parentNode.classList.add('has-logo'); }
      } else {
        image.removeAttribute('src'); image.style.visibility = 'hidden';
        if (image._logoAttempts < 3) { image._logoRetry = Date.now() + image._logoAttempts * 2000; setTimeout(schedule, image._logoAttempts * 2000); }
      }
      schedule();
    }
    image.onload = function () { finish(true); };
    image.onerror = function () { finish(false); };
    image.style.visibility = 'hidden';
    image.src = image.getAttribute('data-logo-src');
  }
  function scan() {
    if (document.hidden) { return; }
    var images = document.querySelectorAll('img[data-logo-src]');
    for (var i = 0; i < images.length && active < 4; i++) {
      var image = images[i];
      if (image.getAttribute('data-logo-loaded') !== 'true' && !image._logoResolved &&
          ((image._logoAttempts || 0) >= 3 || !image.getAttribute('data-logo-src')) && visible(image)) { fallback(image); }
      if (image.getAttribute('data-logo-src') && !image._logoLoading && image.getAttribute('data-logo-loaded') !== 'true' &&
          (image._logoAttempts || 0) < 3 && (!image._logoRetry || image._logoRetry <= Date.now()) && visible(image)) { load(image); }
    }
  }
  document.addEventListener('scroll', schedule, true);
  document.addEventListener('focusin', schedule);
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('resize', schedule);
  if (typeof MutationObserver === 'function') {
    new MutationObserver(schedule).observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['hidden','class','style']});
  }
  window.HomeChannelImages = {refresh:schedule};
  schedule();
}());
