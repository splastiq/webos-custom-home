/* Read only the dedicated TV folder. Never follow links or fetch playlist URLs. */
'use strict';
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var directory = '/var/lib/webosbrew/custom-home/playlists';
function scan(folder) {
  var result = {files: [], errors: [], complete: true};
  var root;
  try {
    root = fs.lstatSync(folder);
    if (!root.isDirectory() || root.isSymbolicLink()) { throw new Error('unsafe-folder'); }
  } catch (error) {
    result.complete = false; result.error = error.code === 'ENOENT' ? 'missing-folder' : 'unavailable-folder'; return result;
  }
  var names;
  try { names = fs.readdirSync(folder).filter(function(name){return /^[^\/\\\x00]+\.m3u8?$/i.test(name) && name.charAt(0) !== '.';}).sort(); }
  catch (error) { result.complete = false; result.error = 'unavailable-folder'; return result; }
  if (names.length > 32) { result.complete = false; names = names.slice(0,32); result.error = 'too-many-files'; }
  var total = 0;
  names.forEach(function (name) {
    try {
      var file = path.join(folder,name); var stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) { throw new Error('not-regular-file'); }
      if (stat.size > 1024 * 1024 || total + stat.size > 2 * 1024 * 1024) { throw new Error('size-limit'); }
      var content = fs.readFileSync(file); total += content.length;
      if (content.length > 1024 * 1024 || total > 2 * 1024 * 1024) { throw new Error('size-limit'); }
      var text = content.length >= 2 && content[0] === 255 && content[1] === 254 ? content.toString('ucs2') : content.toString('utf8');
      result.files.push({id:'folder-' + crypto.createHash('sha1').update(name,'utf8').digest('hex'), fileName:name,
        name:name.replace(/\.m3u8?$/i,''), text:text, fingerprint:crypto.createHash('sha256').update(content).digest('hex')});
    } catch (error) { result.errors.push({fileName:name, reason:error.message}); }
  });
  return result;
}
if (require.main === module) {
  var serialized = JSON.stringify(scan(directory));
  if (process.argv[2] === '--chunk') {
    var offset = Number(process.argv[3]) || 0;
    if (offset < 0 || offset % 1) { throw new Error('invalid-offset'); }
    var chunk = serialized.slice(offset, offset + 8192);
    console.log(JSON.stringify({chunk:chunk, next:offset + chunk.length, total:serialized.length, digest:crypto.createHash('sha256').update(serialized,'utf8').digest('hex')}));
  } else { console.log(serialized); }
}
else { module.exports = scan; }
