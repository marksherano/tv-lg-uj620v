/* TV health for the phone page (/estat): system figures from /proc and /sys, disk space, which of
   our services are up, homebrew apps and the tail of the boot/server logs. Read-only; the only
   command it runs is df. Node 0.12, ES5. */
var fs = require('fs');
var path = require('path');
var http = require('http');
var execFile = require('child_process').execFile;

var APPS = '/media/developer/apps/usr/palm/applications';
var INITD = '/var/lib/webosbrew/init.d';
var SHARE = '/media/developer/share';
var CONFIG = path.join(__dirname, 'config.json');
var LOGS = { arrencada: '/tmp/arrencada.log', remote: '/tmp/remote.log' };
var PORTS = { 22: 'ssh', 23: 'telnet', 3000: 'ssap', 9998: 'depurador' };

function read(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } }

function tail(f, n) {
  var t = read(f);
  if (t.length > 20000) t = t.slice(-20000);
  return t.replace(/\s+$/, '').split('\n').slice(-n).join('\n');
}

function meminfo() {
  var m = {};
  read('/proc/meminfo').split('\n').forEach(function (l) {
    var x = /^(\w+):\s+(\d+)/.exec(l); if (x) m[x[1]] = Math.round(x[2] / 1024);
  });
  return { totalMB: m.MemTotal, availMB: m.MemAvailable != null ? m.MemAvailable : m.MemFree + m.Buffers + m.Cached,
           swapTotalMB: m.SwapTotal, swapUsedMB: m.SwapTotal - m.SwapFree };
}

// listening TCP ports from /proc/net/tcp{,6} (state 0A = LISTEN)
function listening() {
  var open = {};
  [read('/proc/net/tcp'), read('/proc/net/tcp6')].join('\n').split('\n').forEach(function (l) {
    var x = /^\s*\d+:\s+[0-9A-F]+:([0-9A-F]{4})\s+[0-9A-F]+:[0-9A-F]{4}\s+0A/.exec(l);
    if (x) open[parseInt(x[1], 16)] = true;
  });
  var out = {};
  Object.keys(PORTS).forEach(function (p) { out[PORTS[p]] = !!open[p]; });
  return out;
}

// command lines of running processes, to tell whether our daemons are alive
function processes() {
  var list = [];
  fs.readdirSync('/proc').forEach(function (d) {
    if (!/^\d+$/.test(d)) return;
    var c = read('/proc/' + d + '/cmdline').replace(/\0/g, ' ').trim();
    if (c) list.push(c);
  });
  return list;
}

function apps() {
  var out = [];
  try {
    fs.readdirSync(APPS).forEach(function (id) {
      var a; try { a = JSON.parse(read(path.join(APPS, id, 'appinfo.json'))); } catch (e) { a = {}; }
      out.push({ id: id, title: a.title || id, version: a.version || '?' });
    });
  } catch (e) { /* no dev apps */ }
  return out;
}

function initd() {
  try {
    return fs.readdirSync(INITD).filter(function (f) {
      return (fs.statSync(path.join(INITD, f)).mode & 73) && !/\./.test(f);
    });
  } catch (e) { return []; }
}

function shareUsage() {
  var n = 0, bytes = 0;
  try {
    fs.readdirSync(SHARE).forEach(function (f) {
      if (f.charAt(0) === '.') return;
      n++; bytes += fs.statSync(path.join(SHARE, f)).size;
    });
  } catch (e) { /* none */ }
  return { files: n, MB: Math.round(bytes / 1048576) };
}

module.exports = function (luna, send) {
  var sysinfo = null;

  function disks(cb) {
    execFile('df', ['-m', '/media/developer', '/var'], { timeout: 5000 }, function (err, out) {
      var names = ['apps', 'var'], i = 0, list = [];
      String(out || '').split('\n').slice(1).forEach(function (l) {
        var x = /(\d+)\s+(\d+)\s+(\d+)\s+(\d+)%/.exec(l);
        if (x) list.push({ name: names[i++] || '?', totalMB: +x[1], usedMB: +x[2], freeMB: +x[3], pct: +x[4] });
      });
      cb(list);
    });
  }

  function tvlinks(cb) {
    var base; try { base = JSON.parse(read(CONFIG)).tvlinks; } catch (e) { /* none */ }
    if (!base) return cb(null);
    var done = false;
    function end(ok) { if (!done) { done = true; cb(ok); } }
    var req = http.get(base.replace(/\/+$/, '') + '/', function (r) { r.resume(); end(true); });
    req.setTimeout(3000, function () { req.abort(); end(false); });
    req.on('error', function () { end(false); });
  }

  return {
    api: function (res) {
      var out = {}, pending = 6;
      function done() { if (--pending === 0) send(res, 200, out); }

      var up = parseFloat(read('/proc/uptime')) || 0;
      out.now = Date.now();
      out.uptime = Math.round(up);
      out.load = read('/proc/loadavg').split(' ').slice(0, 3).map(Number);
      out.mem = meminfo();
      var temp = parseInt(read('/sys/class/thermal/thermal_zone0/temp'), 10);
      out.tempC = temp ? Math.round(temp / 1000) : null;
      out.ports = listening();
      var procs = processes();
      out.services = {
        brillo: procs.some(function (c) { return /cat\.brillo\.plus\/daemon\.sh/.test(c); }),
        remote: { uptime: Math.round(process.uptime()), rssMB: Math.round(process.memoryUsage().rss / 1048576),
                  node: process.version }
      };
      out.apps = apps();
      out.initd = initd();
      out.share = shareUsage();
      out.logs = { arrencada: tail(LOGS.arrencada, 15), remote: tail(LOGS.remote, 15) };

      luna('luna://com.webos.service.tvpower/power/getPowerState', {}, function (r) { out.power = r.state || null; done(); });
      luna('luna://com.webos.applicationManager/getForegroundAppInfo', {}, function (r) { out.app = r.appId || ''; done(); });
      luna('luna://com.webos.service.connectionmanager/getStatus', {}, function (r) {
        var w = r.wired && r.wired.state === 'connected' ? r.wired : r.wifi && r.wifi.state === 'connected' ? r.wifi : null;
        out.net = w ? { type: w === r.wired ? 'cable' : 'wifi', ip: w.ipAddress, ssid: w.ssid || null,
                        internet: r.isInternetConnectionAvailable } : null;
        done();
      });
      disks(function (d) { out.disks = d; done(); });
      tvlinks(function (ok) { out.services.tvlinks = ok; done(); });
      if (sysinfo) { out.system = sysinfo; return done(); }
      luna('luna://com.webos.service.tv.systemproperty/getSystemInfo',
        { keys: ['modelName', 'firmwareVersion', 'sdkVersion'] }, function (r) {
          if (r.returnValue) sysinfo = { model: r.modelName, firmware: r.firmwareVersion, webos: r.sdkVersion };
          out.system = sysinfo; done();
        });
    }
  };
};
