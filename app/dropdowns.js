(function(){'use strict';
 var active=null;
 function close(){if(!active){return;}active.list.hidden=true;active.trigger.setAttribute('aria-expanded','false');active=null;}
 window.HomeDropdowns={close:close,init:function(root){
  var selects=root.querySelectorAll('select');
  Array.prototype.forEach.call(selects,function(select){
   var wrap=document.createElement('span');wrap.className='custom-dropdown';
   var trigger=document.createElement('button');trigger.type='button';trigger.className='dropdown-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label',select.parentNode.firstChild.textContent);
   var list=document.createElement('div');list.className='dropdown-list';list.setAttribute('role','listbox');list.hidden=true;
   var state={trigger:trigger,list:list,items:[],select:select};wrap._dropdown=state;
   function sync(){trigger.textContent=select.options[select.selectedIndex].text;state.items.forEach(function(item,i){item.setAttribute('aria-selected',i===select.selectedIndex?'true':'false');});}
   Array.prototype.forEach.call(select.options,function(option,i){var item=document.createElement('button');item.type='button';item.textContent=option.text;item.setAttribute('role','option');item.addEventListener('click',function(){select.value=option.value;var change=document.createEvent('Event');change.initEvent('change',true,false);select.dispatchEvent(change);sync();close();trigger.focus();});list.appendChild(item);state.items.push(item);});
   trigger.addEventListener('click',function(){var same=active===state;close();if(!same){active=state;list.hidden=false;trigger.setAttribute('aria-expanded','true');state.items[select.selectedIndex].focus();}});
   select.hidden=true;select.parentNode.appendChild(wrap);wrap.appendChild(trigger);wrap.appendChild(list);sync();
  });
 }};
 document.addEventListener('mousedown',function(e){if(active&&!active.trigger.parentNode.contains(e.target)){close();}});
 document.addEventListener('keydown',function(e){
  var node=e.target;while(node&&node!==document&&!node._dropdown){node=node.parentNode;}if(!node||!node._dropdown){return;}
  var state=node._dropdown,key=e.keyCode;
  if([13,32,27,461,37,38,39,40,9].indexOf(key)<0){return;}
  if(key===9){close();return;}
  if(!active&&(key===27||key===461)){return;}
  if(!active&&(key===37||key===39)){return;}
  e.preventDefault();e.stopImmediatePropagation();
  if(key===27||key===461){close();state.trigger.focus();return;}
  if(key===13||key===32){e.target.click();return;}
  if(!active){state.trigger.click();return;}
  var i=state.items.indexOf(e.target);state.items[Math.max(0,Math.min(state.items.length-1,i+(key===38?-1:1)))].focus();
 },true);
}());
