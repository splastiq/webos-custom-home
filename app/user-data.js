/* Restore before loading stateful UI modules; write debounced snapshots outside IPK. */
(function(){
 'use strict';
 var dirty=false,busy=false,timer,ready=false,allDirty=false,pending={};
 function report(error){window.HomeUserData.error=!!error;var note=document.getElementById('user-data-status');if(note){note.hidden=!error;note.textContent=error?'Не удалось сохранить или восстановить настройки на ТВ. Проверьте Homebrew Channel и перезапустите Home.':'';}}
 function call(args,done){window.TV.userData(args,done);}
 function snapshot(full,keys){var values={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k.indexOf('home.')===0&&(full||keys.indexOf(k)>=0)){values[k]=localStorage.getItem(k);}}return window.btoa(unescape(encodeURIComponent(JSON.stringify({version:1,values:values,merge:!full}))));}
 function save(){
  if(!ready||busy||!dirty||!window.TV.available){return;}busy=true;dirty=false;
  var keys=Object.keys(pending),full=allDirty,data;pending={};allDirty=false;try{data=snapshot(full,keys);}catch(e){busy=false;return;}
  var token=Date.now().toString(36),offset=0;
  function end(error){busy=false;if(error){dirty=true;keys.forEach(function(k){pending[k]=true;});allDirty=allDirty||full;report(true);}else{report(false);if(dirty){clearTimeout(timer);timer=setTimeout(save,1200);}}}
  function next(){if(offset>=data.length){call('commit '+token,function(e){end(e);});return;}var chunk=data.slice(offset,offset+8192);call('write '+token+' '+offset+' '+chunk,function(e){if(e){end(e);return;}offset+=chunk.length;next();});}next();
 }
 function schedule(key){if(typeof key==='string'){pending[key]=true;}else{allDirty=true;}dirty=true;clearTimeout(timer);timer=setTimeout(save,1200);}
 window.HomeUserData={error:false,changed:schedule,restore:function(done){
  if(!window.TV.available){ready=true;done();return;}
  var data='';function next(){call('read '+data.length,function(e,r){
   if(e||!r||typeof r.chunk!=='string'||r.total>12*1024*1024||r.next!==data.length+r.chunk.length){report(true);ready=false;done();return;}
   data+=r.chunk;if(data.length<r.total){next();return;}
   try{if(data){var saved=JSON.parse(decodeURIComponent(escape(window.atob(data))));if(saved.version!==1||!saved.values){throw new Error('invalid');}Object.keys(saved.values).forEach(function(k){if(k.indexOf('home.')===0&&typeof saved.values[k]==='string'){localStorage.setItem(k,saved.values[k]);}});}}catch(x){report(true);ready=false;done();return;}
   ready=true;done();if(!data){schedule();}
  });}next();
 }};
 var original=window.HomeStorage.set;
 window.HomeStorage.set=function(k,v){var ok=original(k,v);if(ok){schedule(k);}return ok;};
 window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',function(){if(document.hidden){save();}});
}());
