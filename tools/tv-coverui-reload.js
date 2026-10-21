/* Explicit compositor reload trial. Requires the verified temporary CoverUI mount. */
'use strict';
var child = require('child_process');
function remote(mode) {
  var fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
  var dir = '/var/lib/webosbrew/custom-home/coverui';
  var target = '/usr/lib/qt5/qml/CoverUI/StartUpUI.qml';
  var pending = dir + '/reload-pending.json';
  var saved = JSON.parse(fs.readFileSync(dir + '/manifest.json','utf8'));
  function hash(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
  if (mode === 'confirm') {
    if (!fs.existsSync(pending)) { throw new Error('No pending reload trial'); }
    if (hash(fs.readFileSync(target)) !== saved.patched) { throw new Error('Patch is not active'); }
    fs.unlinkSync(pending); console.log('Reload trial confirmed; mount remains temporary'); return;
  }
  if (mode !== 'trial') { throw new Error('Use trial or confirm'); }
  if (fs.existsSync(pending)) { throw new Error('Another reload trial is pending'); }
  if (!fs.existsSync('/sbin/initctl')) { throw new Error('initctl unavailable'); }
  if (hash(fs.readFileSync(target)) !== saved.patched || hash(fs.readFileSync(dir + '/StartUpUI.original.qml')) !== saved.original) { throw new Error('Verified patch and backup required'); }
  if (!fs.readFileSync('/proc/mounts','utf8').split('\n').some(function(line){return line.split(' ')[1]===target;})) { throw new Error('Temporary mount required'); }
  var token = String(Date.now()) + '-' + process.pid;
  var guard = '(' + function(state, path, token, patched, original) {
    var fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
    function hash(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
    fs.writeFileSync(state + '/reload-armed.txt',token,{mode:384});
    setTimeout(function(){
      try {
        if (!fs.existsSync(state + '/reload-pending.json')) { return; }
        var pending = JSON.parse(fs.readFileSync(state + '/reload-pending.json','utf8'));
        if (pending.token !== token) { return; }
        if (hash(fs.readFileSync(path)) !== patched || hash(fs.readFileSync(state + '/StartUpUI.original.qml')) !== original) { throw new Error('Rollback hash mismatch'); }
        cp.execFileSync('/bin/umount',[path]);
        if (hash(fs.readFileSync(path)) !== original) { throw new Error('Original verification failed'); }
        fs.unlinkSync(state + '/reload-pending.json');
        fs.writeFileSync(state + '/reload-result.txt','automatic rollback: original restored\n');
        cp.execFileSync('/sbin/initctl',['restart','surface-manager'],{timeout:20000});
      } catch (error) { fs.writeFileSync(state + '/reload-result.txt','rollback error: ' + error.message + '\n'); }
    },180000);
  }.toString() + ')(' + [dir,target,token,saved.patched,saved.original].map(function(value){return JSON.stringify(value);}).join(',') + ');';
  fs.writeFileSync(dir + '/reload-guard.js',guard,{mode:384});
  fs.writeFileSync(pending,JSON.stringify({token:token,rollbackAfterSeconds:180}),{mode:384});
  var fd = fs.openSync(dir + '/reload-guard.log','a');
  var watchdog = cp.spawn('/usr/bin/node',[dir + '/reload-guard.js'],{detached:true,stdio:['ignore',fd,fd]});
  watchdog.unref(); fs.closeSync(fd);
  cp.execFileSync('/bin/sleep',['1']);
  if (!fs.existsSync(dir + '/reload-armed.txt') || fs.readFileSync(dir + '/reload-armed.txt','utf8') !== token) { throw new Error('Rollback watchdog did not arm; refusing restart'); }
  console.log('Rollback watchdog armed for 180 seconds');
  cp.execFileSync('/sbin/initctl',['restart','surface-manager'],{timeout:20000,stdio:'inherit'});
}
if (require.main === module) {
var mode = process.argv[2];
if (mode !== 'trial' && mode !== 'confirm') { throw new Error('Use trial or confirm'); }
var code = '(' + remote.toString() + ')(' + JSON.stringify(mode) + ');';
child.execFileSync('ares-novacom',['-d',process.argv[3] || 'tv','--run',"/usr/bin/node -e 'eval(new Buffer(\"" + Buffer.from(code).toString('base64') + "\",\"base64\").toString())'"],{stdio:'inherit'});

} else { module.exports = remote; }
