/* Web remote for the LG TV. Runs on the TV itself (node 0.12, ES5) as root.
   GET /            -> remote page (also /envia and /estadistiques)
   GET /api/...     -> JSON; every action is whitelisted and run with execFile (no shell).
   Uploads/sharing live in share.js, usage statistics in stats.js. */
var http = require('http');
var fs = require('fs');
var path = require('path');
var execFile = require('child_process').execFile;

var PORT = 8080;
var PAGES = { '/': 'index.html', '/index.html': 'index.html', '/envia': 'envia.html', '/estadistiques': 'stats.html' };
// static files besides the page (icons for the browser tab / phone home screen)
var STATIC = {
  '/icon-32.png': 'image/png', '/icon-180.png': 'image/png', '/icon-192.png': 'image/png',
  '/icon-512.png': 'image/png', '/manifest.json': 'application/manifest+json'
};

var KEYS = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER', 'BACK', 'HOME', 'EXIT', 'MENU', 'INFO',
  'VOLUMEUP', 'VOLUMEDOWN', 'MUTE', 'CHANNELUP', 'CHANNELDOWN', 'PLAY', 'PAUSE', 'STOP',
  'REWIND', 'FASTFORWARD', 'RED', 'GREEN', 'YELLOW', 'BLUE', 'POWER',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function luna(uri, params, cb, asApp) {
  var args = ['-n', '1'];
  if (asApp) args.push('-a', asApp);
  args.push(uri, JSON.stringify(params || {}));
  execFile('luna-send', args, { timeout: 10000 }, function (err, out) {
    var r;
    try { r = JSON.parse(out); } catch (e) { r = { returnValue: false, errorText: String(err || out) }; }
    cb(r);
  });
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

var share = require('./share.js')(luna, send);
var stats = require('./stats.js')(luna, send);

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

  if (PAGES[p]) {
    return fs.readFile(path.join(__dirname, PAGES[p]), function (err, data) {
      if (err) { res.writeHead(500); return res.end('no page'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  }

  if (STATIC[p]) {
    return fs.readFile(path.join(__dirname, p.slice(1)), function (err, data) {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': STATIC[p], 'Cache-Control': 'max-age=86400' });
      res.end(data);
    });
  }

  if (p.indexOf('/share/') === 0) return share.serve(req, res, p.slice(7));
  if (p === '/api/upload') return share.upload(req, res, q);
  if (p === '/api/share/show') return share.show(q, res);
  if (p === '/api/share/list') return share.list(res);
  if (p === '/api/share/delete') return share.remove(q, res);
  if (p === '/api/share/url') return share.url(q, res);
  if (p === '/api/stats') return stats.api(res);

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

  // Message on the TV screen: a short toast, or an alert that stays until OK is pressed.
  // The notification service renders HTML, so the text is escaped.
  if (p === '/api/msg') {
    var txt = String(q.t || '').trim().slice(0, 300)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    if (!txt) return send(res, 400, { error: 'missatge buit' });
    if (q.mode === 'alert') {
      return luna('luna://com.webos.notification/createAlert', {
        sourceId: 'webosbrew', message: '<b>📱 Missatge</b><br/>' + txt, buttons: [{ label: "D'acord" }]
      }, function (r) { send(res, 200, r); }, 'com.webos.service.secondscreen.gateway');
    }
    return luna('luna://com.webos.notification/createToast', { sourceId: 'webosbrew', message: txt },
      function (r) { send(res, 200, r); }, 'webosbrew');
  }

  if (p === '/api/state') return state(function (s) { send(res, 200, s); });

  send(res, 404, { error: 'not found' });
}).listen(PORT, '0.0.0.0', function () {
  console.log('remote listening on ' + PORT);
});
