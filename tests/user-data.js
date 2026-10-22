'use strict';
var assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),create=require('../app/user-data-store');
var dir=fs.mkdtempSync(path.join(os.tmpdir(),'home-settings-')),run=create(dir);
try{
 assert.strictEqual(run(['read','0']).total,0);
 var data={version:1,values:{'home.favorites.v1':JSON.stringify({channels:{test:true}}),'home.playlists.v1':new Array(30001).join('Канал')}};
 var encoded=Buffer.from(JSON.stringify(data)).toString('base64');
 for(var i=0;i<encoded.length;i+=8192){assert.ok(run(['write','test',String(i),encoded.slice(i,i+8192)]).ok);}
 run(['commit','test']);var result='',part;do{part=run(['read',String(result.length)]);result+=part.chunk;}while(result.length<part.total);
 assert.deepStrictEqual(JSON.parse(Buffer.from(result,'base64').toString('utf8')),data);
 assert.throws(function(){run(['write','../bad','0','YQ==']);});
 run(['write','bad','0',Buffer.from(JSON.stringify({version:1,values:{other:'private'}})).toString('base64')]);assert.throws(function(){run(['commit','bad']);});
 assert.strictEqual(run(['read','0']).total,encoded.length,'Invalid replacement preserves last good settings');
 assert.throws(function(){run(['write','test2','20','YQ==']);});
 var patch=Buffer.from(JSON.stringify({version:1,merge:true,values:{'home.order.channels':'[1,2]'}})).toString('base64');run(['write','patch','0',patch]);run(['commit','patch']);var merged=JSON.parse(fs.readFileSync(path.join(dir,'settings.json'),'utf8'));assert.strictEqual(merged.values['home.playlists.v1'],data.values['home.playlists.v1']);assert.strictEqual(merged.values['home.order.channels'],'[1,2]');
 console.log('TV user data: multi-chunk Unicode persistence, restart, invalid commit rollback and traversal passed');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
var vm=require('vm'),local={},payload=Buffer.from(JSON.stringify({version:1,values:{'home.favorites.v1':'{"channels":{"saved":true}}','home.screensaver.options.v1':'{"quality":"1080p"}'}})).toString('base64');
var localBackend={getItem:function(k){return local[k]||null;},setItem:function(k,v){local[k]=v;},key:function(i){return Object.keys(local)[i];}};Object.defineProperty(localBackend,'length',{get:function(){return Object.keys(local).length;}});
var context={localStorage:localBackend,document:{addEventListener:function(){}},setTimeout:function(){},clearTimeout:function(){},escape:escape,unescape:unescape,encodeURIComponent:encodeURIComponent,decodeURIComponent:decodeURIComponent,window:{HomeStorage:{set:function(){return true;}},TV:{available:true,userData:function(args,done){var off=Number(args.split(' ')[1]);done(null,{chunk:payload.slice(off,off+32),next:Math.min(off+32,payload.length),total:payload.length});}},btoa:function(s){return Buffer.from(s,'binary').toString('base64');},atob:function(s){return Buffer.from(s,'base64').toString('binary');},addEventListener:function(){}}};
vm.runInNewContext(fs.readFileSync('app/user-data.js','utf8'),context);var ready=false;context.window.HomeUserData.restore(function(){ready=true;});assert.ok(ready);assert.strictEqual(JSON.parse(local['home.favorites.v1']).channels.saved,true);assert.strictEqual(JSON.parse(local['home.screensaver.options.v1']).quality,'1080p');
console.log('TV user data: restored into empty browser storage before UI initialization');
var delayed,writeCalls=0;
context.document.getElementById=function(){return null;};context.setTimeout=function(fn){delayed=fn;};context.window.HomeStorage={set:function(){return true;}};context.window.TV.userData=function(args,done){if(args.indexOf('read ')===0){done('unavailable');}else{writeCalls++;done(null,{ok:true});}};
vm.runInNewContext(fs.readFileSync('app/user-data.js','utf8'),context);context.window.HomeUserData.restore(function(){});context.window.HomeStorage.set('home.changed',true);delayed();assert.strictEqual(writeCalls,0,'Failed restore must not overwrite external backup');assert.strictEqual(context.window.HomeUserData.error,true);
console.log('TV user data: failed restore prevents overwriting the external backup');
