'use strict';
var assert = require('assert');
var check = require('../tools/es5');
assert.throws(function () { check('(function(){"use strict";if(true){function finish(){}}}());', 'regression.js'); }, /Block-scoped function/);
assert.doesNotThrow(function () { check('(function(){"use strict";function finish(){} if(true){var done=function(){};} }());'); });
assert.throws(function () { check('var next = () => 1;'); }, SyntaxError);
assert.throws(function () { check('const value = 1;'); }, SyntaxError);
assert.throws(function () { check('var value = object?.name;'); }, SyntaxError);
console.log('ES5: passed (strict block-function regression, ES6+ rejection, compatible function expressions)');
