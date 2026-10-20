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
