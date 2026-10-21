(function () {
  'use strict';
  var bridges = [];
  function request(uri, params, done, timeout) {
    if (!window.TV.available) { done('Системные функции доступны на телевизоре'); return; }
    var bridge = new window.PalmServiceBridge();
    var timer;
    var finished = false;
    bridges.push(bridge);
    function finish(error, response) {
      if (finished) { return; }
      finished = true; clearTimeout(timer);
      var index = bridges.indexOf(bridge);
      if (index !== -1) { bridges.splice(index, 1); }
      if (typeof bridge.cancel === 'function') { try { bridge.cancel(); } catch (ignored) {} }
      done(error, response);
    }
    bridge.onservicecallback = function (raw) {
      try {
        var response = JSON.parse(raw);
        finish(response.returnValue === false ? (response.errorText || 'Ошибка системного сервиса') : null, response);
      } catch (error) { finish('Некорректный ответ телевизора'); }
    };
    timer = setTimeout(function () { finish('Телевизор не ответил'); }, timeout || 8000);
    try { bridge.call(uri, JSON.stringify(params)); }
    catch (error) { finish('Системный сервис недоступен'); }
  }
  window.TV = {
    available: typeof window.PalmServiceBridge === 'function',
    launch: function (id, done) { request('luna://com.webos.applicationManager/launch', { id: id }, done); },
    prepareAerialPreview: function (done) {
      request('luna://org.webosbrew.hbchannel.service/exec', {
        command: '/usr/bin/node /media/developer/apps/usr/palm/applications/com.custom.webos.home/aerial-stream.js 9765 >/tmp/custom-home-aerial-stream.log 2>&1 </dev/null &'
      }, function (error) { done(error); });
    },
    scanPlaylists: function (done) {
      var text = '', digest = '', total = 0, count = 0;
      function read() {
        request('luna://org.webosbrew.hbchannel.service/exec', {
          command: '/usr/bin/node /media/developer/apps/usr/palm/applications/com.custom.webos.home/scan-playlists.js --chunk ' + text.length
        }, function (error, response) {
          if (error) { done(error); return; }
          try {
            var part = JSON.parse(response.stdoutString || '');
            if (typeof part.chunk !== 'string' || !part.chunk.length || part.chunk.length > 8192 || part.next !== text.length + part.chunk.length || part.total > 16 * 1024 * 1024 || ++count > 2048) { throw new Error('invalid'); }
            if (digest && (digest !== part.digest || total !== part.total)) { throw new Error('changed'); }
            digest = part.digest; total = part.total; text += part.chunk;
            if (text.length < total) { read(); return; }
            var report = JSON.parse(text);
            if (text.length !== total || !Array.isArray(report.files) || !Array.isArray(report.errors)) { throw new Error('invalid'); }
            done(null, report);
          } catch (invalid) { done('Не удалось прочитать папку плейлистов'); }
        });
      }
      read();
    },
    cachedChannelLogos: function (done) {
      request('luna://org.webosbrew.hbchannel.service/exec', {command:'/usr/bin/node /media/developer/apps/usr/palm/applications/com.custom.webos.home/resolve-channel-logo.js --cached'}, function(error,response){
        var files = {}; try { if (!error) { files = JSON.parse(response.stdoutString).files || {}; } } catch (ignored) {}
        done(files);
      });
    },
    resolveChannelLogo: function (id, name, done) {
      var input = window.btoa(unescape(encodeURIComponent(JSON.stringify({id:String(id || '').slice(0,200),name:String(name || '').slice(0,200)}))));
      request('luna://org.webosbrew.hbchannel.service/exec', {
        command: '/usr/bin/node /media/developer/apps/usr/palm/applications/com.custom.webos.home/resolve-channel-logo.js ' + input
      }, function (error, response) {
        var file = null;
        try { file = JSON.parse(response.stdoutString).file; } catch (ignored) {}
        done(!error && /^runtime-channel-logos\/[a-f0-9]{64}\.png$/.test(file || '') ? file : null);
      }, 55000);
    },
    listApps: function (done) {
      request('luna://com.webos.applicationManager/listApps', {}, function (error, response) {
        if (!error && response && Array.isArray(response.apps) && response.apps.length) { done(null, response.apps); return; }
        // Retail webOS restricts enumeration. Homebrew runs this fixed read-only scanner.
        request('luna://org.webosbrew.hbchannel.service/exec', {
          command: '/usr/bin/node /media/developer/apps/usr/palm/applications/com.custom.webos.home/scan-apps.js'
        }, function (fallbackError, result) {
          if (fallbackError) { done(fallbackError, []); return; }
          try {
            var catalog = JSON.parse(result.stdoutString || '');
            if (!Array.isArray(catalog.apps) || !catalog.apps.length) { done('Список установленных приложений пуст', []); return; }
            done(null, catalog.apps);
          } catch (invalid) { done('Не удалось прочитать список приложений Homebrew', []); }
        });
      });
    },
    usbDevices: function (done) {
      request('luna://com.webos.service.attachedstoragemanager/listDevices', {}, function (error, response) {
        if (error) { done(error); return; }
        done(null, (response.devices || []).filter(function (device) {
          return /usb/i.test(device.deviceType || '') || /^\/tmp\/usb\//.test(device.deviceUri || '');
        }));
      });
    }
  };
}());
