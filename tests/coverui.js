'use strict';
var assert = require('assert');
var vm = require('vm');
var patch = require('../tools/tv-coverui');
var expression = '!systemProperties.supportsBNO && systemProperties.hasConfiguration\n                     && systemProperties.appToLaunch && systemProperties.appNameToLaunch !== undefined';
var source = 'Rectangle {\n    Text { visible: ' + expression + '\n        text: stringSheet.loading\n    }\n}';
var changed = patch(source);
var added = changed.slice(changed.indexOf('visible: ') + 9, changed.indexOf('\n        text:'));
function visible(id, configuration, bno, name) {
  return vm.runInNewContext(added,{systemProperties:{supportsBNO:bno,hasConfiguration:configuration,appToLaunch:{id:id},appNameToLaunch:name}});
}
assert.strictEqual(visible('com.custom.webos.home',true,false,'Home'),false);
assert.strictEqual(visible('com.webos.app.livetv',true,false,'Live TV'),true);
assert.strictEqual(visible('another.app',true,false,'Other'),true);
assert.strictEqual(visible('another.app',false,false,'Other'),false);
assert.strictEqual(visible('another.app',true,true,'Other'),false);
assert.strictEqual(visible('another.app',true,false,undefined),false);
assert.throws(function(){patch(changed);},/refusing/);
assert.throws(function(){patch(source+source);},/refusing/);
assert.throws(function(){patch('unrecognized firmware');},/refusing/);
assert.strictEqual(changed.replace('\n                     && systemProperties.appToLaunch.id !== "com.custom.webos.home" // custom-home-coverui-v1',''),source,'The only change is the Home visibility condition');
console.log('CoverUI patch: passed (Home only, normal inputs, boot gates, exact one-line change, firmware mismatch and double-patch guards)');
