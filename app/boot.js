/* Optional webOS 3.x input-based autostart. Enabled only by the TV-side installer. */
(function () {
  'use strict';
  if (!window.TV.available) { return; }
  var bridges = [];
  function call(uri, params, done) {
    var bridge = new window.PalmServiceBridge();
    var finished = false;
    bridges.push(bridge);
    var timer = setTimeout(function () { finish(null); }, 6000);
    function finish(response) {
      if (finished) { return; } finished = true; clearTimeout(timer);
      var index = bridges.indexOf(bridge); if (index !== -1) { bridges.splice(index, 1); }
      if (bridge.cancel) { try { bridge.cancel(); } catch (ignored) {} }
      done(response);
    }
    bridge.onservicecallback = function (raw) { try { finish(JSON.parse(raw)); } catch (invalid) { finish(null); } };
    try { bridge.call(uri, JSON.stringify(params)); } catch (unavailable) { finish(null); }
  }
  function prepare() {
    call('luna://org.webosbrew.hbchannel.service/exec', {
      command: '/bin/sh /var/lib/webosbrew/custom-home/prepare-input.sh'
    }, function (response) {
      if (response && response.returnValue !== false) { call('luna://org.webosbrew.hbchannel.service/autostart', {}, function () {}); }
    });
  }
  call('luna://org.webosbrew.hbchannel.service/exec', {
    command: 'if [ -f /var/lib/webosbrew/custom-home/enabled ]; then echo enabled; fi'
  }, function (response) {
    if (!response || !/enabled/.test(response.stdoutString || '')) { return; }
    call('luna://com.webos.service.eim/addDevice', { appId: 'com.custom.webos.home', pigImage: '', mvpdIcon: '' }, function (registered) {
      if (registered && registered.returnValue !== false) { prepare(); }
    });
  });
}());
