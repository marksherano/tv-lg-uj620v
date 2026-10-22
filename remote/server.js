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

// Energy saving (picture) and sleep timer (time) are the firmware's own settings, the same
// ones the TV menu writes; tvpowerd turns the TV off when the sleep timer runs out.
var ENERGY = ['off', 'min', 'med', 'max'];
var SLEEP = ['off', '10', '20', '30', '60', '90', '120', '180', '240'];
var sleepSet = null; // { v: '30', at: ms } when the timer was set from here, to show what is left
// Any other time (minutes or a clock time) uses our own timer, which presses POWER when it ends.
var custom = null;   // { end: ms, warn: timeout, off: timeout }

function toast(msg) {
  luna('luna://com.webos.notification/createToast', { sourceId: 'webosbrew', message: msg }, function (r) {
    if (!r.returnValue) console.log('toast failed: ' + JSON.stringify(r));
  }, 'webosbrew');
}

function hhmm(ms) {
  var d = new Date(ms);
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

function sleepMsg(ms) {
  var m = Math.round(ms / 60000);
  var dur = m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + m % 60 + ' min' : '');
  return "⏻ La TV s'apagarà d'aquí a " + dur + ' (a les ' + hhmm(Date.now() + ms) + ')';
}

function cancelCustom() {
  if (custom) { clearTimeout(custom.warn); clearTimeout(custom.off); custom = null; }
}

function startCustom(ms) {
  cancelCustom();
  var c = custom = { end: Date.now() + ms };
  if (ms > 90000) c.warn = setTimeout(function () { toast("⏻ La TV s'apagarà d'aquí a 1 minut"); }, ms - 60000);
  c.off = setTimeout(function () {
    custom = null;
    // POWER toggles: only press it if the TV is still on (it may have been turned off by hand)
    luna('luna://com.webos.service.tvpower/power/getPowerState', {}, function (r) {
      if (['Active', 'Screen Off', 'Screen Saver'].indexOf(r.state) < 0) return;
      luna('luna://com.webos.service.networkinput/sendSpecialKey', { key: 'POWER' }, function () {});
    });
  }, ms);
}

// "23:15" -> ms until the next time the clock shows it (today or tomorrow)
function msUntil(hm) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!m || +m[1] > 23 || +m[2] > 59) return 0;
  var now = new Date(), t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +m[2]);
  if (t <= now) t.setDate(t.getDate() + 1);
  return t - now;
}

function getSetting(category, key, cb) {
  luna('luna://com.webos.settingsservice/getSystemSettings', { category: category, keys: [key] }, function (r) {
    cb(r.settings ? r.settings[key] : undefined);
  });
}

function setSetting(category, key, value, cb) {
  var s = {}; s[key] = value;
  luna('luna://com.webos.settingsservice/setSystemSettings', { category: category, settings: s }, cb);
}

function state(cb) {
  var out = {};
  luna('luna://com.webos.applicationManager/getForegroundAppInfo', {}, function (a) {
    out.app = a.appId || '';
    luna('luna://com.webos.audio/getVolume', {}, function (v) {
      out.volume = v.volume; out.muted = v.muted;
      getSetting('picture', 'energySaving', function (e) {
        out.energy = e;
        getSetting('time', 'sleepTimer', function (t) {
          out.sleep = t;
          // remaining minutes, only if the timer still is the one set from here
          var end = custom ? custom.end
            : t && t !== 'off' && sleepSet && sleepSet.v === t ? sleepSet.at + t * 60000 : 0;
          if (custom) out.sleep = 'custom';
          if (end) {
            out.sleepLeft = Math.max(0, Math.ceil((end - Date.now()) / 60000));
            out.sleepAt = hhmm(end);
          }
          cb(out);
        });
      });
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

  if (p === '/api/energy') {
    var e = String(q.v || '');
    if (ENERGY.indexOf(e) < 0) return send(res, 400, { error: 'valor invàlid' });
    return setSetting('picture', 'energySaving', e, function (r) { send(res, 200, r); });
  }

  // ?m=<minutes> (firmware values use the TV's own timer, others our own) | ?at=HH:MM | ?m=off
  if (p === '/api/sleep') {
    var mins = String(q.m || ''), ms = 0;
    if (q.at) ms = msUntil(String(q.at));
    else if (SLEEP.indexOf(mins) < 0 && /^\d{1,3}$/.test(mins) && +mins >= 1 && +mins <= 720) ms = mins * 60000;
    if (SLEEP.indexOf(mins) < 0 && !ms) return send(res, 400, { error: 'valor invàlid' });
    // off first, so choosing the same time again restarts the countdown
    cancelCustom();
    return setSetting('time', 'sleepTimer', 'off', function () {
      sleepSet = null;
      if (ms) {
        startCustom(ms); toast(sleepMsg(ms));
        return send(res, 200, { returnValue: true });
      }
      if (mins === 'off') {
        toast("⏻ Temporitzador d'apagada cancel·lat");
        return send(res, 200, { returnValue: true });
      }
      setSetting('time', 'sleepTimer', mins, function (r) {
        if (r.returnValue) { sleepSet = { v: mins, at: Date.now() }; toast(sleepMsg(mins * 60000)); }
        send(res, 200, r);
      });
    });
  }

  if (p === '/api/state') return state(function (s) { send(res, 200, s); });

  send(res, 404, { error: 'not found' });
}).listen(PORT, '0.0.0.0', function () {
  console.log('remote listening on ' + PORT);
});
