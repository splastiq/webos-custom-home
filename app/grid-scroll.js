/* Keep native focus from scrolling a clipped grid by a few pixels. */
(function(){'use strict';window.HomeGridScroll=function(body,grid,list,index){
 if(!body||!list[index]){return;}
 var tops=[],target=list[index].offsetTop-grid.offsetTop;
 for(var i=0;i<list.length;i++){var top=list[i].offsetTop-grid.offsetTop;if(tops.indexOf(top)<0){tops.push(top);}}
 tops.sort(function(a,b){return a-b;});
 var height=list[index].offsetHeight,scroll=body.scrollTop;
 if(target<scroll){scroll=target;}else if(target+height>scroll+body.clientHeight){
  for(var n=0;n<tops.length;n++){if(tops[n]>=scroll&&target+height<=tops[n]+body.clientHeight){scroll=tops[n];break;}}
 }
 var screen=document.getElementById('screen'),oldTop=screen.scrollTop,oldLeft=screen.scrollLeft;
 list[index].focus();body.scrollLeft=0;body.scrollTop=Math.max(0,scroll);screen.scrollTop=oldTop;screen.scrollLeft=oldLeft;
};}());
