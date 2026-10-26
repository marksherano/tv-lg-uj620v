/* "Envia a la TV": uploads from the phone, served back over HTTP (with Range for video seeking)
   and shown on the TV by the Pantalla app (cat.pantalla). Node 0.12, ES5. */
var fs = require('fs');
var path = require('path');
var execFile = require('child_process').execFile;
var http = require('http');

var DIR = '/media/developer/share';
var MAX_AGE_MS = 7 * 86400000;   // uploads are deleted after a week
var KEEP_FREE_MB = 80;           // never fill the partition beyond this
var VIEWER = 'cat.pantalla';
var BASE = 'http://127.0.0.1:8080/share/';
// Other video pages (RTVE, Atresplayer clips...) are resolved by yt-dlp running on another machine
// of the LAN (tvlinks/tvlinks.py), whose address is in config.json: {"tvlinks": "http://host:8097"}.
// Content with DRM cannot be played.
var CONFIG = path.join(__dirname, 'config.json');
// Links sent to the TV (newest first, last 50) so /enviats can list, reopen and delete them
var LINKS = path.join(DIR, '.links.json');

var TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska'
};
var EXT_BY_MIME = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'video/x-matroska': '.mkv'
};

var msgs = require('./msgs.js'), T = msgs.T;

module.exports = function (luna, send) {
  try { fs.mkdirSync(DIR); } catch (e) { /* exists */ }

  function kind(file) { return /^video\//.test(TYPES[path.extname(file).toLowerCase()] || '') ? 'video' : 'photo'; }

  function files() {
    // dot files are uploads still in progress (and .links.json)
    return fs.readdirSync(DIR).filter(function (f) {
      return f.charAt(0) !== '.' && TYPES[path.extname(f).toLowerCase()];
    }).map(function (f) {
      var st = fs.statSync(path.join(DIR, f));
      return { file: f, size: st.size, mtime: st.mtime.getTime(), type: kind(f) };
    }).sort(function (a, b) { return b.mtime - a.mtime; });
  }

  function cleanup(needBytes, cb) {
    var now = Date.now(), list = files();
    list.forEach(function (f) { if (now - f.mtime > MAX_AGE_MS) fs.unlinkSync(path.join(DIR, f.file)); });
    execFile('df', ['-m', DIR], function (err, out) {
      var m = /\s(\d+)\s+\d+%/.exec(out || ''), free = m ? +m[1] : 0;
      var need = Math.ceil((needBytes || 0) / 1048576) + KEEP_FREE_MB;
      list = files();
      while (free < need && list.length) {          // drop oldest uploads until it fits
        var old = list.pop();
        fs.unlinkSync(path.join(DIR, old.file));
        free += Math.floor(old.size / 1048576);
      }
      cb(free >= need);
    });
  }
  cleanup(0, function () {});

  function links() {
    try { return JSON.parse(fs.readFileSync(LINKS, 'utf8')); } catch (e) { return []; }
  }
  function saveLinks(l) {
    try { fs.writeFileSync(LINKS, JSON.stringify(l.slice(0, 50))); } catch (e) { console.log('links: ' + e.message); }
  }
  function remember(u, title) {
    var l = links(), old = l.filter(function (x) { return x.u === u; })[0];
    l = l.filter(function (x) { return x.u !== u; });
    l.unshift({ u: u, title: title || (old && old.title) || '', at: Date.now() });
    saveLinks(l);
  }
  setInterval(function () { cleanup(0, function () {}); }, 3600000);

  function showItems(names, res, start) {
    var items = names.map(function (f) {
      return { url: BASE + encodeURIComponent(f), type: kind(f), name: f.replace(/^\d+-/, '') };
    });
    luna('luna://com.webos.applicationManager/launch', { id: VIEWER, params: { items: items, start: start || 0, lang: msgs.lang() } },
      function (r) { send(res, 200, r); });
  }

  // The iPhone shortcut sends shared photos one request at a time: files that arrive less than two
  // minutes apart join the same slideshow, which opens on the newest one.
  var batch = { names: [], at: 0 };
  function showBatch(file, res) {
    if (Date.now() - batch.at > 120000) batch.names = [];
    batch.names.push(file); batch.at = Date.now();
    showItems(batch.names.slice(), res, batch.names.length - 1);
  }

  function upload(req, res, q) {
    if (req.method !== 'POST') return send(res, 405, { error: T('cal POST') });
    var mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    var base = path.basename(String(q.name || 'fitxer')).replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
    var ext = path.extname(base).toLowerCase();
    if (!TYPES[ext]) { ext = EXT_BY_MIME[mime]; base = base.replace(/\.[^.]*$/, '') + (ext || ''); }
    if (!ext && /hei[cf]/.test(mime + base.toLowerCase())) {
      return send(res, 415, { error: T("la TV no obre fotos HEIC: a l'iPhone, Configuració > Càmera > Formats > Més compatible") });
    }
    if (!ext) return send(res, 415, { error: T('format no compatible ({0})', mime || T('desconegut')) });
    var size = +req.headers['content-length'] || 0;
    cleanup(size, function (ok) {
      if (!ok) return send(res, 507, { error: T('no hi ha prou espai a la TV') });
      var file = Date.now() + '-' + base, tmp = path.join(DIR, '.' + file);
      var out = fs.createWriteStream(tmp);
      req.pipe(out);
      out.on('finish', function () {
        fs.renameSync(tmp, path.join(DIR, file));
        if (q.batch === '1') return showBatch(file, res);
        if (q.show === '1') return showItems([file], res);
        send(res, 200, { returnValue: true, file: file, type: kind(file) });
      });
      out.on('error', function (e) { try { fs.unlinkSync(tmp); } catch (x) {} send(res, 500, { error: e.message }); });
      req.on('aborted', function () { out.destroy(); try { fs.unlinkSync(tmp); } catch (x) {} });
    });
  }

  function openUrl(q, res) {
    var u = String(q.u || '').trim(), m;
    if (!/^https?:\/\//i.test(u)) return send(res, 400, { error: T('enllaç no vàlid') });
    remember(u);
    if ((m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/))([A-Za-z0-9_-]{11})/.exec(u))) {
      // the app's own deeplinkingParams format ("v=$CONTENTID"); a full URL just opens the home screen.
      // A running YouTube ignores it (and so does DIAL), so it is closed first; relaunched sooner than
      // ~8 s it resumes the old instance on its home screen. With more than one account it asks who
      // is watching, then plays the video.
      var yt = m[1];
      var go = function () {
        luna('luna://com.webos.applicationManager/launch',
          { id: 'youtube.leanback.v4', params: { contentTarget: 'v=' + yt } }, function () {});
      };
      return luna('luna://com.webos.applicationManager/running', {}, function (r) {
        var on = (r.running || []).some(function (a) { return a.id === 'youtube.leanback.v4'; });
        send(res, 200, { returnValue: true });
        if (!on) return go();
        luna('luna://com.webos.applicationManager/closeByAppId', { id: 'youtube.leanback.v4' }, function () {
          setTimeout(go, 8000);
        });
      });
    }
    if ((m = /3cat\.cat\/.*\/video\/(\d+)/.exec(u) || /ccma\.cat\/.*\/video\/(\d+)/.exec(u))) {
      return luna('luna://com.webos.applicationManager/launch', { id: 'cat.tresc.lite', params: { play: m[1] } },
        function (r) { send(res, 200, r); });
    }
    var ext = path.extname(u.split(/[?#]/)[0]).toLowerCase();
    var type = /\.(mp4|m4v|mov|webm|mkv|m3u8)$/.test(ext) ? 'video' : (/\.(jpe?g|png|gif|webp)$/.test(ext) ? 'photo' : null);
    if (!type) return resolveAndShow(u, res);
    show(u, type, path.basename(u.split(/[?#]/)[0]), res);
  }

  return {
    // POST /api/upload?name=IMG_0001.jpg[&show=1|&batch=1]   body = raw file
    upload: upload,

    // POST /api/compartir[?name=…] from the iPhone shortcut (or anything else): the body is either a
    // photo/video, or something with a link in it (plain text, JSON, a .webloc/.url, a Safari page)
    compartir: function (req, res, q) {
      if (req.method !== 'POST') return send(res, 405, { error: T('cal POST') });
      var mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      var ext = path.extname(String(q.name || '')).toLowerCase();
      if (/^(image|video)\//.test(mime) || TYPES[ext]) return upload(req, res, { name: q.name, batch: '1' });
      var body = '', big = false;
      req.setEncoding('utf8');
      req.on('data', function (c) { if (body.length < 262144) body += c; else big = true; });
      req.on('end', function () {
        var m = /https?:\/\/[^\s"'<>\\\x00-\x1f]+/.exec(body.replace(/\\\//g, '/'));
        if (!m) return send(res, 415, { error: T(big ? 'fitxer no compatible' : 'no hi ha cap foto, vídeo ni enllaç') });
        openUrl({ u: m[0] }, res);
      });
    },

    // GET /share/<file>   (supports Range so the TV can seek in videos)
    serve: function (req, res, name) {
      name = path.basename(decodeURIComponent(name));
      var f = path.join(DIR, name), type = TYPES[path.extname(name).toLowerCase()];
      if (!type || name.charAt(0) === '.') { res.writeHead(404); return res.end(); }
      fs.stat(f, function (err, st) {
        if (err) { res.writeHead(404); return res.end(); }
        var range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
        if (range) {
          var start = range[1] ? +range[1] : Math.max(0, st.size - +range[2]), end = range[1] && range[2] ? +range[2] : st.size - 1;
          if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
          end = Math.min(end, st.size - 1);
          res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1,
                               'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size });
          return fs.createReadStream(f, { start: start, end: end }).pipe(res);
        }
        res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size });
        fs.createReadStream(f).pipe(res);
      });
    },

    // POST /api/share/show?f=a|b|c
    show: function (q, res) {
      var have = files().map(function (f) { return f.file; });
      var names = String(q.f || '').split('|').filter(function (f) { return have.indexOf(f) >= 0; });
      if (!names.length) return send(res, 404, { error: T('fitxer no trobat') });
      showItems(names, res);
    },

    // GET /api/share/list
    list: function (res) {
      cleanup(0, function () {
        var all = files();
        execFile('df', ['-m', DIR], function (err, out) {
          var m = /\s(\d+)\s+\d+%/.exec(out || '');
          send(res, 200, { files: all, links: links(), freeMB: m ? +m[1] : null });
        });
      });
    },

    // POST /api/share/delete?f=a|b|c[&l=<link>&l=<link>…]   or ?all=1 (every file and link)
    remove: function (q, res) {
      var names = q.all === '1' ? files().map(function (f) { return f.file; })
        : String(q.f || '').split('|').filter(Boolean).map(function (f) { return path.basename(f); });
      var drop = q.all === '1' ? null : [].concat(q.l || []).map(String);
      if (names.some(function (n) { return n.charAt(0) === '.' || !TYPES[path.extname(n).toLowerCase()]; })) {
        return send(res, 400, { error: T('nom invàlid') });
      }
      if (!names.length && drop && !drop.length) return send(res, 400, { error: T('nom invàlid') });
      var gone = 0;
      names.forEach(function (n) { try { fs.unlinkSync(path.join(DIR, n)); gone++; } catch (e) { /* already gone */ } });
      if (!drop || drop.length) saveLinks(drop ? links().filter(function (x) { return drop.indexOf(x.u) < 0; }) : []);
      send(res, 200, { returnValue: true, files: gone });
    },

    // POST /api/share/url?u=<link>  — YouTube, 3Cat, a direct photo/video URL or any page yt-dlp knows
    url: openUrl
  };

  function show(url, type, name, res) {
    luna('luna://com.webos.applicationManager/launch',
      { id: VIEWER, params: { items: [{ url: url, type: type, name: name }], lang: msgs.lang() } },
      function (r) { send(res, 200, r); });
  }

  function resolveAndShow(u, res) {
    var done = false, base;
    function fail(msg) { if (!done) { done = true; send(res, 200, { returnValue: false, error: msg }); } }
    try { base = JSON.parse(fs.readFileSync(CONFIG, 'utf8')).tvlinks; } catch (e) { /* no config */ }
    if (!base) return fail(T('Només enllaços de YouTube, 3Cat o de fotos i vídeos directes (el servei tvlinks no està configurat)'));
    var req = http.get(base.replace(/\/+$/, '') + '/resolve?u=' + encodeURIComponent(u), function (r) {
      var body = '';
      r.setEncoding('utf8');
      r.on('data', function (c) { body += c; });
      r.on('end', function () {
        var j;
        try { j = JSON.parse(body); } catch (e) { return fail(T('resposta estranya del servei tvlinks')); }
        if (!j.url) return fail(j.error ? T(j.error) : T("no s'ha trobat el vídeo"));   // tvlinks answers in Catalan
        done = true;
        if (j.title) remember(u, j.title);
        show(j.url, 'video', j.title || u, res);
      });
    });
    req.setTimeout(100000, function () { req.abort(); fail(T('el servei tvlinks ha trigat massa')); });
    req.on('error', function () { fail(T("el servei tvlinks no respon (l'ordinador és encès?)")); });
  }
};
