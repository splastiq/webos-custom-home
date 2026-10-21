(function () {
  'use strict';
  var bridges = [];
  function request(uri, params, done) {
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
    timer = setTimeout(function () { finish('Телевизор не ответил'); }, 8000);
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
