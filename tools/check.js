/* Syntax checks in one Node process; no build dependencies. */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var es5 = require('./es5');
var roots = ['app', 'tools', 'tests'];
var count = 0;
roots.forEach(function (directory) {
  fs.readdirSync(directory).filter(function (name) { return /\.js$/.test(name); }).forEach(function (name) {
    var file = path.join(directory, name);
    var source = fs.readFileSync(file, 'utf8');
    new vm.Script(source, { filename: file });
    if (directory === 'app') { es5(source, file); }
    count++;
  });
});
console.log('Syntax: ' + count + ' JavaScript files passed (application sources validated as ES5)' );

var html = fs.readFileSync('app/index.html', 'utf8');
var ids = Object.create(null);
html.replace(/\bid="([^"]+)"/g, function (match, id) {
  if (ids[id]) { throw new Error('Duplicate element ID: ' + id); } ids[id] = true; return match;
});
html.replace(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g, function (match, file) {
  if (!fs.existsSync(path.join('app', file))) { throw new Error('Missing script or stylesheet: ' + file); } return match;
});
console.log('HTML: unique IDs and local script / stylesheet references passed');
