/* Local-only static preview; no build or dependencies. */
var http = require('http');
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '../app');
var aerialServer = require('../app/aerial-stream').createServer();
aerialServer.on('error', function (error) { if (error.code !== 'EADDRINUSE') { console.error(error.message); } });
aerialServer.listen(9765, '127.0.0.1');
http.createServer(function (req, res) {
  var name;
  try { name = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); res.end(); return; }
  var file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (file.indexOf(root + path.sep) !== 0) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, function (error, data) {
    if (error) { res.writeHead(404); res.end('Not found'); return; }
    res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.m3u':'text/plain; charset=utf-8','.ttf':'font/ttf'})[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(8080, '127.0.0.1', function () { console.log('Preview: http://127.0.0.1:8080'); });
