'use strict';
var assert=require('assert'),vm=require('vm'),fs=require('fs');
var report={files:[{text:new Array(30001).join('Канал https://example.invalid/\n')}],errors:[],complete:true};
function run(change) {
 var source=JSON.stringify(report),calls=0,result,error;
 var context={window:{PalmServiceBridge:function(){var self=this;this.cancel=function(){};this.call=function(uri,params){var offset=Number(JSON.parse(params).command.split(' ').pop());calls++;var part={chunk:source.slice(offset,offset+8192),next:Math.min(offset+8192,source.length),total:source.length,digest:change&&offset?'changed':'stable'};self.onservicecallback(JSON.stringify({returnValue:true,stdoutString:JSON.stringify(part)}));};}},setTimeout:function(){},clearTimeout:function(){}};
 vm.runInNewContext(fs.readFileSync('app/platform.js','utf8'),context);
 context.window.TV.scanPlaylists(function(e,r){error=e;result=r;});
 if(change){assert.ok(error);assert.ok(!result);}else{assert.ok(!error);assert.strictEqual(JSON.stringify(result),source);assert.ok(calls>1);}
}
run(false);run(true);console.log('Playlist transport: large Unicode report and changed snapshot passed');
