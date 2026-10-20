var assert = require('assert');
var remote = require('../app/remote');
[33, 427].forEach(function (code) { assert.strictEqual(remote.channelDirection({ keyCode: code }), 1); });
[34, 428].forEach(function (code) { assert.strictEqual(remote.channelDirection({ keyCode: code }), -1); });
assert.strictEqual(remote.channelDirection({ key: 'ChannelUp', keyCode: 0 }), 1);
assert.strictEqual(remote.channelDirection({ key: 'ChannelDown', keyCode: 0 }), -1);
assert.strictEqual(remote.channelDirection({ keyCode: 403 }), 0); // Red must not be mistaken for a native channel ID.
assert.strictEqual(remote.channelDirection({ keyCode: 38 }), 0);
var order = [2,0,3,1];
assert.strictEqual(remote.nextAvailable(order, 0, 1, function (id) { return id === 3; }), 1);
assert.strictEqual(remote.nextAvailable(order, 2, -1, function () { return false; }), 1);
assert.strictEqual(remote.nextAvailable(order, 1, 1, function () { return false; }), 2);
assert.strictEqual(remote.nextAvailable(order, 1, 1, function () { return true; }), null);
assert.strictEqual(remote.nextAvailable([], 0, 1, function () { return false; }), null);
console.log('Remote: passed (P+/P− aliases, saved order, wraparound, unavailable channels, red key)');
