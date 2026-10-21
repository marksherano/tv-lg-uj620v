/* "Envia a la TV": uploads from the phone, served back over HTTP (with Range for video seeking)
   and shown on the TV by the Pantalla app (cat.pantalla). Node 0.12, ES5. */
var fs = require('fs');
var path = require('path');
var execFile = require('child_process').execFile;

var DIR = '/media/developer/share';
var MAX_AGE_MS = 7 * 86400000;   // uploads are deleted after a week
var KEEP_FREE_MB = 80;           // never fill the partition beyond this
var VIEWER = 'cat.pantalla';
var BASE = 'http://127.0.0.1:8080/share/';

var TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska'
};
var EXT_BY_MIME = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'video/x-matroska': '.mkv'
};

module.exports = function (luna, send) {
  try { fs.mkdirSync(DIR); } catch (e) { /* exists */ }

  function kind(file) { return /^video\//.test(TYPES[path.extname(file).toLowerCase()] || '') ? 'video' : 'photo'; }

  function files() {
    return fs.readdirSync(DIR).filter(function (f) { return TYPES[path.extname(f).toLowerCase()]; }).map(function (f) {
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
  setInterval(function () { cleanup(0, function () {}); }, 3600000);

  function showItems(names, res) {
    var items = names.map(function (f) {
      return { url: BASE + encodeURIComponent(f), type: kind(f), name: f.replace(/^\d+-/, '') };
    });
    luna('luna://com.webos.applicationManager/launch', { id: VIEWER, params: { items: items, start: 0 } },
      function (r) { send(res, 200, r); });
  }

  return {
    // POST /api/upload?name=IMG_0001.jpg[&show=1]   body = raw file
    upload: function (req, res, q) {
      if (req.method !== 'POST') return send(res, 405, { error: 'cal POST' });
      var mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      var base = path.basename(String(q.name || 'fitxer')).replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
      var ext = path.extname(base).toLowerCase();
      if (!TYPES[ext]) { ext = EXT_BY_MIME[mime]; base = base.replace(/\.[^.]*$/, '') + (ext || ''); }
      if (!ext) return send(res, 415, { error: 'format no compatible (' + (mime || 'desconegut') + ')' });
      var size = +req.headers['content-length'] || 0;
      cleanup(size, function (ok) {
        if (!ok) return send(res, 507, { error: 'no hi ha prou espai a la TV' });
        var file = Date.now() + '-' + base, tmp = path.join(DIR, '.' + file);
        var out = fs.createWriteStream(tmp);
        req.pipe(out);
        out.on('finish', function () {
          fs.renameSync(tmp, path.join(DIR, file));
          if (q.show === '1') return showItems([file], res);
          send(res, 200, { returnValue: true, file: file, type: kind(file) });
        });
        out.on('error', function (e) { try { fs.unlinkSync(tmp); } catch (x) {} send(res, 500, { error: e.message }); });
        req.on('aborted', function () { out.destroy(); try { fs.unlinkSync(tmp); } catch (x) {} });
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
          var start = range[1] ? +range[1] : st.size - +range[2], end = range[1] && range[2] ? +range[2] : st.size - 1;
          if (start >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
          end = Math.min(end, st.size - 1);
          res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1,
                               'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size });
          return fs.createReadStream(f, { start: start, end: end }).pipe(res);
        }
        res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size });
        fs.createReadStream(f).pipe(res);
      });
    },

    // GET /api/share/show?f=a|b|c
    show: function (q, res) {
      var have = files().map(function (f) { return f.file; });
      var names = String(q.f || '').split('|').filter(function (f) { return have.indexOf(f) >= 0; });
      if (!names.length) return send(res, 404, { error: 'fitxer no trobat' });
      showItems(names, res);
    },

    // GET /api/share/list
    list: function (res) {
      cleanup(0, function () {
        var all = files();
        execFile('df', ['-m', DIR], function (err, out) {
          var m = /\s(\d+)\s+\d+%/.exec(out || '');
          send(res, 200, { files: all.slice(0, 60), freeMB: m ? +m[1] : null });
        });
      });
    },

    // GET /api/share/delete?f=name
    remove: function (q, res) {
      var name = path.basename(String(q.f || ''));
      if (!TYPES[path.extname(name).toLowerCase()]) return send(res, 400, { error: 'nom invàlid' });
      fs.unlink(path.join(DIR, name), function (err) { send(res, 200, { returnValue: !err }); });
    },

    // GET /api/share/url?u=<link>  — YouTube, 3Cat or a direct photo/video URL
    url: function (q, res) {
      var u = String(q.u || '').trim(), m;
      if (!/^https?:\/\//i.test(u)) return send(res, 400, { error: 'enllaç no vàlid' });
      if ((m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/))([A-Za-z0-9_-]{11})/.exec(u))) {
        return luna('luna://com.webos.applicationManager/launch',
          { id: 'youtube.leanback.v4', params: { contentTarget: 'https://www.youtube.com/tv?v=' + m[1] } },
          function (r) { send(res, 200, r); });
      }
      if ((m = /3cat\.cat\/.*\/video\/(\d+)/.exec(u) || /ccma\.cat\/.*\/video\/(\d+)/.exec(u))) {
        return luna('luna://com.webos.applicationManager/launch', { id: 'cat.tresc.lite', params: { play: m[1] } },
          function (r) { send(res, 200, r); });
      }
      var ext = path.extname(u.split(/[?#]/)[0]).toLowerCase();
      var type = /\.(mp4|m4v|mov|webm|mkv|m3u8)$/.test(ext) ? 'video' : (/\.(jpe?g|png|gif|webp)$/.test(ext) ? 'photo' : null);
      if (!type) return send(res, 400, { error: 'Només enllaços de YouTube, 3Cat o de fotos i vídeos directes' });
      luna('luna://com.webos.applicationManager/launch',
        { id: VIEWER, params: { items: [{ url: u, type: type, name: path.basename(u.split(/[?#]/)[0]) }] } },
        function (r) { send(res, 200, r); });
    }
  };
};
