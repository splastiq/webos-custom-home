'use strict';
var fs=require('fs'),vm=require('vm'),assert=require('assert'),timers=[],images=[];
function img(visible){var attrs={'data-logo-src':'https://example.invalid/logo.png'};return {style:{},parentNode:{classList:{add:function(){}}},getAttribute:function(k){return attrs[k]||null;},setAttribute:function(k,v){attrs[k]=v;},removeAttribute:function(k){delete attrs[k];},getClientRects:function(){return visible?[{}]:[];},getBoundingClientRect:function(){return {width:50,height:50,top:1,left:1,bottom:51,right:51};}};}
for(var i=0;i<10;i++)images.push(img(i!==9));
var ctx={window:{innerHeight:1080,innerWidth:1920,addEventListener:function(){}},document:{hidden:false,addEventListener:function(){},querySelectorAll:function(){return images;}},Date:Date,setTimeout:function(f,ms){var t={f:f,ms:ms};timers.push(t);return t;},clearTimeout:function(t){t.cancel=true;}};
vm.runInNewContext(fs.readFileSync('app/channel-images.js','utf8'),ctx);
function scan(){var index=timers.findIndex(function(t){return !t.cancel&&t.ms===100;});assert.ok(index>=0);timers.splice(index,1)[0].f();}
scan();assert.strictEqual(images.filter(function(i){return i._logoLoading;}).length,4);assert.ok(!images[9].src);
images[0].onload();scan();assert.strictEqual(images[0].getAttribute('data-logo-loaded'),'true');assert.strictEqual(images.filter(function(i){return i._logoLoading;}).length,4);
images[1].onerror();assert.ok(!images[1].getAttribute('src'));assert.strictEqual(images[1]._logoAttempts,1);scan();assert.strictEqual(images.filter(function(i){return i._logoLoading;}).length,4);
ctx.document.hidden=true;images[2].onload();scan();assert.strictEqual(images.filter(function(i){return i._logoLoading;}).length,3);
console.log('Channel images: concurrency, viewport, success, retry cooldown and hidden-page pause passed');
ctx.document.hidden=false;
images=[img(true)];images[0]._logoAttempts=3;images[0].parentNode.parentNode={};
var lookups=0,favorite=false;
ctx.window.HomeFavorites={has:function(){return favorite;}};
ctx.window.TV={available:true,resolveChannelLogo:function(id,name,done){lookups++;done('runtime-channel-logos/test.png');}};
ctx.window.HomeChannelImages.refresh();scan();assert.strictEqual(lookups,0,'Non-favorites never trigger lookup');
favorite=true;ctx.window.HomeChannelImages.refresh();scan();assert.strictEqual(lookups,1);scan();assert.strictEqual(images[0].getAttribute('data-logo-src'),'runtime-channel-logos/test.png');assert.ok(images[0]._logoLoading);
console.log('Channel image fallback: favorites only and replacement retry passed');
