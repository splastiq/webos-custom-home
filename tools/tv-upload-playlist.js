/* Upload private playlist data to the TV, not to Git or the application bundle. */
'use strict';
var fs = require('fs'), path = require('path'), child = require('child_process');
var file = process.argv[2];
if (!file || !/\.m3u8?$/i.test(file)) { throw new Error('Usage: node tools/tv-upload-playlist.js <file.m3u> [device]'); }
var stat = fs.statSync(file);
if (!stat.isFile() || stat.size > 1024 * 1024) { throw new Error('Playlist must be a regular file, maximum 1 MiB'); }
var content = fs.readFileSync(file);
var text = content.length > 1 && content[0] === 255 && content[1] === 254 ? content.toString('ucs2') : content.toString('utf8');
var count = require('../app/playlist-parser')(text).length;
if (!count) { throw new Error('No HTTP/HTTPS M3U channels found'); }
function upload(name, encoded, expectedHash) {
  var fs = require('fs'), crypto = require('crypto');
  if (!/^[^\/\\\x00]+\.m3u8?$/i.test(name) || name.charAt(0) === '.') { throw new Error('Invalid filename'); }
  var root = '/var/lib/webosbrew/custom-home/playlists';
  ['/var/lib/webosbrew','/var/lib/webosbrew/custom-home',root].forEach(function(dir){
    try { fs.mkdirSync(dir,448); } catch (error) { if (error.code !== 'EEXIST') { throw error; } }
    var stat = fs.lstatSync(dir); if (!stat.isDirectory() || stat.isSymbolicLink()) { throw new Error('Unsafe directory'); }
  });
  var target = root + '/' + name, bytes = new Buffer(encoded,'base64');
  if (!bytes.length || bytes.length > 1024 * 1024) { throw new Error('Empty transfer or size limit exceeded'); }
  function hash(data){return crypto.createHash('sha256').update(data).digest('hex');}
  if (hash(bytes) !== expectedHash) { throw new Error('Transfer checksum mismatch; original retained'); }
  if (fs.existsSync(target)) {
    var stat = fs.lstatSync(target); if (!stat.isFile() || stat.isSymbolicLink()) { throw new Error('Unsafe target'); }
    var previous = fs.readFileSync(target);
    if (hash(previous) === hash(bytes)) { console.log(JSON.stringify({file:name,unchanged:true})); return; }
    fs.writeFileSync(root + '/.' + name + '.backup-' + Date.now(),previous,{mode:384,flag:'wx'});
  }
  var temporary = root + '/.upload-' + process.pid + '-' + Date.now();
  try {
    fs.writeFileSync(temporary,bytes,{mode:384,flag:'wx'});
    fs.renameSync(temporary,target);
  } catch(error) { try { fs.unlinkSync(temporary); } catch(ignored){} throw error; }
  console.log(JSON.stringify({file:name,bytes:bytes.length,sha256:hash(bytes),folder:root}));
}
var expectedHash = require('crypto').createHash('sha256').update(content).digest('hex');
var code = 'var chunks=[];process.stdin.on("data",function(chunk){chunks.push(chunk);});process.stdin.on("end",function(){(' + upload.toString() + ')(' + JSON.stringify(path.basename(file)) + ',Buffer.concat(chunks).toString("utf8"),' + JSON.stringify(expectedHash) + ');});';
var encoded = Buffer.from(code).toString('base64');
var executable = fs.realpathSync(child.execFileSync('which',['ares-novacom'],{encoding:'utf8'}).trim());
var novacom = require(path.resolve(path.dirname(executable),'../lib/base/novacom'));
new novacom.Session({name:process.argv[3] || 'tv'},true,function(error,session){
  if (error) { console.error(error.message || error); process.exitCode = 1; return; }
  var input = new (require('stream').PassThrough)();
  session.run("/usr/bin/node -e 'eval(new Buffer(\"" + encoded + "\",\"base64\").toString())'",input,process.stdout,process.stderr,function(error){
    session.end();
    if (error) { console.error(error.message || error); process.exitCode = 1; }
    else { console.log('HTTP/HTTPS channels in file: ' + count); }
  });
  input.end(content.toString('base64'));
});
