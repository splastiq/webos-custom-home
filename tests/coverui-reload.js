'use strict';
var fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
var source=fs.readFileSync(require.resolve('../tools/tv-coverui-reload'),'utf8');
function test(confirm) {
  function hash(s){return crypto.createHash('sha256').update(s).digest('hex');}
  var dir='/var/lib/webosbrew/custom-home/coverui',target='/usr/lib/qt5/qml/CoverUI/StartUpUI.qml',files={},calls=[],timeout;
  files[dir+'/manifest.json']=JSON.stringify({original:hash('original'),patched:hash('patched')});
  files[dir+'/StartUpUI.original.qml']='original';files[target]='patched';files['/sbin/initctl']='binary';files['/proc/mounts']='source '+target+' file rw 0 0';
  var fakeFs={existsSync:function(p){return files[p]!==undefined;},readFileSync:function(p){if(files[p]===undefined){throw new Error('Missing '+p);}return files[p];},writeFileSync:function(p,s){files[p]=String(s);},unlinkSync:function(p){delete files[p];},openSync:function(){return 1;},closeSync:function(){}};
  var context={module:{exports:{}},console:{log:function(){}},process:{pid:7},require:function(name){return name==='fs'?fakeFs:name==='crypto'?crypto:fakeChild;},setTimeout:function(fn){timeout=fn;}};
  var fakeChild={execFileSync:function(cmd,args){calls.push(cmd+' '+args.join(' '));if(cmd==='/bin/umount'){files[target]='original';}},spawn:function(){vm.runInNewContext(files[dir+'/reload-guard.js'],context);return {unref:function(){}};}};
  vm.runInNewContext(source,context);var remote=context.module.exports;remote('trial');
  assert.ok(files[dir+'/reload-armed.txt'],'Watchdog arms before restart');
  assert.strictEqual(calls.filter(function(s){return s.indexOf('restart surface-manager')!==-1;}).length,1);
  if(confirm){remote('confirm');}
  timeout();
  assert.strictEqual(files[target],confirm?'patched':'original');
  assert.strictEqual(calls.filter(function(s){return s.indexOf('restart surface-manager')!==-1;}).length,confirm?1:2,'Unconfirmed trial rolls back and reloads original once');
}
test(false);test(true);
console.log('CoverUI reload: passed (watchdog armed before restart, automatic original restore, confirmed trial cancels rollback)');
