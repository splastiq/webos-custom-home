/* Pure M3U parser shared by catalog storage and tests. */
(function (root) {
  'use strict';
  function parse(text) {
    var lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    var result = [];
    var pending = null;
    var seen = {};
    lines.forEach(function (line) {
      line = line.replace(/^\s+|\s+$/g, '');
      if (line.indexOf('#EXTINF:') === 0) {
        var comma = -1;
        var quoted = false;
        for (var j = 0; j < line.length; j++) {
          if (line.charAt(j) === '"') { quoted = !quoted; }
          if (line.charAt(j) === ',' && !quoted) { comma = j; break; }
        }
        var group = /group-title="([^"]*)"/.exec(line);
        var logo = /tvg-logo="([^"]*)"/.exec(line);
        var id = /tvg-id="([^"]*)"/.exec(line);
        pending = comma >= 0 ? { name: line.slice(comma + 1), group: group ? group[1] : '', id: id ? id[1] : '', logo: logo && /^https?:\/\//i.test(logo[1]) ? logo[1] : '' } : null;
        if (pending) {
          var resolution = /\((\d{3,4})p\)/i.exec(pending.name);
          pending.height = resolution ? Number(resolution[1]) : 0;
        }
      } else if (line && line.charAt(0) !== '#') {
        if (pending && /^https?:\/\//i.test(line) && !seen[line]) {
          pending.url = line;
          result.push(pending);
          seen[line] = true;
        }
        pending = null;
      }
    });
    return result;
  }
  function hdChannels(channels) {
    return channels.filter(function (channel) { return channel.height >= 720; });
  }
  parse.hdChannels = hdChannels;
  if (typeof module !== 'undefined' && module.exports) { module.exports = parse; }
  else { root.HomeM3U = parse; }
}(this));
