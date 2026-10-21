/* Local-only Apple Aerial transport. Normalize QuickTime's compatible AVC/HEVC
 * container brands for HTML5 MP4 demuxers; preserve payload bytes and Range offsets.
 * No transcoding, video files, arbitrary URLs, or external listening interfaces. */
'use strict';
var http = require('http');
var child = require('child_process');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var url = require('url');
function rangeFor(header, size) {
  if (!header) { return { start: 0, end: size - 1, partial: false }; }
  var match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) { return null; }
  var start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  var end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return start >= 0 && start < size && end >= start ? { start: start, end: end, partial: true } : null;
}
function normalizeBrands(buffer, offset) {
  // Both 4-byte brands are in the first 20 bytes. Never scan or alter media data.
  if (offset >= 20) { return buffer; }
  [8, 16].forEach(function (start) {
    for (var i = 0; i < 4; i++) {
      var at = start + i - offset;
      if (at >= 0 && at < buffer.length) { buffer[at] = 'isom'.charCodeAt(i); }
    }
  });
  return buffer;
}
function createServer(options) {
  options = options || {};
  var context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'aerial-assets.js'), 'utf8'), context);
  var assets = Object.create(null);
  context.window.HOME_AERIAL_ASSETS.assets.forEach(function (asset) { assets[asset.id] = asset; });
  var sizes = Object.create(null);
  var active = 0;
  var idleTimer;
  var curl = options.curl || 'curl';
  // Scope current public Mozilla trust roots to this transport; never disable TLS
  // verification or change the TV's system certificate store.
  var tls = ['--cacert', path.join(__dirname, 'aerial-ca.crt')];
  function idle() {
    clearTimeout(idleTimer);
    if (options.idleExit && !active) { idleTimer = setTimeout(function () { server.close(function () { process.exit(0); }); }, 60000); }
  }
  var server = http.createServer(function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    var parsed = url.parse(req.url, true);
    if (parsed.pathname === '/health') { idle(); res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('home-aerial-v1'); return; }
    var asset = assets[parsed.query.id];
    var key = parsed.query.format === 'hevc1080' ? 'url-1080-SDR' : parsed.query.format === 'hevc4k' ? 'url-4K-SDR' : 'url-1080-H264';
    var source = asset && asset[key];
    if (parsed.pathname !== '/aerial-video' || typeof source !== 'string' || !/^https:\/\/(sylvan\.apple\.com|a1\.phobos\.apple\.com)\/[A-Za-z0-9_./%+~-]+\.(mov|mp4)$/i.test(source)) { res.writeHead(404); res.end(); return; }
    if (active >= 4) { res.writeHead(503); res.end(); return; }
    active++; clearTimeout(idleTimer);
    var job;
    var closed = false;
    function release() { if (closed) { return; } closed = true; active--; if (job) { job.kill(); } idle(); }
    res.on('close', release); res.on('finish', release);
    function fail() { if (closed) { return; } if (!res.headersSent) { res.writeHead(502); res.end(); } else { res.connection.destroy(); } }
    function stream(size) {
      if (closed) { return; }
      var range = rangeFor(req.headers.range, size);
      if (!range) { res.writeHead(416, { 'Content-Range': 'bytes */' + size }); res.end(); return; }
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', range.end - range.start + 1);
      if (range.partial) { res.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + size); }
      res.writeHead(range.partial ? 206 : 200);
      if (req.method === 'HEAD') { res.end(); return; }
      job = child.spawn(curl, tls.concat(['-fsSL', '--connect-timeout', '10', '--max-time', '1800', '--range', range.start + '-' + range.end, source]));
      var offset = range.start;
      job.stdout.on('data', function (buffer) {
        if (closed) { return; }
        normalizeBrands(buffer, offset); offset += buffer.length;
        if (!res.write(buffer)) { job.stdout.pause(); }
      });
      res.on('drain', function () { if (job && job.stdout) { job.stdout.resume(); } });
      job.on('error', fail);
      job.on('close', function (code) { if (closed) { return; } if (code || offset !== range.end + 1) { fail(); } else { res.end(); } });
      job.stderr.resume();
    }
    if (sizes[source]) { stream(sizes[source]); return; }
    job = child.execFile(curl, tls.concat(['-fsSI', '--connect-timeout', '8', '--max-time', '15', source]), { maxBuffer: 32768 }, function (error, headers) {
      if (closed) { return; }
      if (error) { fail(); return; }
      var matches = String(headers).match(/content-length:\s*\d+/ig);
      var size = matches && Number(matches[matches.length - 1].replace(/[^0-9]/g, ''));
      if (!size || !isFinite(size) || size > 16 * 1024 * 1024 * 1024) { fail(); return; }
      sizes[source] = size; stream(size);
    });
  });
  server.on('listening', idle);
  return server;
}
if (require.main === module) {
  var port = Number(process.argv[2]) || 9765;
  if (port < 1024 || port > 65535) { throw new Error('Invalid local port'); }
  var server = createServer({ idleExit: true });
  server.on('error', function (error) { if (error.code !== 'EADDRINUSE') { console.error(error.message); } process.exit(error.code === 'EADDRINUSE' ? 0 : 1); });
  server.listen(port, '127.0.0.1', function () { fs.writeFileSync('/tmp/custom-home-aerial-stream.pid', String(process.pid)); });
} else { module.exports = { createServer: createServer, rangeFor: rangeFor, normalizeBrands: normalizeBrands }; }
