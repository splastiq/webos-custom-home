'use strict';
var assert=require('assert'),fs=require('fs'),vm=require('vm');
var screen={scrollTop:0,scrollLeft:0},body={scrollTop:0,scrollLeft:0,clientHeight:180},grid={offsetTop:20},list=[];
for(var i=0;i<16;i++){list.push({offsetTop:20+Math.floor(i/4)*100,offsetHeight:80,focus:function(){body.scrollTop=13;body.scrollLeft=7;screen.scrollTop=3;screen.scrollLeft=4;}});}
var context={window:{},document:{getElementById:function(){return screen;}}};vm.runInNewContext(fs.readFileSync('app/grid-scroll.js','utf8'),context);
context.window.HomeGridScroll(body,grid,list,8);assert.strictEqual(body.scrollTop,100,'Scroll advances by a whole row');assert.strictEqual(body.scrollLeft,0);assert.strictEqual(screen.scrollTop,0);assert.strictEqual(screen.scrollLeft,0);
context.window.HomeGridScroll(body,grid,list,9);assert.strictEqual(body.scrollTop,100,'Horizontal focus leaves row position unchanged');
context.window.HomeGridScroll(body,grid,list,0);assert.strictEqual(body.scrollTop,0,'Up restores the previous row exactly');
console.log('Grid scroll: whole rows, stable horizontal focus and parent offsets passed');
