/* 3Cat Lite — unofficial 3Cat client for old LG webOS TVs (Chromium 38: ES5 only). */
(function () {
  'use strict';

  var API = 'https://api.3cat.cat/';
  var MEDIA = 'https://api-media.3cat.cat/pvideo/media.jsp?media=video&versio=vast&profile=tv&format=dm&idint=';
  var EXEC = 'luna://org.webosbrew.hbchannel.service/exec';
  var PAGE = 40, COLS = 4;

  var CHANNELS = [
    { id: 'tv3', name: 'TV3', logo: 'https://statics.3cat.cat/img/logos/tv3_colorBgNegre.svg' },
    { id: '324', name: '3CatInfo', logo: 'https://statics.3cat.cat/img/logos/324_color_fonsnegre.svg' },
    { id: '33d', name: '33', logo: 'https://statics.3cat.cat/img/logos/33.svg' },
    { id: 'sx3', name: 'SX3', logo: 'https://statics.3cat.cat/img/logos/sx3_colorBgNegre.svg' },
    { id: 'esport3', name: 'Esport3', logo: 'https://statics.3cat.cat/img/logos/esport3_colorBgNegre.svg' },
    { id: 'cr', name: 'Catalunya Ràdio', logo: 'https://statics.3cat.cat/img/logos/catradio_colorBgNegre.svg' }
  ];
  var TABS = ['Inici', 'Directes', 'Últims vídeos', 'Programes', 'Cerca'];
  var HOME = 0, LIVE = 1, LATEST = 2, PROGRAMS = 3, SEARCH = 4;

  function $(id) { return document.getElementById(id); }

  /* ---------- local storage ---------- */
  function load(key, def) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota */ } }

  // favourites: [[programId, title, img], ...]
  function isFav(id) { return load('favs', []).some(function (f) { return f[0] === id; }); }
  function toggleFav(id, title, img) {
    var favs = load('favs', []), had = isFav(id);
    favs = favs.filter(function (f) { return f[0] !== id; });
    if (!had) favs.unshift([id, title, img]);
    save('favs', favs);
    return !had;
  }

  // continue watching: [{id, title, img, sub, dur, pos, len}, ...] newest first
  var CW_MAX = 20;
  function cwGet(id) { var e = null; load('cw', []).forEach(function (c) { if (c.id === id) e = c; }); return e; }
  function cwPut(entry) {
    var list = load('cw', []).filter(function (c) { return c.id !== entry.id; });
    if (entry.pos) list.unshift(entry);
    save('cw', list.slice(0, CW_MAX));
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- networking ---------- */
  var bridges = [];
  function luna(uri, params, cb) {
    var b = new PalmServiceBridge();
    bridges.push(b);
    b.onservicecallback = function (msg) {
      bridges.splice(bridges.indexOf(b), 1);
      var r; try { r = JSON.parse(msg); } catch (e) { r = { returnValue: false }; }
      cb(r);
    };
    b.call(uri, JSON.stringify(params));
  }

  var useCurl = false;
  function getText(url, cb) {
    function viaCurl() {
      if (!window.PalmServiceBridge) return cb('xarxa');
      luna(EXEC, { command: "curl -s -m 20 '" + url.replace(/'/g, '') + "'" }, function (r) {
        if (r.stdoutString) cb(null, r.stdoutString); else cb('xarxa');
      });
    }
    if (useCurl) return viaCurl();
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.timeout = 20000;
    x.onload = function () {
      if (x.status !== 200) return cb('HTTP ' + x.status);
      cb(null, x.responseText);
    };
    x.onerror = x.ontimeout = function () { useCurl = true; viaCurl(); };
    x.send();
  }
  function getJSON(url, cb) {
    getText(url, function (err, t) {
      if (err) return cb(err);
      try { cb(null, JSON.parse(t)); } catch (e) { cb('resposta invàlida'); }
    });
  }

  /* ---------- data helpers ---------- */
  function pickImg(list, want) {
    var best = null, bestD = 1e9;
    (list || []).forEach(function (i) {
      var m = /(\d+)x(\d+)/i.exec(i.mida || ''); if (!m || !i.text) return;
      var w = +m[1], h = +m[2];
      if (h * 1.5 > w) return;                      // skip portrait / banner-ish images
      if (w / h > 2.2) return;
      var d = Math.abs(w - want);
      if (d < bestD) { bestD = d; best = i.text; }
    });
    return best;
  }
  function fmtDur(s) {
    var m = /^(\d+):(\d+):(\d+)/.exec(s || ''); if (!m) return '';
    var h = +m[1], mi = +m[2];
    return h ? h + ' h ' + pad(mi) : (mi || 1) + ' min';
  }
  function fmtDate(s) { var m = /^(\d+)\/(\d+)\/(\d+)/.exec(s || ''); return m ? m[1] + '/' + m[2] + '/' + m[3] : ''; }
  function norm(s) {
    s = String(s || '').toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.replace(/[^a-z0-9 ]/g, ' ');
  }
  function videoCard(v) {
    var prog = v.programa && v.programa.indexOf('Sense nom') < 0 ? v.programa : '';
    return { kind: 'video', id: v.id, title: v.titol, img: pickImg(v.imatges, 410),
             sub: (prog ? prog + ' · ' : '') + fmtDate(v.data_emissio || v.data_publicacio), dur: fmtDur(v.durada) };
  }

  /* ---------- programs catalogue (cached for a day) ---------- */
  var programs = null;
  function loadPrograms(cb) {
    if (programs) return cb();
    try {
      var c = JSON.parse(localStorage.getItem('progs') || 'null');
      if (c && Date.now() - c.t < 86400000) { programs = c.list; return cb(); }
    } catch (e) { /* ignore broken cache */ }
    getJSON(API + 'programestv?_format=json&items_pagina=2000', function (err, d) {
      if (err) return cb(err);
      var list = [];
      d.resposta.items.lletra.forEach(function (l) {
        l.item.forEach(function (p) {
          list.push([p.id, p.titol, pickImg(p.imatges && p.imatges.imatge, 410), l.valor || p.lletra || '#']);
        });
      });
      programs = list;
      try { localStorage.setItem('progs', JSON.stringify({ t: Date.now(), list: list })); } catch (e) { /* quota */ }
      cb();
    });
  }
  function progCard(p) { return { kind: 'prog', id: p[0], title: p[1], img: p[2], letter: p[3] }; }

  /* ---------- views ----------
     A view = { title, rows: [[item...]...], focus: {r, c}, more: fn|null }
     Row items are rendered into #grid; rows with .letters render as the A–Z bar. */
  var stack = [];
  var area = 'tabs';     // 'tabs' | 'grid' | 'search'
  var tab = 0, tabFocus = 0;
  function view() { return stack[stack.length - 1]; }

  function msg(t) { $('msg').textContent = t || ''; }

  function renderTabs() {
    $('tabs').innerHTML = TABS.map(function (t, i) {
      return '<div class="tab' + (i === tab ? ' sel' : '') + (area === 'tabs' && i === tabFocus ? ' focus' : '') + '">' + esc(t) + '</div>';
    }).join('');
  }

  function cardHtml(it) {
    if (it.kind === 'letter') return '<div class="letter">' + esc(it.title) + '</div>';
    if (it.kind === 'fav') {
      var on = isFav(it.id);
      return '<div class="card act"><div class="img"><div class="big">' + (on ? '★' : '☆') + '</div></div>' +
        '<div class="t">' + (on ? 'Als meus programes' : 'Afegeix als meus programes') + '</div>' +
        '<div class="s">' + (on ? 'OK per treure-ho' : 'Sortirà a la pestanya Inici') + '</div></div>';
    }
    var live = it.kind === 'live';
    return '<div class="card' + (live ? ' live' : '') + '"><div class="img" data-img="' + esc(it.img || '') + '">' +
      (live ? '<div class="badge">EN DIRECTE</div>' : '') +
      (it.dur ? '<div class="dur">' + esc(it.dur) + '</div>' : '') +
      (it.prog ? '<div class="prog"><div style="width:' + Math.round(it.prog * 100) + '%"></div></div>' : '') + '</div>' +
      '<div class="t">' + esc(it.title) + '</div><div class="s">' + esc(it.sub || '') + '</div></div>';
  }

  function renderGrid() {
    var v = view(), h = '';
    v.rows.forEach(function (row) {
      if (row.header) h += '<div class="lhead">' + esc(row.header) + '</div>';
      h += '<div style="clear:both"></div>' + row.map(cardHtml).join('');
    });
    $('grid').innerHTML = h + '<div style="clear:both"></div>';
    // map DOM nodes back to items
    var nodes = $('grid').querySelectorAll('.card, .letter'), n = 0;
    v.rows.forEach(function (row) { row.forEach(function (it) { it.el = nodes[n++]; }); });
    $('sub').textContent = v.title || '';
    updateFocus();
  }

  function appendRows(rows) {
    var v = view();
    var last = v.rows[v.rows.length - 1];
    // fill up an incomplete last row first
    var flat = [];
    rows.forEach(function (r) { flat = flat.concat(r); });
    while (last && last.length < COLS && flat.length && last[0].kind !== 'letter') last.push(flat.shift());
    v.rows = v.rows.concat(chunk(flat));
    var f = v.focus; renderGrid(); v.focus = f; updateFocus();
  }

  function chunk(items) { var r = []; for (var i = 0; i < items.length; i += COLS) r.push(items.slice(i, i + COLS)); return r; }

  function focusedItem() { var v = view(); var row = v.rows[v.focus.r]; return row ? row[v.focus.c] : null; }

  function updateFocus() {
    var v = view(), prev = $('grid').querySelectorAll('.focus');
    for (var i = 0; i < prev.length; i++) prev[i].className = prev[i].className.replace(' focus', '');
    $('q').className = area === 'search' ? 'focus' : '';
    renderTabs();
    var it = focusedItem();
    if (area === 'grid' && it && it.el) {
      it.el.className += ' focus';
      var top = it.el.offsetTop, row = v.rows[v.focus.r];
      if (row && row.header) top -= 70;   // keep the letter heading visible
      $('grid').style.top = (-Math.max(0, top - 40)) + 'px';
    } else if (area !== 'grid') {
      $('grid').style.top = '0px';
    }
    lazyImages();
    if (area === 'grid' && v.more && v.focus.r >= v.rows.length - 2) { var m = v.more; v.more = null; m(); }
  }

  function lazyImages() {
    var g = $('grid'), off = -parseInt(g.style.top || '0', 10);
    var imgs = g.querySelectorAll('.img[data-img]');
    for (var i = 0; i < imgs.length; i++) {
      var el = imgs[i], url = el.getAttribute('data-img'), y = el.parentNode.offsetTop;
      if (url && y > off - 400 && y < off + 1400) {
        el.style.backgroundImage = 'url("' + url + '")';
        el.removeAttribute('data-img');
      }
    }
  }

  function pushView(v) { v.focus = v.focus || { r: 0, c: 0 }; stack.push(v); renderGrid(); }
  function setRoot(v) { stack = []; pushView(v); }

  /* ---------- tabs ---------- */
  function openTab(i) {
    tab = i; tabFocus = i; msg('');
    document.body.className = i === SEARCH ? 'search-on' : '';
    $('search').className = i === SEARCH ? 'search' : 'search hidden';
    if (i === HOME) showHome();
    else if (i === LIVE) showLive();
    else if (i === LATEST) showLatest();
    else if (i === PROGRAMS) showPrograms();
    else showSearch();
    renderTabs();
  }

  function homeRows() {
    var rows = [], cw = load('cw', []), favs = load('favs', []);
    if (cw.length) {
      var c = chunk(cw.map(function (e) {
        return { kind: 'video', id: e.id, title: e.title, img: e.img, sub: e.sub, dur: e.dur,
                 prog: e.len ? e.pos / e.len : 0 };
      }));
      c[0].header = 'Continuar veient';
      rows = rows.concat(c);
    }
    if (favs.length) {
      var f = chunk(favs.map(function (p) { return { kind: 'prog', id: p[0], title: p[1], img: p[2] }; }));
      f[0].header = 'Els meus programes';
      rows = rows.concat(f);
    }
    return rows;
  }

  function showHome() {
    var rows = homeRows();
    setRoot({ title: '', rows: rows, home: true });
    if (!rows.length) msg('Aquí sortiran els vídeos que deixis a mitges i els programes que marquis amb ☆');
  }

  function showLive() {
    var items = CHANNELS.map(function (ch) {
      return { kind: 'live', id: ch.id, title: ch.name, img: ch.logo, sub: 'Carregant…' };
    });
    setRoot({ title: 'Canals en directe', rows: chunk(items) });
    items.forEach(function (it) {
      getJSON(MEDIA + it.id, function (err, d) {
        if (err || !d || !d.informacio) { it.sub = 'No disponible'; }
        else {
          var a = d.informacio.arafem;
          it.sub = a ? 'Ara: ' + (a.titol_complet || a.programa) : '';
          it.media = d;
        }
        if (it.el) it.el.querySelector('.s').textContent = it.sub;
      });
    });
  }

  function videoList(title, params, prefix) {
    var page = 0, v = { title: title, rows: prefix ? [prefix] : [] };
    function load() {
      page++;
      if (page === 1) msg('Carregant…');
      getJSON(API + 'videos?_format=json&version=2.0&items_pagina=' + PAGE + '&tipus_contingut=PPD&ordre=-data_publicacio&pagina=' +
              page + params, function (err, d) {
        if (view() !== v) return;
        if (err) { msg('Error de connexió (' + err + ')'); return; }
        var r = d.resposta, items = (r.items && r.items.item) || [];
        msg(page === 1 && !items.length ? 'No hi ha vídeos disponibles' : '');
        if (page === 1) { v.rows = (prefix ? [prefix] : []).concat(chunk(items.map(videoCard))); renderGrid(); }
        else appendRows([items.map(videoCard)]);
        var p = r.paginacio || {};
        v.more = p.pagina_actual < p.total_pagines ? load : null;
      });
    }
    v.more = null;
    return { v: v, load: load };
  }

  function showLatest() {
    var l = videoList('Últims capítols publicats', '');
    setRoot(l.v); l.load();
  }

  function openProgram(it) {
    var l = videoList(it.title, '&programatv_id=' + it.id, [{ kind: 'fav', id: it.id, title: it.title, img: it.img }]);
    pushView(l.v); area = 'grid'; l.load();
  }

  function showPrograms() {
    setRoot({ title: 'Programes de la A a la Z', rows: [] });
    msg('Carregant programes…');
    loadPrograms(function (err) {
      if (err) { msg('Error de connexió (' + err + ')'); return; }
      msg('');
      var v = view(), letters = [], rows = [], groups = {}, order = [];
      programs.forEach(function (p) {
        var L = p[3]; if (!groups[L]) { groups[L] = []; order.push(L); }
        groups[L].push(progCard(p));
      });
      order.forEach(function (L) { letters.push({ kind: 'letter', title: L }); });
      rows.push(letters);
      order.forEach(function (L) {
        var ch = chunk(groups[L]);
        ch[0].header = L;
        letters[order.indexOf(L)].target = rows.length;
        rows = rows.concat(ch);
      });
      v.rows = rows;
      renderGrid();
    });
  }

  function showSearch() {
    setRoot({ title: 'Escriu per cercar entre els programes', rows: [] });
    loadPrograms(function () { doSearch(); });
  }
  function doSearch() {
    if (!programs) return;
    var q = norm($('q').value).trim(), v = view();
    if (!q) { v.rows = []; renderGrid(); msg('Prem OK per escriure'); return; }
    var words = q.split(/\s+/);
    var res = programs.filter(function (p) {
      var t = norm(p[1]);
      return words.every(function (w) { return t.indexOf(w) >= 0; });
    }).slice(0, 80);
    msg(res.length ? '' : 'Cap programa coincideix amb «' + $('q').value + '»');
    v.rows = chunk(res.map(progCard)); v.focus = { r: 0, c: 0 };
    v.title = res.length + (res.length === 1 ? ' programa' : ' programes');
    renderGrid();
  }
  $('q').addEventListener('input', doSearch);

  /* ---------- player ---------- */
  var video = $('video'), playing = null, osdTimer, sources = [], srcIdx = 0;

  function fmtT(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60);
  }

  function showOsd() {
    $('osd').className = 'osd';
    clearTimeout(osdTimer);
    osdTimer = setTimeout(function () { if (!video.paused) $('osd').className = 'osd off'; }, 4000);
    updOsd();
  }
  function updOsd() {
    if (!playing) return;
    if (playing.live) {
      var a = playing.arafem, now = Date.now();
      if (a && a.data_emissio && a.data_caducitat) {
        var s = Date.parse(a.data_emissio.utc), e = Date.parse(a.data_caducitat.utc);
        $('osdFill').style.width = Math.min(100, Math.max(0, (now - s) / (e - s) * 100)) + '%';
        $('osdTime').textContent = a.data_emissio.text.substr(11, 5);
        $('osdDur').textContent = a.data_caducitat.text.substr(11, 5);
      }
    } else {
      var d = video.duration || 0;
      $('osdFill').style.width = (d ? video.currentTime / d * 100 : 0) + '%';
      $('osdTime').textContent = fmtT(video.currentTime);
      $('osdDur').textContent = d ? fmtT(d) : '';
    }
    $('osdState').textContent = video.paused ? '❚❚ En pausa' : '';
  }
  setInterval(function () { if (playing) updOsd(); }, 1000);

  function startPlayer(info) {
    playing = info; sources = info.sources; srcIdx = 0;
    subTracks = []; subIdx = -1; subs = []; showSub('');
    $('player').className = 'player';
    $('osdTitle').textContent = info.title;
    $('osdSub').textContent = info.sub || '';
    $('spinner').textContent = 'Carregant…';
    $('spinner').className = 'spinner';
    loadSource();
    showOsd();
  }
  function loadSource() {
    var s = sources[srcIdx];
    video.src = s.url;
    video.load();
    video.play();
  }
  video.addEventListener('playing', function () {
    $('spinner').className = 'spinner hidden';
    if (playing && playing.resume) { video.currentTime = playing.resume; playing.resume = 0; }
    showOsd();
  });
  video.addEventListener('waiting', function () { $('spinner').className = 'spinner'; });
  video.addEventListener('error', function () {
    if (!playing) return;
    if (++srcIdx < sources.length) return loadSource();
    $('spinner').textContent = 'No s\'ha pogut reproduir aquest vídeo';
    $('spinner').className = 'spinner';
  });
  video.addEventListener('ended', function () { savePos(true); closePlayer(); });

  // Remember where a video was left (for "Continuar veient"); finished or barely started videos are dropped.
  function savePos(done) {
    if (!playing || playing.live) return;
    var p = playing, t = Math.floor(video.currentTime), len = Math.floor(video.duration || 0);
    var finished = done || (len && t > len * 0.95);
    cwPut({ id: p.id, title: p.title, img: p.img, sub: p.sub, dur: p.dur, len: len,
            pos: finished || t < 30 ? 0 : t });
  }
  function closePlayer() {
    savePos(false);
    playing = null; subs = []; showSub('');
    video.pause(); video.removeAttribute('src'); video.load();
    $('player').className = 'player hidden';
    if (view() && view().home) showHome();   // refresh "Continuar veient"
  }

  /* ---------- subtitles (WebVTT, rendered by us: bigger and styled for TV) ---------- */
  var subs = [], subTracks = [], subIdx = -1, subShown = '';
  var SUB_COLORS = { white: '#fff', yellow: '#ffe14d', cyan: '#5ff0ff', green: '#6dff6d', magenta: '#ff7dff',
                     red: '#ff6b6b', blue: '#7fa8ff' };

  function vttTime(s) {
    var m = /(?:(\d+):)?(\d+):(\d+)[.,](\d+)/.exec(s); if (!m) return 0;
    return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
  }
  function vttText(lines) {
    return lines.map(function (l) {
      var out = '', re = /<c\.([a-zA-Z0-9_.-]+)>([\s\S]*?)<\/c>|<[^>]+>|([^<]+)/g, m;
      while ((m = re.exec(l))) {
        if (m[1]) {
          var color = null;
          m[1].split('.').forEach(function (c) { if (SUB_COLORS[c]) color = SUB_COLORS[c]; });
          var txt = esc(m[2].replace(/<[^>]+>/g, '')).replace(/#/g, '♪');
          out += color && color !== '#fff' ? '<span style="color:' + color + '">' + txt + '</span>' : txt;
        } else if (m[3]) out += esc(m[3]).replace(/#/g, '♪');
      }
      return out;
    }).join('<br>');
  }
  function parseVtt(txt) {
    var cues = [];
    txt.replace(/\r/g, '').split(/\n\n+/).forEach(function (block) {
      var lines = block.split('\n'), i = 0;
      while (i < lines.length && lines[i].indexOf('-->') < 0) i++;
      if (i >= lines.length) return;
      var t = lines[i].split('-->');
      var text = vttText(lines.slice(i + 1).filter(function (l) { return l.trim(); }));
      if (text.trim()) cues.push({ a: vttTime(t[0]), b: vttTime(t[1]), h: text });
    });
    return cues;
  }
  function showSub(h) {
    if (h === subShown) return;
    subShown = h;
    $('subs').innerHTML = h ? '<span>' + h + '</span>' : '';
  }
  video.addEventListener('timeupdate', function () {
    if (!subs.length) return;
    var t = video.currentTime, h = '';
    for (var i = 0; i < subs.length; i++) {
      if (subs[i].a <= t && t < subs[i].b) { h += (h ? '<br>' : '') + subs[i].h; }
      else if (subs[i].a > t) break;
    }
    showSub(h);
  });

  function toast(t) {
    var el = $('toast'); el.textContent = t; el.className = 'toast';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.className = 'toast hidden'; }, 2500);
  }

  function selectSub(i, announce) {
    subIdx = i; subs = []; showSub('');
    var tr = subTracks[i];
    save('subLang', tr ? tr.iso : 'off');
    if (announce) toast(tr ? 'Subtítols: ' + tr.text : (subTracks.length ? 'Subtítols desactivats' : 'Aquest vídeo no té subtítols'));
    if (!tr) return;
    var want = playing;
    getText(tr.url, function (err, txt) {
      if (playing !== want || subIdx !== i) return;
      if (err) return toast('No s\'han pogut carregar els subtítols');
      subs = parseVtt(txt);
    });
  }
  function cycleSub() {
    if (!subTracks.length) return toast('Aquest vídeo no té subtítols');
    selectSub(subIdx + 1 < subTracks.length ? subIdx + 1 : -1, true);
  }

  function playLive(it) {
    function go(d) {
      var media = d.media || [], order = ['CATALUNYA', 'ESPANYA', 'TOTS'], src = [];
      if (!(media instanceof Array)) media = media.url || [];
      order.forEach(function (g) { media.forEach(function (m) { if (m.geo === g && m.url) src.push({ url: m.url }); }); });
      media.forEach(function (m) { if (order.indexOf(m.geo) < 0 && (m.url || m.file)) src.push({ url: m.url || m.file }); });
      if (!src.length) { msg('Aquest canal no està disponible ara'); return; }
      var a = d.informacio.arafem;
      startPlayer({ live: true, title: it.title + ' · en directe', sub: a ? (a.titol_complet || a.programa) : '',
                    arafem: a, sources: src });
    }
    if (it.media) return go(it.media);
    getJSON(MEDIA + it.id, function (err, d) { if (err) return msg('Error de connexió'); go(d); });
  }

  function playVideo(it) {
    msg('Carregant vídeo…');
    getJSON(MEDIA + it.id, function (err, d) {
      msg('');
      if (err || !d || !d.media) return msg('No s\'ha pogut obtenir el vídeo');
      var urls = d.media.url || [], src = [];
      ['720p', '480p', '360p'].forEach(function (q) {
        urls.forEach(function (u) { if (u.label === q && u.file) src.push({ url: u.file }); });
      });
      urls.forEach(function (u) { if (/\.mp4/.test(u.file) && !src.some(function (s) { return s.url === u.file; })) src.push({ url: u.file }); });
      if (!src.length) return msg('Aquest vídeo només està en un format que aquesta TV no pot reproduir');
      var cw = cwGet(it.id);
      startPlayer({ id: it.id, title: it.title, sub: it.sub, img: it.img, dur: it.dur, sources: src,
                    resume: cw ? cw.pos : 0 });
      subTracks = (d.subtitols || []).filter(function (s) { return s.url && (!s.format || s.format === 'vtt'); });
      var pref = load('subLang', 'off'), idx = -1;
      subTracks.forEach(function (s, i) { if (s.iso === pref && idx < 0) idx = i; });
      selectSub(idx, false);
      if (subTracks.length) toast(idx >= 0 ? 'Subtítols: ' + subTracks[idx].text + ' (▲ per canviar)' : 'Té subtítols: prem ▲ per activar-los');
    });
  }

  /* ---------- keys ---------- */
  var lastKey = 0, lastTime = 0, rep = 0;

  function back() {
    if (playing) return closePlayer();
    if (area === 'search') { $('q').blur(); area = 'tabs'; return updateFocus(); }
    if (stack.length > 1) { stack.pop(); renderGrid(); return; }
    if (area === 'grid') { area = 'tabs'; return updateFocus(); }
    window.close();  // PalmSystem.platformBack() is a no-op on this webOS 3 build
  }

  function playerKey(k) {
    var big = rep > 3;
    switch (k) {
      case 13: case 415: case 19:
        if (k === 415 || (k === 13 && video.paused)) video.play(); else video.pause();
        break;
      case 37: case 412: if (!playing.live) video.currentTime = Math.max(0, video.currentTime - (big || k === 412 ? 60 : 10)); break;
      case 39: case 417: if (!playing.live) video.currentTime = Math.min(video.duration - 1, video.currentTime + (big || k === 417 ? 60 : 10)); break;
      case 413: closePlayer(); return;
      case 38: if (!playing.live) cycleSub(); break;
      case 40: break;
      default: return false;
    }
    showOsd();
    return true;
  }

  function gridKey(k) {
    var v = view(), f = v.focus, row = v.rows[f.r];
    switch (k) {
      case 37: if (f.c > 0) f.c--; break;
      case 39: if (row && f.c < row.length - 1) f.c++; break;
      case 38:
        if (f.r === 0) { area = tab === SEARCH ? 'search' : 'tabs'; break; }
        f.r--; f.c = Math.min(f.c, v.rows[f.r].length - 1);
        if (v.rows[f.r][0].kind === 'letter') f.c = 0;
        break;
      case 40:
        if (f.r < v.rows.length - 1) { var wasLetter = row[0].kind === 'letter'; f.r++; f.c = wasLetter ? 0 : Math.min(f.c, v.rows[f.r].length - 1); }
        break;
      case 13:
        var it = focusedItem(); if (!it) return true;
        if (it.kind === 'letter') { f.r = it.target; f.c = 0; }
        else if (it.kind === 'live') return playLive(it), true;
        else if (it.kind === 'video') return playVideo(it), true;
        else if (it.kind === 'prog') return openProgram(it), true;
        else if (it.kind === 'fav') {
          toast(toggleFav(it.id, it.title, it.img) ? 'Afegit als meus programes' : 'Tret dels meus programes');
          var keep = v.focus; renderGrid(); v.focus = keep; updateFocus(); return true;
        }
        break;
      default: return false;
    }
    updateFocus();
    return true;
  }

  document.addEventListener('keydown', function (ev) {
    var k = ev.keyCode, now = Date.now();
    rep = (k === lastKey && now - lastTime < 250) ? rep + 1 : 0;
    lastKey = k; lastTime = now;

    if (k === 461 || k === 27 || (k === 8 && area !== 'search')) { back(); ev.preventDefault(); return; }
    if (playing) { if (playerKey(k)) ev.preventDefault(); return; }

    if (area === 'search') {
      if (k === 40) { $('q').blur(); if (view().rows.length) area = 'grid'; updateFocus(); ev.preventDefault(); }
      else if (k === 38) { $('q').blur(); area = 'tabs'; updateFocus(); ev.preventDefault(); }
      else if (k === 13) { $('q').focus(); }
      return;
    }
    if (area === 'tabs') {
      if (k === 37) tabFocus = Math.max(0, tabFocus - 1);
      else if (k === 39) tabFocus = Math.min(TABS.length - 1, tabFocus + 1);
      else if (k === 13) { if (tabFocus !== tab) openTab(tabFocus); else if (tab === SEARCH) area = 'search'; else if (view().rows.length) area = 'grid'; }
      else if (k === 40) {
        if (tabFocus !== tab) openTab(tabFocus);
        if (tab === SEARCH) area = 'search';
        else if (view().rows.length) area = 'grid';
      } else return;
      updateFocus(); ev.preventDefault(); return;
    }
    if (gridKey(k)) ev.preventDefault();
  });

  document.addEventListener('webkitvisibilitychange', function () {
    if (document.webkitHidden && playing) { savePos(false); video.pause(); }
  });

  function tick() { var d = new Date(); $('clock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  setInterval(tick, 10000); tick();

  openTab(homeRows().length ? HOME : LIVE);
})();
