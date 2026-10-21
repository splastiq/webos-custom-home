'use strict';
var fs=require('fs'),vm=require('vm'),assert=require('assert'),events={},timer,stored={};
function row(id){return {id:id,nodes:[],parentNode:{getBoundingClientRect:function(){return {left:0,right:500,top:0,bottom:500};},scrollLeft:0,scrollTop:0},querySelectorAll:function(){return this.nodes;},appendChild:function(n){if(n.parentNode){n.parentNode.nodes.splice(n.parentNode.nodes.indexOf(n),1);}this.nodes.push(n);n.parentNode=this;},insertBefore:function(n,t){this.nodes.splice(this.nodes.indexOf(n),1);var i=this.nodes.indexOf(t);this.nodes.splice(i<0?this.nodes.length:i,0,n);}};}
function item(key,r){var a={'data-order-key':key};var n={hidden:false,classList:{add:function(){},remove:function(){}},getAttribute:function(k){return a[k];},hasAttribute:function(k){return a[k]!==undefined;},setAttribute:function(k,v){a[k]=v;},focus:function(){}};Object.defineProperty(n,'nextSibling',{get:function(){return n.parentNode.nodes[n.parentNode.nodes.indexOf(n)+1]||null;}});r.appendChild(n);return n;}
var source=row('channels'),grid=row('library-grid'),a=item('a',grid),b=item('b',grid),c=item('c',grid);
[a,b,c].forEach(function(n){n._source=item(n.getAttribute('data-order-key'),source);});
var doc={addEventListener:function(k,f){events[k]=f;},elementFromPoint:function(){return c;}};
var win={HomeStorage:{set:function(k,v){stored[k]=v;},get:function(){return [];}},addEventListener:function(){}};
var ctx={document:doc,window:win,setTimeout:function(f){timer=f;},clearTimeout:function(){},HomeStorage:win.HomeStorage};
vm.runInNewContext(fs.readFileSync('app/order.js','utf8'),ctx);ctx.HomeOrder.init(function(){},function(){},function(){return true;});
events.mousedown({button:0,target:a});timer();events.mousemove({clientX:200,clientY:200});events.mouseup();
assert.strictEqual(grid.nodes.map(function(n){return n.getAttribute('data-order-key');}).join(','),'b,c,a');
assert.strictEqual(stored['home.order.channels'].join(','),'b,c,a');assert.strictEqual(ctx.HomeOrder.busy(),false);
events.mousedown({button:0,target:a});timer();events.mouseup();assert.strictEqual(ctx.HomeOrder.busy(),false,'Release without movement exits drag');
console.log('Ordering drag: library favorites sync, persisted shelf order and mouse release passed');
