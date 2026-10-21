/* Usage statistics: once a minute, if the screen is on, count a minute for the foreground app.
   Stored as { days: { "2026-10-21": { "<appId>": minutes } } } and kept for KEEP_DAYS.
   Also exposes the TV's own all-time launch counters (db8 kind com.webos.statisticsManager.appLaunchHistory:1).
   Node 0.12, ES5. */
var fs = require('fs');
var execFile = require('child_process').execFile;

var FILE = '/media/developer/stats.json';
var KEEP_DAYS = 120;
var SAVE_EVERY = 5;   // minutes between writes to flash

module.exports = function (luna, send) {
  var data = { days: {}, since: null };
  try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { /* first run */ }
  if (!data.since) data.since = Date.now();
  var dirty = 0, names = {}, namesAt = 0;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function save() {
    var keys = Object.keys(data.days).sort();
    while (keys.length > KEEP_DAYS) delete data.days[keys.shift()];
    try { fs.writeFileSync(FILE + '.tmp', JSON.stringify(data)); fs.renameSync(FILE + '.tmp', FILE); dirty = 0; }
    catch (e) { /* retry next time */ }
  }

  function tick() {
    luna('luna://com.webos.service.tvpower/power/getPowerState', {}, function (p) {
      if (p.state !== 'Active') return;              // screen off / standby: don't count
      luna('luna://com.webos.applicationManager/getForegroundAppInfo', {}, function (a) {
        var app = a.appId || 'desconeguda', k = dayKey(new Date());
        var day = data.days[k] || (data.days[k] = {});
        day[app] = (day[app] || 0) + 1;
        if (++dirty >= SAVE_EVERY) save();
      });
    });
  }
  setInterval(tick, 60000);
  process.on('SIGTERM', function () { if (dirty) save(); process.exit(0); });

  // app id -> title, refreshed at most once an hour
  function loadNames(cb) {
    if (Date.now() - namesAt < 3600000) return cb();
    execFile('luna-send', ['-n', '1', 'luna://com.webos.applicationManager/listApps', '{}'],
      { timeout: 15000, maxBuffer: 8 * 1048576 }, function (err, out) {
        try {
          JSON.parse(out).apps.forEach(function (x) { names[x.id] = x.title; });
          namesAt = Date.now();
        } catch (e) { /* keep old names */ }
        cb();
      });
  }

  // all-time launch counters kept by the TV itself
  function launches(cb) {
    var all = [];
    (function page(next) {
      var query = { from: 'com.webos.statisticsManager.appLaunchHistory:1', limit: 100 };
      if (next) query.page = next;
      execFile('luna-send', ['-n', '1', '-a', 'com.webos.statisticsManager', 'luna://com.palm.db/find',
        JSON.stringify({ query: query })], { timeout: 15000, maxBuffer: 4 * 1048576 }, function (err, out) {
        var r; try { r = JSON.parse(out); } catch (e) { r = {}; }
        (r.results || []).forEach(function (x) { all.push({ id: x.id, count: x.launchCount, last: x.lastLaunchTime * 1000 }); });
        if (r.next && all.length < 1000) return page(r.next);
        cb(all.sort(function (a, b) { return b.count - a.count; }));
      });
    })(null);
  }

  return {
    // GET /api/stats
    api: function (res) {
      loadNames(function () {
        launches(function (l) {
          send(res, 200, { days: data.days, since: data.since, names: names, launches: l, now: Date.now() });
        });
      });
    }
  };
};
