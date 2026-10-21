/* Web remote for the LG TV. Runs on the TV itself (node 0.12, ES5) as root.
   GET /            -> remote page
   GET /api/...     -> JSON; every action is whitelisted and run with execFile (no shell). */
var http = require('http');
var fs = require('fs');
var path = require('path');
var execFile = require('child_process').execFile;

var PORT = 8080;
var PAGE = path.join(__dirname, 'index.html');

var KEYS = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER', 'BACK', 'HOME', 'EXIT', 'MENU', 'INFO',
  'VOLUMEUP', 'VOLUMEDOWN', 'MUTE', 'CHANNELUP', 'CHANNELDOWN', 'PLAY', 'PAUSE', 'STOP',
  'REWIND', 'FASTFORWARD', 'RED', 'GREEN', 'YELLOW', 'BLUE', 'POWER',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function luna(uri, params, cb) {
  execFile('luna-send', ['-n', '1', uri, JSON.stringify(params || {})], { timeout: 10000 }, function (err, out) {
    var r;
    try { r = JSON.parse(out); } catch (e) { r = { returnValue: false, errorText: String(err || out) }; }
    cb(r);
  });
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function state(cb) {
  var out = {};
  luna('luna://com.webos.applicationManager/getForegroundAppInfo', {}, function (a) {
    out.app = a.appId || '';
    luna('luna://com.webos.audio/getVolume', {}, function (v) {
      out.volume = v.volume; out.muted = v.muted;
      cb(out);
    });
  });
}

http.createServer(function (req, res) {
  var u = require('url').parse(req.url, true), q = u.query, p = u.pathname;

  if (p === '/' || p === '/index.html') {
    return fs.readFile(PAGE, function (err, data) {
      if (err) { res.writeHead(500); return res.end('no page'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  }

  if (p === '/api/key') {
    var k = String(q.k || '').toUpperCase();
    if (KEYS.indexOf(k) < 0) return send(res, 400, { error: 'tecla desconeguda' });
    return luna('luna://com.webos.service.networkinput/sendSpecialKey', { key: k }, function (r) { send(res, 200, r); });
  }

  if (p === '/api/launch') {
    var id = String(q.id || '');
    if (!/^[a-zA-Z0-9._-]{1,80}$/.test(id)) return send(res, 400, { error: 'id invàlid' });
    return luna('luna://com.webos.applicationManager/launch', { id: id }, function (r) { send(res, 200, r); });
  }

  if (p === '/api/text') {
    var t = String(q.t || '').slice(0, 200);
    return luna('luna://com.webos.service.ime/insertText', { text: t, replace: q.replace === '1' }, function (r) {
      if (q.enter !== '1') return send(res, 200, r);
      luna('luna://com.webos.service.ime/sendEnterKey', {}, function (r2) { send(res, 200, r2); });
    });
  }

  if (p === '/api/screen') {
    var m = q.on === '1' ? 'turnOnScreen' : 'turnOffScreen';
    return luna('luna://com.webos.service.tvpower/power/' + m, {}, function (r) { send(res, 200, r); });
  }

  if (p === '/api/state') return state(function (s) { send(res, 200, s); });

  send(res, 404, { error: 'not found' });
}).listen(PORT, '0.0.0.0', function () {
  console.log('remote listening on ' + PORT);
});
