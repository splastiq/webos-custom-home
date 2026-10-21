'use strict';
var assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
var scan=require('../app/scan-playlists'),create=require('../app/playlist-store'),parse=require('../app/playlist-parser');
var dir=fs.mkdtempSync(path.join(os.tmpdir(),'home-playlists-'));
var values={},full=false,store=create(parse,{get:function(k,d){return values[k]===undefined?d:values[k];},set:function(k,v){if(full){return false;}values[k]=v;return true;}});
function list(name,url){return '#EXTM3U\n#EXTINF:-1,'+name+'\nhttps://test/'+url+'.m3u8';}
try {
 fs.writeFileSync(path.join(dir,'Selected Channels.m3u'),list('One','one'));
 fs.writeFileSync(path.join(dir,'two.M3U8'),list('Two','two'));
 fs.writeFileSync(path.join(dir,'ignored.txt'),list('Bad','bad'));
 fs.symlinkSync(path.join(dir,'ignored.txt'),path.join(dir,'link.m3u'));
 var report=scan(dir);assert.strictEqual(report.files.length,2);assert.strictEqual(report.errors.length,1,'Links are not followed');
 var manual=store.add('Manual',list('Manual','manual'));assert.ok(manual.id);
 var result=store.syncFolder(report);assert.ok(result.changed);assert.strictEqual(store.documents().length,4);
 var selected=store.documents().filter(function(d){return d.fileName==='Selected Channels.m3u';})[0];
 assert.strictEqual(selected.name,'Selected Channels');var id=selected.id;
 assert.strictEqual(store.syncFolder(report).changed,false,'Repeated scan is idempotent');
 assert.ok(store.remove(id));assert.ok(!store.documents().some(function(d){return d.id===id;}));
 store.syncFolder(report);assert.ok(!store.documents().some(function(d){return d.id===id;}),'Hidden file is not reimported unchanged');
 fs.writeFileSync(path.join(dir,'Selected Channels.m3u'),list('New','new'));report=scan(dir);store.syncFolder(report);
 assert.ok(store.contains(id,'https://test/new.m3u8'),'Changed file updates the same tab and clears hiding');
 assert.ok(!store.contains(id,'https://test/one.m3u8'));
 fs.writeFileSync(path.join(dir,'Selected Channels.m3u'),'invalid');store.syncFolder(scan(dir));
 assert.ok(store.contains(id,'https://test/new.m3u8'),'Malformed replacement retains last good content');
 fs.unlinkSync(path.join(dir,'Selected Channels.m3u'));store.syncFolder(scan(dir));
 assert.ok(!store.documents().some(function(d){return d.id===id;}),'Removed source file removes imported tab');
 assert.ok(store.documents().some(function(d){return d.id===manual.id;}),'Manual lists are never pruned');
 var before=JSON.stringify(store.documents());store.syncFolder({files:[],errors:[],complete:false});assert.strictEqual(JSON.stringify(store.documents()),before,'Incomplete scan preserves cached files');
 full=true;fs.writeFileSync(path.join(dir,'third.m3u'),list('Three','three'));assert.strictEqual(store.syncFolder(scan(dir)).error,'storage');assert.strictEqual(JSON.stringify(store.documents()),before,'Quota failure is atomic');full=false;
 assert.strictEqual(store.syncFolder({files:[{id:'bad'}],errors:[],complete:true}).error,'invalid');assert.strictEqual(JSON.stringify(store.documents()),before);
 var reloaded=create(parse,{get:function(k,d){return values[k]===undefined?d:values[k];},set:function(){return true;}});assert.strictEqual(JSON.stringify(reloaded.documents()),before,'Imports remain cached across restart');
 fs.writeFileSync(path.join(dir,'large.m3u'),Buffer.alloc(1024*1024+1));assert.ok(scan(dir).errors.some(function(e){return e.fileName==='large.m3u';}));
 assert.strictEqual(scan(path.join(dir,'missing')).complete,false);
 console.log('Playlist folder: passed (scan, links, limits, idempotence, update, hide, malformed replacement, deletion, manual lists, incomplete scans, quota rollback, restart)');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
