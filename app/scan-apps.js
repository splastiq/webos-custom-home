/* TV catalog and artwork cache. Only Home's own runtime-icons directory is written. */
'use strict';
function cacheIcon(fs, folder, info, cacheRoot) {
  if (!cacheRoot || !/^[A-Za-z0-9_.-]+$/.test(info.id)) { return ''; }
  var names = [info.largeIcon, info.icon, 'icon.png'];
  for (var i = 0; i < names.length; i++) {
    if (typeof names[i] !== 'string') { continue; }
    var name = names[i].replace(/^\$/, '').replace(/^\.\//, '');
    if (!/^[A-Za-z0-9_./ -]+\.(png|jpe?g|svg|gif|webp)$/i.test(name) || /(?:^|\/)\.\.(?:\/|$)/.test(name) || name.charAt(0) === '/') { continue; }
    var candidates = [folder + '/' + name, folder + '/resources/ru/' + name, folder + '/resources/en/' + name, folder + '/resources/' + name];
    var base = typeof info.sysAssetsBasePath === 'string' ? info.sysAssetsBasePath : 'sys-assets';
    if (/^[A-Za-z0-9_/-]+$/.test(base) && base.charAt(0) !== '/' && !/(?:^|\/)\.\.(?:\/|$)/.test(base)) {
      [base + '/hd1080/', base + '/hd720/', base + '/', 'assets/hd1080/', 'myAssets/hd1080/'].forEach(function (prefix) { candidates.push(folder + '/' + prefix + name); });
    }
    for (var j = 0; j < candidates.length; j++) {
      try {
        var source = candidates[j];
        var stat = fs.statSync(source);
        if (!stat.isFile() || stat.size > 512 * 1024 || !stat.size) { continue; }
        var file = info.id + '.' + name.split('.').pop().toLowerCase();
        var target = cacheRoot + '/' + file;
        var cached;
        try { cached = fs.statSync(target); } catch (missing) { cached = null; }
        if (!cached || cached.size !== stat.size || cached.mtime < stat.mtime) { fs.writeFileSync(target, fs.readFileSync(source), { mode: 420 }); }
        return 'runtime-icons/' + file;
      } catch (ignored) { /* Try another original icon / locale. */ }
    }
  }
  return '';
}
function scan(fs, roots, cacheRoot) {
  if (cacheRoot) { try { fs.mkdirSync(cacheRoot, 493); } catch (exists) { /* Existing cache is reused. */ } }
  var result = [];
  var seen = Object.create(null);
  roots.forEach(function (root) {
    var names;
    try { names = fs.readdirSync(root); } catch (error) { return; }
    names.forEach(function (name) {
      if (!/^[A-Za-z0-9_.-]+$/.test(name)) { return; }
      var folder = root + '/' + name;
      try {
        var info = JSON.parse(fs.readFileSync(folder + '/appinfo.json', 'utf8'));
        if (typeof info.id !== 'string' || !info.id || seen[info.id]) { return; }
        // System overlays and background components are not launchable user applications.
        if (root === '/usr/palm/applications' && info.visible === false) { return; }
        seen[info.id] = true;
        result.push({ id: info.id, title: info.title || info.id, folderPath: folder,
          icon: typeof info.icon === 'string' ? info.icon : '',
          largeIcon: typeof info.largeIcon === 'string' ? info.largeIcon : '',
          iconColor: typeof info.iconColor === 'string' && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(info.iconColor) ? info.iconColor : '',
          localIcon: cacheIcon(fs, folder, info, cacheRoot) });
      } catch (ignored) { /* A removed or malformed app must not hide the rest. */ }
    });
  });
  return result;
}
if (require.main === module) {
  console.log(JSON.stringify({ apps: scan(require('fs'), [
    '/media/developer/apps/usr/palm/applications',
    '/media/cryptofs/apps/usr/palm/applications',
    '/usr/palm/applications'
  ], __dirname + '/runtime-icons') }));
} else { module.exports = scan; }
