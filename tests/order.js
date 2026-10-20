var assert = require('assert');
var ordered = require('../app/order');
assert.deepStrictEqual(ordered(['a','b','c'], ['c','a']), ['c','a','b']);
assert.deepStrictEqual(ordered(['a','b','c'], ['gone','b','b','a']), ['b','a','c']);
assert.deepStrictEqual(ordered(['a','b'], null), ['a','b']);
assert.deepStrictEqual(ordered(['a','b'], { wrong: true }), ['a','b']);
assert.deepStrictEqual(ordered([], ['gone']), []);
console.log('Ordering: passed (saved order, new and removed entries, duplicates, corrupt storage)');
