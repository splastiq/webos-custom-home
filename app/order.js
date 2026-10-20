/* Stable ordering, long-press drag, and OK + arrows for a TV remote. */
(function (root) {
  'use strict';
  function ordered(keys, saved) {
    var result = [];
    (Array.isArray(saved) ? saved : []).concat(keys).forEach(function (key) {
      if (keys.indexOf(key) !== -1 && result.indexOf(key) === -1) { result.push(key); }
    });
    return result;
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = ordered; return; }
  var held = null;
  var timer;
  var origin;
  var moved = false;
  var swallow = false;
  var keyHeld = false;
  var notify = function () {};
  var changed = function () {};
  var allowed = function () { return true; };
  function items(row) { return Array.prototype.slice.call(row.querySelectorAll('[data-order-key]')); }
  function save(row) {
    try { localStorage.setItem('home.order.' + row.id, JSON.stringify(items(row).map(function (item) { return item.getAttribute('data-order-key'); }))); } catch (e) { /* Optional persistence. */ }
  }
  function apply(row) {
    if (!row) { return; }
    var list = items(row);
    var saved;
    try { saved = JSON.parse(localStorage.getItem('home.order.' + row.id)); } catch (e) { saved = []; }
    ordered(list.map(function (item) { return item.getAttribute('data-order-key'); }), saved).forEach(function (key) {
      list.forEach(function (item) { if (item.getAttribute('data-order-key') === key) { row.appendChild(item); } });
    });
  }
  function itemAt(node) {
    while (node && node !== document) {
      if (node.getAttribute && node.hasAttribute('data-order-key')) { return node; }
      node = node.parentNode;
    }
    return null;
  }
  function begin(item) {
    if (!item || !allowed()) { return; }
    held = item; moved = false;
    origin = items(item.parentNode);
    item.classList.add('reordering');
    item.setAttribute('aria-grabbed', 'true');
    swallow = true;
    notify('Переместите плитку или используйте ← →. OK — сохранить, Back — отменить');
  }
  function finish(cancel) {
    clearTimeout(timer);
    if (!held) { return; }
    var item = held;
    var row = item.parentNode;
    if (cancel) { origin.forEach(function (node) { row.appendChild(node); }); }
    else { save(row); }
    item.classList.remove('reordering'); item.setAttribute('aria-grabbed', 'false'); held = null;
    changed();
    if (!item.disabled) { item.focus(); }
    notify(cancel ? 'Порядок восстановлен' : 'Порядок сохранён');
  }
  function shift(item, direction) {
    var row = item.parentNode;
    var list = items(row);
    var index = list.indexOf(item);
    var target = list[index + direction];
    if (!target) { return; }
    row.insertBefore(item, direction < 0 ? target : target.nextSibling);
    moved = true; changed();
    if (!item.disabled) { item.focus(); }
  }
  root.HomeOrder = { apply: apply, busy: function () { return !!held; }, init: function (onChanged, onNotify, isAllowed) {
    changed = onChanged; notify = onNotify; allowed = isAllowed;
    document.addEventListener('mousedown', function (event) {
      if (event.button !== 0 || !allowed()) { return; }
      swallow = false;
      var item = itemAt(event.target);
      if (!item) { return; }
      clearTimeout(timer);
      timer = setTimeout(function () { begin(item); }, 550);
    }, true);
    document.addEventListener('mousemove', function (event) {
      if (!held) { return; }
      var row = held.parentNode;
      var viewport = row.parentNode;
      var bounds = viewport.getBoundingClientRect();
      if (event.clientX > bounds.right - 55) { viewport.scrollLeft += 35; }
      if (event.clientX < bounds.left + 55) { viewport.scrollLeft -= 35; }
      var target = itemAt(document.elementFromPoint(event.clientX, event.clientY));
      if (target && target !== held && target.parentNode === row) {
        var list = items(row);
        row.insertBefore(held, list.indexOf(held) < list.indexOf(target) ? target.nextSibling : target);
        moved = true; changed();
      }
    }, true);
    document.addEventListener('mouseup', function () { clearTimeout(timer); if (held && moved) { finish(false); } }, true);
    document.addEventListener('click', function (event) {
      if (swallow || held) { event.preventDefault(); event.stopImmediatePropagation(); swallow = false; }
    }, true);
    document.addEventListener('dragstart', function (event) { if (itemAt(event.target)) { event.preventDefault(); } }, true);
    document.addEventListener('keydown', function (event) {
      if (!allowed()) { return; }
      var key = event.keyCode;
      if (held) {
        if (key === 38 || key === 40) { event.preventDefault(); event.stopImmediatePropagation(); }
        if (key === 37 || key === 39) { event.preventDefault(); event.stopImmediatePropagation(); shift(held, key === 37 ? -1 : 1); }
        if (key === 27 || key === 461 || key === 13) {
          event.preventDefault(); event.stopImmediatePropagation();
          if (!keyHeld) { finish(key !== 13); keyHeld = key === 13; }
        }
        return;
      }
      var item = itemAt(document.activeElement);
      if (key === 13 && item) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (keyHeld) { return; }
        keyHeld = true; swallow = false;
        timer = setTimeout(function () { begin(item); }, 550);
      }
    }, true);
    document.addEventListener('keyup', function (event) {
      if (event.keyCode !== 13 || !keyHeld) { return; }
      clearTimeout(timer); keyHeld = false;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!held && !swallow && allowed()) {
        var item = itemAt(document.activeElement);
        if (item && !item.disabled) { item.click(); }
      }
      if (!held) { swallow = false; }
    }, true);
    window.addEventListener('blur', function () { clearTimeout(timer); keyHeld = false; if (held) { finish(true); } });
  } };
}(this));
