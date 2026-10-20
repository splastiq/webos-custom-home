(function (root) {
  'use strict';
  function channelDirection(event) {
    var key = event.key || event.code;
    var code = event.keyCode || event.which;
    if (key === 'ChannelUp' || key === 'PageUp' || code === 33 || code === 427) { return 1; }
    if (key === 'ChannelDown' || key === 'PageDown' || code === 34 || code === 428) { return -1; }
    return 0;
  }
  function nextAvailable(order, current, step, blocked) {
    var position = order.indexOf(current);
    if (position < 0) { position = 0; }
    for (var offset = 1; offset <= order.length; offset++) {
      var index = order[(position + step * offset + order.length) % order.length];
      if (!blocked(index)) { return index; }
    }
    return null;
  }
  var api = { channelDirection: channelDirection, nextAvailable: nextAvailable };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.HomeRemote = api; }
}(this));
