/* Conservative filename matching for the independent tv-logo collection. */
(function (root) {
  'use strict';
  function normalize(value) {
    var ru='абвгдеёжзийклмнопрстуфхцчшщъыьэюя', en=['a','b','v','g','d','e','e','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','h','ts','ch','sh','sch','','y','','e','yu','ya'];
    return String(value || '').toLowerCase().replace(/\b(?:uhd|fhd|hd|sd|4k|720p|1080p)\b/g,'').replace(/[а-яё]/g,function(c){return en[ru.indexOf(c)];}).replace(/&/g,'and').replace(/[^a-z0-9+]/g,'');
  }
  function match(paths, id, name) {
    var country = /\.([a-z]{2})(?:@.*)?$/i.exec(id || '');
    var target = normalize(name), byId = normalize(String(id || '').replace(/\.[a-z]{2}(?:@.*)?$/i,''));
    var found = paths.filter(function(p){
      if (!/^countries\/[a-z0-9/-]+\.png$/.test(p) || /(?:mosaic|preview|space)/.test(p)) { return false; }
      var file=p.split('/').pop(), parts=/^(.*)-([a-z]{2})\.png$/.exec(file);
      if (!parts) { return false; }
      var key=normalize(parts[1]); return key && (key === target || byId && key === byId);
    });
    if (country) {
      var local = found.filter(function(p){return p.slice(-7,-4) === '-' + country[1].toLowerCase();});
      if (local.length) { return local.length === 1 ? local[0] : null; }
    }
    return found.length === 1 ? found[0] : null;
  }
  var api={normalize:normalize,match:match};
  if (typeof module === 'object' && module.exports) { module.exports=api; } else { root.HomeLogoMatch=api; }
}(this));
