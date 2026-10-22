(function(){'use strict';
 var values=window.HomeStorage.get('home.screensaver.options.v1',{})||{};
 function valid(v,list,fallback){return list.indexOf(Number(v))>=0?Number(v):fallback;}
 var config=window.HOME_CONFIG.screensaver;
 config.quality=values.quality==='1080p'?'1080p':'4k';
 config.idleMs=valid(values.idleMs,[30000,60000,120000,300000,600000],120000);
 config.rotationMs=valid(values.rotationMs,[60000,120000,300000,600000,900000],300000);
 window.HomePreferences={save:function(){window.HomeStorage.set('home.screensaver.options.v1',{quality:config.quality,idleMs:config.idleMs,rotationMs:config.rotationMs});}};
}());
