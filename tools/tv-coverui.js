/* Reversible, current-boot-only CoverUI experiment. Never remount or write firmware. */
'use strict';
var child = require('child_process');
function patch(source) {
  var needle = 'visible: !systemProperties.supportsBNO && systemProperties.hasConfiguration\n                     && systemProperties.appToLaunch && systemProperties.appNameToLaunch !== undefined';
  if (source.indexOf('custom-home-coverui-v1') !== -1 || source.split(needle).length !== 2) { throw new Error('Unexpected CoverUI source; refusing to patch'); }
  return source.replace(needle, needle + '\n                     && systemProperties.appToLaunch.id !== "com.custom.webos.home" // custom-home-coverui-v1');
}
function remote(mode, patchSource) {
  var fs = require('fs');
  var cp = require('child_process');
  var crypto = require('crypto');
  var target = '/usr/lib/qt5/qml/CoverUI/StartUpUI.qml';
  var state = '/var/lib/webosbrew/custom-home/coverui';
  var original = state + '/StartUpUI.original.qml';
  var replacement = state + '/StartUpUI.patched.qml';
  var metadata = state + '/manifest.json';
  function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
  function mounted() { return fs.readFileSync('/proc/mounts','utf8').split('\n').some(function(line){return line.split(' ')[1] === target;}); }
  var current = fs.readFileSync(target);
  if (mode === 'status') {
    console.log(JSON.stringify({mounted: mounted(), marker: current.toString('utf8').indexOf('custom-home-coverui-v1') !== -1, sha256: hash(current)})); return;
  }
  if (mode === 'remove') {
    if (!mounted()) { console.log('No CoverUI mount to remove'); return; }
    var saved = JSON.parse(fs.readFileSync(metadata,'utf8'));
    if (hash(current) !== saved.patched || hash(fs.readFileSync(original)) !== saved.original) { throw new Error('Unexpected mount or backup; refusing removal'); }
    cp.execFileSync('/bin/umount',[target]);
    if (hash(fs.readFileSync(target)) !== saved.original) { throw new Error('Original verification failed after unmount'); }
    console.log('Original CoverUI restored; backup retained'); return;
  }
  if (mode !== 'apply' && mode !== 'dry-run') { throw new Error('Unknown mode'); }
  if (mounted()) { throw new Error('CoverUI already mounted; inspect status first'); }
  var transform = eval('(' + patchSource + ')');
  var changed = transform(current.toString('utf8'));
  var result = {original: hash(current), patched: hash(new Buffer(changed,'utf8')), target: target, change: 'Hide loading text only for com.custom.webos.home', persistence: 'current boot only'};
  if (mode === 'dry-run') { console.log(JSON.stringify(result)); return; }
  if (!fs.existsSync(state)) { fs.mkdirSync(state,448); }
  if (fs.existsSync(original) && hash(fs.readFileSync(original)) !== result.original) { throw new Error('Existing backup belongs to another firmware; refusing overwrite'); }
  if (!fs.existsSync(original)) { fs.writeFileSync(original,current,{mode:384}); }
  fs.writeFileSync(replacement,changed,{mode:420});
  fs.writeFileSync(metadata,JSON.stringify(result,null,2),{mode:384});
  cp.execFileSync('/bin/mount',['--bind',replacement,target]);
  if (hash(fs.readFileSync(target)) !== result.patched) {
    cp.execFileSync('/bin/umount',[target]); throw new Error('Patched file verification failed; mount removed');
  }
  console.log(JSON.stringify({applied:true, original:result.original, patched:result.patched, rollback:'node tools/tv-coverui.js remove tv', persistence:'current boot only'}));
}
if (require.main === module) {
  var mode = process.argv[2] || 'dry-run';
  if (['dry-run','apply','remove','status'].indexOf(mode) === -1) { throw new Error('Use dry-run, apply, remove or status'); }
  var code = '(' + remote.toString() + ')(' + JSON.stringify(mode) + ',' + JSON.stringify(patch.toString()) + ');';
  var encoded = Buffer.from(code).toString('base64');
  child.execFileSync('ares-novacom',['-d',process.argv[3] || 'tv','--run',"/usr/bin/node -e 'eval(new Buffer(\"" + encoded + "\",\"base64\").toString())'"],{stdio:'inherit'});
} else { module.exports = patch; }
