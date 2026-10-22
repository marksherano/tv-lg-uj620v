/* Jellyfin Lite — light Jellyfin client for old LG webOS TVs (Chromium 38: ES5 only).
   Same view/grid/focus model as 3Cat Lite: a stack of views, each a list of rows of items. */
(function () {
  'use strict';

  var VERSION = '1.0.3';
  var PAGE = 48;
  var FIELDS = 'Overview,Genres,PrimaryImageAspectRatio';
  var SKIP_LIBS = { music: 1, books: 1, playlists: 1, livetv: 1, photos: 1 };
  var LIB_TYPES = { movies: 'Movie', tvshows: 'Series', boxsets: 'BoxSet', homevideos: 'Video', musicvideos: 'MusicVideo' };
  var BITRATES = [{ t: 'Original', v: 120000000 }, { t: '20 Mbps', v: 20000000 }, { t: '10 Mbps', v: 10000000 }, { t: '4 Mbps', v: 4000000 }];
  var SORTS = [
    { t: 'A–Z', p: { SortBy: 'SortName', SortOrder: 'Ascending' } },
    { t: 'Novetats', p: { SortBy: 'DateCreated,SortName', SortOrder: 'Descending' } },
    { t: 'No vistos', p: { SortBy: 'SortName', SortOrder: 'Ascending', Filters: 'IsUnplayed' } },
    { t: 'Any', p: { SortBy: 'ProductionYear,SortName', SortOrder: 'Descending' } },
    { t: 'Aleatori', p: { SortBy: 'Random' } }
  ];

  function $(id) { return document.getElementById(id); }
  function load(key, def) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function qs(o) {
    return Object.keys(o).filter(function (k) { return o[k] != null && o[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&');
  }
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  /* ---------- session and API ---------- */
  var S = load('jf', {});            // { server, token, userId, userName }
  var DEV = load('jfdev', '');
  if (!DEV) { DEV = 'jflite-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); save('jfdev', DEV); }

  function authHeader() {
    return 'MediaBrowser Client="Jellyfin Lite", Device="LG webOS TV", DeviceId="' + DEV + '", Version="' + VERSION + '"' +
      (S.token ? ', Token="' + S.token + '"' : '');
  }
  function api(method, path, body, cb, server) {
    var x = new XMLHttpRequest();
    x.open(method, (server || S.server) + path, true);
    x.timeout = 25000;
    x.setRequestHeader('Authorization', authHeader());
    if (body) x.setRequestHeader('Content-Type', 'application/json');
    x.onload = function () {
      if (x.status === 401 && S.token && !server) return logout('La sessió ha caducat: torna a entrar');
      if (x.status < 200 || x.status >= 300) return cb && cb('HTTP ' + x.status);
      var j = null;
      if (x.responseText) { try { j = JSON.parse(x.responseText); } catch (e) { return cb && cb('resposta invàlida'); } }
      if (cb) cb(null, j);
    };
    x.onerror = function () { if (cb) cb('sense connexió amb el servidor'); };
    x.ontimeout = function () { if (cb) cb('el servidor no respon'); };
    x.send(body ? JSON.stringify(body) : null);
  }
  function get(path, cb) { api('GET', path, null, cb); }

  /* ---------- item helpers ---------- */
  function img(id, type, tag, w) {
    return tag ? S.server + '/Items/' + id + '/Images/' + type + '?' + qs({ fillWidth: w, quality: 85, tag: tag }) : '';
  }
  function wideImg(it, w) {
    var t = it.ImageTags || {};
    w = w || 410;
    if (it.Type === 'Episode' && t.Primary) return img(it.Id, 'Primary', t.Primary, w);
    if (t.Thumb) return img(it.Id, 'Thumb', t.Thumb, w);
    if (it.BackdropImageTags && it.BackdropImageTags.length) return img(it.Id, 'Backdrop', it.BackdropImageTags[0], w);
    if (it.ParentThumbItemId && it.ParentThumbImageTag) return img(it.ParentThumbItemId, 'Thumb', it.ParentThumbImageTag, w);
    if (it.ParentBackdropItemId && it.ParentBackdropImageTags && it.ParentBackdropImageTags.length) {
      return img(it.ParentBackdropItemId, 'Backdrop', it.ParentBackdropImageTags[0], w);
    }
    return t.Primary ? img(it.Id, 'Primary', t.Primary, w) : '';
  }
  function posterImg(it) {
    var t = it.ImageTags || {};
    if (t.Primary) return img(it.Id, 'Primary', t.Primary, 262);
    if (it.SeriesId && it.SeriesPrimaryImageTag) return img(it.SeriesId, 'Primary', it.SeriesPrimaryImageTag, 262);
    return '';
  }
  function runtime(ticks) {
    var m = Math.round((ticks || 0) / 600000000);
    return !m ? '' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + pad(m % 60);
  }
  function epCode(it) {
    return (it.ParentIndexNumber != null ? 'T' + it.ParentIndexNumber : '') +
      (it.IndexNumber != null ? (it.ParentIndexNumber != null ? ' · ' : '') + 'E' + it.IndexNumber : '');
  }
  var WIDE = { Episode: 1, Video: 1, CollectionFolder: 1, UserView: 1, MusicVideo: 1, TvChannel: 1 };

  // a grid card for a Jellyfin item; title/sub can be overridden by the list that shows it
  function card(it, o) {
    o = o || {};
    var ud = it.UserData || {};
    var shape = o.shape || (WIDE[it.Type] ? 'wide' : 'poster');
    var title = o.title, sub = o.sub;
    if (title == null) title = it.Type === 'Episode' && it.SeriesName && o.series !== false ? it.SeriesName : it.Name;
    if (sub == null) {
      if (it.Type === 'Episode') sub = o.series === false ? runtime(it.RunTimeTicks) : epCode(it) + ' · ' + it.Name;
      else if (it.Type === 'Series') sub = it.ProductionYear ? String(it.ProductionYear) : '';
      else sub = [it.ProductionYear, runtime(it.RunTimeTicks)].filter(Boolean).join(' · ');
    }
    return { kind: 'item', it: it, shape: shape, title: title, sub: sub,
             img: shape === 'wide' ? wideImg(it) : posterImg(it),
             prog: ud.PlaybackPositionTicks && it.RunTimeTicks ? ud.PlaybackPositionTicks / it.RunTimeTicks : 0,
             seen: ud.Played && !it.IsFolder, count: it.Type === 'Series' ? ud.UnplayedItemCount : 0 };
  }

  /* ---------- views ----------
     A view = { title, detail: html|null, rows: [[item...]...], focus: {r, c}, more: fn|null, reload: fn|null } */
  var stack = [], tabs = [], libs = [];
  var area = 'tabs';     // 'tabs' | 'grid' | 'search'
  var tab = 0, tabFocus = 0;
  function view() { return stack[stack.length - 1]; }
  function msg(t) { $('msg').textContent = t || ''; }

  function toast(t) {
    var el = $('toast'); el.textContent = t; el.className = 'toast';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.className = 'toast hidden'; }, 2600);
  }

  function renderTabs() {
    $('tabs').innerHTML = tabs.map(function (t, i) {
      return '<div class="tab' + (i === tab ? ' sel' : '') + (area === 'tabs' && i === tabFocus ? ' focus' : '') + '">' + esc(t.name) + '</div>';
    }).join('');
  }

  function cardHtml(it) {
    if (it.kind === 'chip') {
      return '<div class="chip' + (it.sel ? ' sel' : '') + (it.big ? ' play' : '') + '">' + esc(it.title) + '</div>';
    }
    return '<div class="card ' + it.shape + '"><div class="img" data-img="' + esc(it.img || '') + '">' +
      (it.img ? '' : '<div class="noimg">' + esc(it.title) + '</div>') +
      (it.seen ? '<div class="seen">✓</div>' : '') +
      (it.count ? '<div class="cnt">' + it.count + '</div>' : '') +
      (it.prog ? '<div class="prog"><div style="width:' + Math.round(it.prog * 100) + '%"></div></div>' : '') + '</div>' +
      '<div class="t">' + esc(it.title) + '</div><div class="s">' + esc(it.sub || '') + '</div></div>';
  }

  function renderGrid() {
    var v = view(), h = v.detail || '';
    v.rows.forEach(function (row) {
      if (row.header) h += '<div class="lhead">' + esc(row.header) + '</div>';
      h += '<div style="clear:both"></div>' + row.map(cardHtml).join('');
    });
    $('grid').innerHTML = h + '<div style="clear:both"></div>';
    var nodes = $('grid').querySelectorAll('.card, .chip'), n = 0;
    v.rows.forEach(function (row) { row.forEach(function (it) { it.el = nodes[n++]; }); });
    $('sub').textContent = v.title || '';
    // the search box belongs to the search results only, not to what is opened from them
    var searching = tabs[tab] && tabs[tab].search && stack.length === 1;
    document.body.className = searching ? 'search-on' : '';
    $('search').className = searching ? 'search' : 'search hidden';
    if (v.focus.r >= v.rows.length) v.focus = { r: Math.max(0, v.rows.length - 1), c: 0 };
    updateFocus();
  }

  // cards in rows: 4 wide (16:9) or 6 posters per row
  function chunk(items, cols) {
    var r = [];
    for (var i = 0; i < items.length; i += cols) r.push(items.slice(i, i + cols));
    return r;
  }
  function cardRows(cards, header) {
    var rows = [], i = 0;
    while (i < cards.length) {
      var shape = cards[i].shape, j = i;
      while (j < cards.length && cards[j].shape === shape) j++;
      rows = rows.concat(chunk(cards.slice(i, j), shape === 'wide' ? 4 : 6));
      i = j;
    }
    if (rows.length && header) rows[0].header = header;
    return rows;
  }
  function appendCards(cards) {
    var v = view(), last = v.rows[v.rows.length - 1];
    var cols = last && last[0].shape === 'wide' ? 4 : 6;
    while (last && last[0].kind === 'item' && last.length < cols && cards.length && cards[0].shape === last[0].shape) last.push(cards.shift());
    v.rows = v.rows.concat(cardRows(cards));
    var f = v.focus; renderGrid(); v.focus = f; updateFocus();
  }

  function focusedItem() { var v = view(), row = v.rows[v.focus.r]; return row ? row[v.focus.c] : null; }

  // index of the item in row closest (horizontally) to element el
  function nearest(row, el) {
    var x = el ? el.offsetLeft + el.offsetWidth / 2 : 0, best = 0, bd = 1e9;
    row.forEach(function (it, i) {
      if (!it.el) return;
      var d = Math.abs(it.el.offsetLeft + it.el.offsetWidth / 2 - x);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  var VIEW_H = 900;
  function updateFocus() {
    var v = view(), prev = $('grid').querySelectorAll('.focus');
    for (var i = 0; i < prev.length; i++) prev[i].className = prev[i].className.replace(' focus', '');
    $('q').className = area === 'search' ? 'focus' : '';
    renderTabs();
    var it = focusedItem(), g = $('grid'), top = -parseInt(g.style.top || '0', 10);
    if (area === 'grid' && it && it.el) {
      it.el.className += ' focus';
      var y = it.el.offsetTop, hgt = it.el.offsetHeight, row = v.rows[v.focus.r];
      var head = row && row.header ? 70 : 0;
      if (v.focus.r === 0 && !v.detail) top = 0;
      else if (y - head - 20 < top) top = Math.max(0, y - head - 40);
      else if (y + hgt + 20 > top + VIEW_H) top = y + hgt + 40 - VIEW_H;
      if (v.focus.r === 0) top = 0;
    } else top = 0;
    g.style.top = (-top) + 'px';
    lazyImages();
    if (area === 'grid' && v.more && v.focus.r >= v.rows.length - 2) { var m = v.more; v.more = null; m(); }
  }

  function lazyImages() {
    var g = $('grid'), off = -parseInt(g.style.top || '0', 10);
    var imgs = g.querySelectorAll('.img[data-img]');
    for (var i = 0; i < imgs.length; i++) {
      var el = imgs[i], url = el.getAttribute('data-img'), y = el.parentNode.offsetTop;
      if (y > off - 500 && y < off + 1500) {
        if (url) el.style.backgroundImage = 'url("' + url + '")';
        el.removeAttribute('data-img');
      }
    }
  }

  function pushView(v) { v.focus = v.focus || { r: 0, c: 0 }; stack.push(v); renderGrid(); }
  function setRoot(v) { stack = []; pushView(v); }
  function replaceView(v) { stack.pop(); pushView(v); }

  /* ---------- tabs ---------- */
  function buildTabs() {
    tabs = [{ name: 'Inici', show: showHome }];
    libs.forEach(function (l) { tabs.push({ name: l.Name, show: function () { var v = libraryView(l, 0); setRoot(v); v.load(); } }); });
    tabs.push({ name: 'Cerca', show: showSearch, search: true });
    tabs.push({ name: 'Ajustos', show: showSettings });
  }

  function openTab(i) {
    tab = i; tabFocus = i; msg('');
    tabs[i].show();
    renderTabs();
  }

  /* ---------- home ---------- */
  function showHome() {
    var v = { title: '', rows: [], home: true, reload: showHome };
    v.focus = stack.length && view().home ? view().focus : null;
    setRoot(v);
    var parts = [], pending = 0;
    function section(i, title, path, map) {
      pending++;
      get(path, function (err, d) {
        var items = err ? [] : (d.Items || d || []);
        parts[i] = cardRows(items.map(map), title);
        if (--pending) return;
        if (view() !== v) return;
        v.rows = [];
        parts.forEach(function (p) { if (p) v.rows = v.rows.concat(p); });
        msg(v.rows.length ? '' : (err ? 'No es pot connectar amb el servidor (' + err + ')' : 'La biblioteca és buida'));
        renderGrid();
      });
    }
    msg('Carregant…');
    section(0, 'Continuar veient', '/UserItems/Resume?' + qs({ userId: S.userId, Limit: 12, Fields: FIELDS, MediaTypes: 'Video' }),
      function (it) { return card(it, { shape: 'wide' }); });
    section(1, 'Següents capítols', '/Shows/NextUp?' + qs({ UserId: S.userId, Limit: 8, Fields: FIELDS }),
      function (it) { return card(it, { shape: 'wide' }); });
    libs.forEach(function (l, i) {
      if (l.CollectionType !== 'movies' && l.CollectionType !== 'tvshows') return;
      section(2 + i, 'Novetats a ' + l.Name, '/Items/Latest?' + qs({ UserId: S.userId, ParentId: l.Id, Limit: 6, Fields: FIELDS }),
        function (it) { return card(it); });
    });
  }

  /* ---------- libraries and folders ---------- */
  function libraryView(lib, sortIdx) {
    var type = LIB_TYPES[lib.CollectionType];
    var chips = SORTS.map(function (s, i) { return { kind: 'chip', act: 'sort', idx: i, title: s.t, sel: i === sortIdx }; });
    var v = { title: lib.Name, rows: [chips], lib: lib };
    var params = merge({ UserId: S.userId, ParentId: lib.Id, Fields: FIELDS, Limit: PAGE }, SORTS[sortIdx].p);
    if (type) { params.IncludeItemTypes = type; params.Recursive = true; }
    pager(v, params, function (total) { v.title = lib.Name + ' · ' + total + (total === 1 ? ' títol' : ' títols'); });
    return v;
  }

  // loads /Items page by page as the focus gets near the end
  function pager(v, params, onTotal) {
    var start = 0;
    function more() {
      if (!start) msg('Carregant…');
      get('/Items?' + qs(merge(params, { StartIndex: start })), function (err, d) {
        if (view() !== v) return;
        if (err) return msg('Error: ' + err);
        var items = d.Items || [];
        if (!start) {
          msg(items.length ? '' : 'Aquí no hi ha res');
          if (onTotal) onTotal(d.TotalRecordCount);
          v.rows = v.rows.slice(0, v.chips ? 1 : v.rows.length).concat(cardRows(items.map(function (it) { return card(it); })));
          renderGrid();
        } else appendCards(items.map(function (it) { return card(it); }));
        start += items.length;
        v.more = start < d.TotalRecordCount ? more : null;
      });
    }
    v.chips = v.rows.length > 0;
    v.load = more;
  }

  function openFolder(it) {
    var v = { title: it.Name, rows: [] };
    pager(v, { UserId: S.userId, ParentId: it.Id, Fields: FIELDS, Limit: PAGE, SortBy: 'SortName' });
    pushView(v); area = 'grid'; v.load();
  }

  /* ---------- series: seasons as chips, episodes below ---------- */
  function openSeries(series) {
    var v = { title: series.Name, rows: [], detail: detailHtml(series), series: series };
    v.reload = function () { stack.pop(); openSeries(series); };
    pushView(v); area = 'grid'; msg('Carregant capítols…');
    if (!series.Overview) {
      get('/Items/' + series.Id + '?' + qs({ userId: S.userId }), function (err, d) {
        if (!err && view() === v) { v.detail = detailHtml(d); renderGrid(); }
      });
    }
    get('/Shows/' + series.Id + '/Episodes?' + qs({ UserId: S.userId, Fields: 'Overview' }), function (err, d) {
      if (view() !== v) return;
      if (err) return msg('Error: ' + err);
      msg('');
      var eps = d.Items || [], seasons = [], byId = {};
      eps.forEach(function (e) {
        var k = e.SeasonId || 's' + e.ParentIndexNumber;
        if (!byId[k]) { byId[k] = { id: k, name: e.SeasonName || (e.ParentIndexNumber ? 'Temporada ' + e.ParentIndexNumber : 'Especials'), eps: [] }; seasons.push(byId[k]); }
        byId[k].eps.push(e);
      });
      if (!seasons.length) return msg('Aquesta sèrie no té capítols');
      var next = null;
      eps.forEach(function (e) { if (!next && !(e.UserData && e.UserData.Played)) next = e; });
      v.seasons = seasons;
      var si = 0;
      if (next) seasons.forEach(function (s, i) { if (s.eps.indexOf(next) >= 0) si = i; });
      showSeason(v, si, next);
    });
  }
  function showSeason(v, si, focusEp) {
    v.season = si;
    var chips = v.seasons.map(function (s, i) { return { kind: 'chip', act: 'season', idx: i, title: s.name, sel: i === si }; });
    var cards = v.seasons[si].eps.map(function (e) {
      return card(e, { shape: 'wide', series: false, title: (e.IndexNumber != null ? e.IndexNumber + '. ' : '') + e.Name });
    });
    v.rows = [chips].concat(cardRows(cards));
    if (focusEp) {
      var k = v.seasons[si].eps.indexOf(focusEp);
      v.focus = { r: 1 + Math.floor(k / 4), c: k % 4 };
    }
    renderGrid();
  }

  /* ---------- details (movies, episodes, videos) ---------- */
  function streamsSummary(it) {
    var ms = it.MediaSources && it.MediaSources[0], out = [];
    if (!ms) return '';
    var st = ms.MediaStreams || [];
    st.forEach(function (s) {
      if (s.Type === 'Video' && !out.length) out.push((s.Codec || '').toUpperCase() + (s.Height ? ' ' + s.Height + 'p' : ''));
    });
    var langs = function (type) {
      var l = [];
      st.forEach(function (s) { if (s.Type === type) { var n = s.Language && s.Language !== 'und' ? s.Language : ''; if (n && l.indexOf(n) < 0) l.push(n); } });
      return l.join(', ');
    };
    var a = langs('Audio'), su = langs('Subtitle');
    if (a) out.push('Àudio: ' + a);
    if (su) out.push('Subtítols: ' + su);
    return out.join(' · ');
  }
  function detailHtml(it) {
    var wide = it.Type !== 'Series' || (it.BackdropImageTags && it.BackdropImageTags.length);
    var im = wide ? wideImg(it, 640) : posterImg(it);
    var meta = [it.ProductionYear, runtime(it.RunTimeTicks),
      it.CommunityRating ? '★ ' + it.CommunityRating.toFixed(1) : '', it.OfficialRating,
      (it.Genres || []).slice(0, 3).join(', ')].filter(Boolean).join(' · ');
    return '<div class="detail"><div class="dimg' + (wide ? '' : ' poster') + '" style="background-image:url(&quot;' + esc(im) + '&quot;)"></div>' +
      '<div class="dt">' + (it.Type === 'Episode' ? '<div class="ser">' + esc(it.SeriesName + ' · ' + epCode(it)) + '</div>' : '') +
      '<h1>' + esc(it.Name) + '</h1><div class="meta">' + esc(meta) + '</div>' +
      '<div class="ov">' + esc(it.Overview || '') + '</div><div class="tech">' + esc(streamsSummary(it)) + '</div></div></div>';
  }

  function openDetail(item, replace) {
    var v = { title: item.Name, rows: [], detail: detailHtml(item) };
    v.reload = function () { openDetail(item, true); };
    if (replace) replaceView(v); else pushView(v);
    area = 'grid';
    get('/Items/' + item.Id + '?' + qs({ userId: S.userId }), function (err, it) {
      if (view() !== v) return;
      if (err) return msg('Error: ' + err);
      var ud = it.UserData || {}, pos = (ud.PlaybackPositionTicks || 0) / 1e7, chips = [];
      if (pos > 0) {
        chips.push({ kind: 'chip', act: 'play', pos: pos, big: true, title: '▶ Continua (' + fmtT(pos) + ')' });
        chips.push({ kind: 'chip', act: 'play', pos: 0, title: 'Des del principi' });
      } else chips.push({ kind: 'chip', act: 'play', pos: 0, big: true, title: '▶ Reprodueix' });
      chips.push({ kind: 'chip', act: 'played', played: ud.Played, title: ud.Played ? 'Marca com a no vist' : '✓ Marca com a vist' });
      if (it.Type === 'Episode' && it.SeriesId) chips.push({ kind: 'chip', act: 'series', title: 'Tots els capítols' });
      chips.forEach(function (c) { c.it = it; });
      v.detail = detailHtml(it);
      v.rows = [chips];
      renderGrid();
    });
  }

  function setPlayed(it, played) {
    api(played ? 'POST' : 'DELETE', '/UserPlayedItems/' + it.Id + '?' + qs({ userId: S.userId }), null, function (err) {
      if (err) return toast('No s\'ha pogut desar (' + err + ')');
      toast(played ? 'Marcat com a vist' : 'Marcat com a no vist');
      if (view().reload) view().reload();
    });
  }

  function openItem(it) {
    if (it.Type === 'Series') return openSeries(it);
    if (it.Type === 'Season') return openSeries({ Id: it.SeriesId, Name: it.SeriesName });
    if (it.Type === 'CollectionFolder' || it.Type === 'UserView') {
      var v = libraryView(it, 0); pushView(v); area = 'grid'; return v.load();
    }
    if (it.IsFolder) return openFolder(it);
    openDetail(it);
  }

  /* ---------- search ---------- */
  var searchTimer;
  function showSearch() {
    setRoot({ title: 'Escriu per cercar (amb el teclat de la TV o el del mòbil)', rows: [] });
    doSearch();
  }
  function doSearch() {
    var q = $('q').value.trim(), v = view();
    if (!q) { v.rows = []; renderGrid(); msg('Prem OK per escriure'); return; }
    msg('Cercant…');
    get('/Items?' + qs({ UserId: S.userId, searchTerm: q, IncludeItemTypes: 'Movie,Series,Episode,BoxSet,Video',
      Recursive: true, Limit: 60, Fields: FIELDS }), function (err, d) {
      if (view() !== v || $('q').value.trim() !== q) return;
      if (err) return msg('Error: ' + err);
      var items = d.Items || [], groups = [['Pel·lícules', ['Movie', 'BoxSet', 'Video']], ['Sèries', ['Series']], ['Capítols', ['Episode']]];
      v.rows = [];
      groups.forEach(function (g) {
        var c = items.filter(function (it) { return g[1].indexOf(it.Type) >= 0; }).map(function (it) { return card(it); });
        v.rows = v.rows.concat(cardRows(c, g[0]));
      });
      v.focus = { r: 0, c: 0 };
      v.title = items.length + (items.length === 1 ? ' resultat' : ' resultats');
      msg(items.length ? '' : 'No hi ha res que coincideixi amb «' + q + '»');
      renderGrid();
    });
  }
  $('q').addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(doSearch, 450); });

  /* ---------- settings ---------- */
  function showSettings() {
    var br = load('jfbr', BITRATES[0].v);
    var q = BITRATES.map(function (b) { return { kind: 'chip', act: 'bitrate', v: b.v, title: b.t, sel: b.v === br }; });
    q.header = 'Qualitat màxima (si la xarxa va justa, el servidor converteix el vídeo a menys qualitat)';
    var acc = [{ kind: 'chip', act: 'logout', title: 'Tanca la sessió' }];
    acc.header = 'Compte';
    setRoot({ title: 'Connectat a ' + S.server + ' com a ' + S.userName, rows: [q, acc] });
  }

  /* ---------- login ---------- */
  var setupIdx = 0, qcTimer = null;
  function setupEls() {
    return [].slice.call($('setup').querySelectorAll('.f')).filter(function (el) { return el.offsetParent !== null; });
  }
  function setupFocus() {
    var els = setupEls();
    setupIdx = Math.max(0, Math.min(setupIdx, els.length - 1));
    els.forEach(function (el, i) { el.className = el.className.replace(' focus', '') + (i === setupIdx ? ' focus' : ''); });
  }
  function smsg(t) { $('sMsg').textContent = t || ''; }
  function showSetup(m) {
    stopQc();
    $('browse').className = 'hidden';
    $('setup').className = 'setup';
    $('sServer').value = S.server || '';
    $('sCode').className = 'scode hidden';
    smsg(m);
    setupIdx = S.server ? 1 : 0;
    setupFocus();
  }
  function normServer(s) {
    s = s.trim().replace(/\/+$/, '').replace(/\/web(\/.*)?$/, '');
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
    if (/^http:\/\/[^\/:]+$/i.test(s)) s += ':8096';
    return s;
  }
  function checkServer(cb) {
    var srv = normServer($('sServer').value);
    if (!srv) { setupIdx = 0; setupFocus(); return smsg('Escriu l\'adreça del servidor Jellyfin'); }
    smsg('Connectant amb ' + srv + '…');
    api('GET', '/System/Info/Public', null, function (err, d) {
      if (err || !d || !d.Id) return smsg('No hi ha cap servidor Jellyfin a ' + srv + ' (' + (err || 'resposta estranya') + ')');
      smsg('');
      $('sServer').value = srv;
      if (!S.token) { S.server = srv; save('jf', S); }
      cb(srv, d);
    }, srv);
  }
  function stopQc() { clearInterval(qcTimer); qcTimer = null; }
  function quickConnect() {
    checkServer(function (srv, info) {
      api('POST', '/QuickConnect/Initiate', null, function (err, d) {
        if (err) return smsg(err === 'HTTP 401' ? 'Quick Connect està desactivat al servidor: entra amb usuari i contrasenya' : 'Error: ' + err);
        $('sPw').className = 'hidden';
        $('sCode').className = 'scode';
        $('sCode').innerHTML = 'Al mòbil o l\'ordinador, obre Jellyfin (' + esc(info.ServerName) + ') → el teu usuari → <b>Quick Connect</b> i escriu:' +
          '<div class="code">' + esc(d.Code) + '</div>Aquesta pantalla entrarà sola quan l\'autoritzis.';
        setupFocus();
        stopQc();
        qcTimer = setInterval(function () {
          api('GET', '/QuickConnect/Connect?' + qs({ secret: d.Secret }), null, function (e2, r) {
            if (e2 || !r || !r.Authenticated || !qcTimer) return;
            stopQc();
            api('POST', '/Users/AuthenticateWithQuickConnect', { Secret: d.Secret }, function (e3, a) {
              if (e3) return smsg('Error en entrar: ' + e3);
              loggedIn(srv, a);
            }, srv);
          }, srv);
        }, 3000);
      }, srv);
    });
  }
  function passwordLogin() {
    checkServer(function (srv) {
      var u = $('sUser').value.trim();
      if (!u) { setupIdx = 3; setupFocus(); return smsg('Escriu l\'usuari'); }
      smsg('Entrant…');
      api('POST', '/Users/AuthenticateByName', { Username: u, Pw: $('sPass').value }, function (err, a) {
        if (err) return smsg(err === 'HTTP 401' ? 'Usuari o contrasenya incorrectes' : 'Error: ' + err);
        $('sPass').value = '';
        loggedIn(srv, a);
      }, srv);
    });
  }
  function loggedIn(srv, a) {
    S = { server: srv, token: a.AccessToken, userId: a.User.Id, userName: a.User.Name };
    save('jf', S);
    startBrowse();
  }
  function logout(m) {
    if (playing) closePlayer();
    if (S.token) api('POST', '/Sessions/Logout', null, null);
    S = { server: S.server };
    save('jf', S);
    showSetup(m || '');
  }
  function setupAct(act) {
    if (act === 'qc') return quickConnect();
    if (act === 'pw') {
      stopQc(); $('sCode').className = 'scode hidden';
      $('sPw').className = ''; setupIdx = 3; setupFocus(); return;
    }
    if (act === 'login') return passwordLogin();
  }
  function setupKey(k, ev) {
    var els = setupEls(), el = els[setupIdx], typing = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (k === 461 || k === 27) {
      if (typing) { document.activeElement.blur(); return true; }
      if (qcTimer) { stopQc(); $('sCode').className = 'scode hidden'; smsg(''); return true; }
      window.close(); return true;
    }
    if (k === 38 || k === 40 || (!typing && (k === 37 || k === 39))) {
      if (typing) document.activeElement.blur();
      setupIdx += k === 40 || k === 39 ? 1 : -1; setupFocus(); return true;
    }
    if (k === 13) {
      if (typing) { document.activeElement.blur(); setupIdx++; setupFocus(); return true; }
      if (!el) return true;
      if (el.tagName === 'INPUT') { el.focus(); return true; }
      setupAct(el.getAttribute('data-act')); return true;
    }
    return false;
  }

  function startBrowse() {
    $('setup').className = 'setup hidden';
    $('browse').className = '';
    stopQc();
    get('/UserViews?' + qs({ userId: S.userId }), function (err, d) {
      if (err) return showSetup('No es pot connectar amb ' + S.server + ' (' + err + '). Torna-ho a provar quan el servidor estigui engegat.');
      libs = (d.Items || []).filter(function (l) { return !SKIP_LIBS[l.CollectionType]; });
      buildTabs();
      area = 'tabs';
      openTab(0);
    });
  }

  /* ---------- player ---------- */
  var video = $('video'), playing = null, osdTimer, reportTimer;

  function fmtT(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60);
  }

  // What this TV plays by itself (checked with canPlayType on the TV): MP4/MOV with H.264 or HEVC and
  // AAC/MP3/AC3/E-AC3, WebM; anything else (MKV, DTS…) is remuxed or transcoded by the server to HLS.
  function deviceProfile(br) {
    return {
      MaxStreamingBitrate: br, MaxStaticBitrate: 200000000, MusicStreamingTranscodingBitrate: 192000,
      DirectPlayProfiles: [
        { Container: 'mp4,m4v,mov', Type: 'Video', VideoCodec: 'h264,hevc', AudioCodec: 'aac,mp3,ac3,eac3' },
        { Container: 'webm', Type: 'Video', VideoCodec: 'vp8,vp9', AudioCodec: 'vorbis,opus' }
      ],
      TranscodingProfiles: [
        { Container: 'ts', Type: 'Video', VideoCodec: 'h264', AudioCodec: 'aac,mp3,ac3', Protocol: 'hls',
          Context: 'Streaming', MaxAudioChannels: '6', MinSegments: 1, BreakOnNonKeyFrames: true }
      ],
      ContainerProfiles: [],
      CodecProfiles: [
        { Type: 'Video', Codec: 'h264', Conditions: [
          { Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '51', IsRequired: false },
          { Condition: 'LessThanEqual', Property: 'VideoBitDepth', Value: '8', IsRequired: false }] },
        { Type: 'Video', Codec: 'hevc', Conditions: [
          { Condition: 'LessThanEqual', Property: 'VideoBitDepth', Value: '10', IsRequired: false }] }
      ],
      SubtitleProfiles: ['vtt', 'srt', 'subrip', 'ass', 'ssa'].map(function (f) { return { Format: f, Method: 'External' }; })
    };
  }

  function showOsd() {
    $('osd').className = 'osd';
    clearTimeout(osdTimer);
    osdTimer = setTimeout(function () { if (!video.paused) $('osd').className = 'osd off'; }, 4000);
    updOsd();
  }
  function updOsd() {
    if (!playing) return;
    var d = playing.duration || video.duration || 0;
    $('osdFill').style.width = (d ? Math.min(100, video.currentTime / d * 100) : 0) + '%';
    $('osdTime').textContent = fmtT(video.currentTime);
    $('osdDur').textContent = d ? fmtT(d) : '';
    $('osdState').textContent = video.paused ? '❚❚ En pausa' : '';
  }
  setInterval(function () { if (playing) updOsd(); }, 1000);

  function label(s) { return s.DisplayTitle || s.Language || ('Pista ' + s.Index); }

  // opts: { audio: index, sub: index|-1, noDirect: bool }
  function play(it, startSec, opts) {
    opts = opts || {};
    var br = load('jfbr', BITRATES[0].v);
    $('player').className = 'player';
    $('osdTitle').textContent = it.Type === 'Episode' ? it.SeriesName + ' · ' + epCode(it) : it.Name;
    $('osdSub').textContent = it.Type === 'Episode' ? it.Name : [it.ProductionYear, runtime(it.RunTimeTicks)].filter(Boolean).join(' · ');
    $('spinner').textContent = 'Carregant…'; $('spinner').className = 'spinner';
    showSub(''); subs = [];
    var body = { UserId: S.userId, StartTimeTicks: Math.floor(startSec * 1e7), MaxStreamingBitrate: br,
      DeviceProfile: deviceProfile(br), EnableDirectPlay: !opts.noDirect, EnableDirectStream: true, EnableTranscoding: true,
      AllowVideoStreamCopy: true, AllowAudioStreamCopy: true, AutoOpenLiveStream: true, SubtitleStreamIndex: -1 };
    if (opts.audio != null) body.AudioStreamIndex = opts.audio;
    var token = {};
    playing = { it: it, token: token, start: startSec, duration: (it.RunTimeTicks || 0) / 1e7 };
    api('POST', '/Items/' + it.Id + '/PlaybackInfo?' + qs({ userId: S.userId }), body, function (err, d) {
      if (!playing || playing.token !== token) return;
      var ms = d && d.MediaSources && d.MediaSources[0];
      if (err || !ms) return playError(err ? 'Error: ' + err : (d && d.ErrorCode ? 'El servidor no ho permet (' + d.ErrorCode + ')' : 'No s\'ha trobat el vídeo'));
      var url, method, container = String(ms.Container || '').split(',')[0];
      if (ms.SupportsDirectPlay && !opts.noDirect && /^(mp4|m4v|mov|webm)$/.test(container)) {
        url = S.server + '/Videos/' + it.Id + '/stream.' + container + '?' +
          qs({ Static: true, MediaSourceId: ms.Id, DeviceId: DEV, api_key: S.token, Tag: ms.ETag });
        method = 'DirectPlay';
      } else if (ms.TranscodingUrl) {
        // the playlist covers the whole video, so we seek ourselves instead of starting the transcode later
        url = S.server + ms.TranscodingUrl.replace(/([?&])StartTimeTicks=\d+&?/i, '$1');
        if (!/(api_key|ApiKey)=/.test(url)) url += '&api_key=' + S.token;
        method = /VideoCodec=copy|videoStreamCopy|\bcopy\b/i.test(ms.TranscodingUrl) ? 'DirectStream' : 'Transcode';
      } else return playError('Aquest vídeo no es pot reproduir en aquesta TV');
      var p = playing;
      p.ms = ms; p.sid = d.PlaySessionId; p.method = method;
      p.audio = opts.audio != null ? opts.audio : ms.DefaultAudioStreamIndex;
      if (ms.RunTimeTicks) p.duration = ms.RunTimeTicks / 1e7;
      p.audios = (ms.MediaStreams || []).filter(function (s) { return s.Type === 'Audio'; });
      p.subTracks = (ms.MediaStreams || []).filter(function (s) { return s.Type === 'Subtitle' && s.IsTextSubtitleStream; });
      var want = opts.sub !== undefined ? opts.sub : ms.DefaultSubtitleStreamIndex;
      selectSub(p.subTracks.some(function (s) { return s.Index === want; }) ? want : -1, false);
      video.src = url; video.load(); video.play();
      report('/Sessions/Playing');
      clearInterval(reportTimer);
      reportTimer = setInterval(function () { report('/Sessions/Playing/Progress'); }, 10000);
      if (p.subTracks.length && opts.sub === undefined) {
        toast(p.sub >= 0 ? 'Subtítols: ' + label(subTrack(p.sub)) + ' (▲ per canviar)' : 'Té subtítols: prem ▲ per activar-los');
      }
    });
    showOsd();
  }
  function playError(t) {
    $('spinner').textContent = t; $('spinner').className = 'spinner';
  }
  function report(path, extra) {
    var p = playing;
    if (!p || !p.sid) return;
    api('POST', path, merge({
      ItemId: p.it.Id, MediaSourceId: p.ms.Id, PlaySessionId: p.sid, PlayMethod: p.method, CanSeek: true,
      PositionTicks: Math.floor((video.currentTime || p.start || 0) * 1e7), IsPaused: video.paused,
      AudioStreamIndex: p.audio, SubtitleStreamIndex: p.sub
    }, extra || {}), null);
  }
  // tell the server we are done (saves the position, ends any transcode)
  function stopSession(p, posSec) {
    if (!p || !p.sid) return;
    api('POST', '/Sessions/Playing/Stopped', { ItemId: p.it.Id, MediaSourceId: p.ms.Id, PlaySessionId: p.sid,
      PositionTicks: Math.floor(posSec * 1e7) }, null);
    if (p.method !== 'DirectPlay') api('DELETE', '/Videos/ActiveEncodings?' + qs({ DeviceId: DEV, PlaySessionId: p.sid }), null, null);
  }

  video.addEventListener('playing', function () {
    $('spinner').className = 'spinner hidden';
    if (playing && playing.start && !playing.seeked) {
      playing.seeked = true;
      if (Math.abs(video.currentTime - playing.start) > 5) video.currentTime = playing.start;
    }
    showOsd();
  });
  video.addEventListener('waiting', function () { $('spinner').textContent = 'Carregant…'; $('spinner').className = 'spinner'; });
  video.addEventListener('pause', function () { if (playing) { report('/Sessions/Playing/Progress'); showOsd(); } });
  video.addEventListener('error', function () {
    var p = playing;
    if (!p || !p.sid) return;
    if (p.method === 'DirectPlay') {   // e.g. a HEVC file the decoder refuses: ask the server to convert it
      var at = video.currentTime || p.start;
      stopSession(p, at);
      return play(p.it, at, { audio: p.audio, sub: p.sub, noDirect: true });
    }
    playError('No s\'ha pogut reproduir aquest vídeo');
  });
  video.addEventListener('ended', function () {
    if (!playing) return;
    closePlayer(playing.duration || video.duration || 0);
  });

  function closePlayer(endAt) {
    var p = playing;
    clearInterval(reportTimer);
    var at = endAt != null ? endAt : video.currentTime || (p && p.start) || 0;
    playing = null; subs = []; showSub('');
    video.pause(); video.removeAttribute('src'); video.load();
    $('player').className = 'player hidden';
    stopSession(p, at);
    // positions and "seen" marks changed: refresh what is on screen once the server has saved them
    setTimeout(function () { var v = view(); if (v && v.reload && !playing) v.reload(); }, 800);
  }

  function cycleAudio() {
    var p = playing;
    if (!p || !p.audios) return;
    if (p.audios.length < 2) return toast('Només hi ha una pista d\'àudio');
    var i = 0;
    p.audios.forEach(function (s, k) { if (s.Index === p.audio) i = k; });
    var next = p.audios[(i + 1) % p.audios.length];
    toast('Àudio: ' + label(next));
    var at = video.currentTime || p.start;
    stopSession(p, at);
    // the browser can only play the file's default track, so another one needs the server to remux it
    play(p.it, at, { audio: next.Index, sub: p.sub, noDirect: next.Index !== p.ms.DefaultAudioStreamIndex });
  }

  /* ---------- subtitles (WebVTT made by the server, rendered by us) ---------- */
  var subs = [], subShown = '';
  function subTrack(i) { var t = null; (playing.subTracks || []).forEach(function (s) { if (s.Index === i) t = s; }); return t; }
  function vttTime(s) {
    var m = /(?:(\d+):)?(\d+):(\d+)[.,](\d+)/.exec(s); if (!m) return 0;
    return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
  }
  function parseVtt(txt) {
    var cues = [];
    txt.replace(/\r/g, '').split(/\n\n+/).forEach(function (block) {
      var lines = block.split('\n'), i = 0;
      while (i < lines.length && lines[i].indexOf('-->') < 0) i++;
      if (i >= lines.length) return;
      var t = lines[i].split('-->');
      var text = lines.slice(i + 1).filter(function (l) { return l.trim(); })
        .map(function (l) { return esc(l.replace(/<[^>]+>/g, '').replace(/\{\\[^}]*\}/g, '')); }).join('<br>');
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
      if (subs[i].a <= t && t < subs[i].b) h += (h ? '<br>' : '') + subs[i].h;
      else if (subs[i].a > t) break;
    }
    showSub(h);
  });
  function selectSub(i, announce) {
    var p = playing;
    p.sub = i; subs = []; showSub('');
    var tr = i >= 0 ? subTrack(i) : null;
    if (announce) toast(tr ? 'Subtítols: ' + label(tr) : (p.subTracks.length ? 'Subtítols desactivats' : 'Aquest vídeo no té subtítols de text'));
    if (!tr) return;
    var x = new XMLHttpRequest();
    x.open('GET', S.server + '/Videos/' + p.it.Id + '/' + p.ms.Id + '/Subtitles/' + i + '/0/Stream.vtt?api_key=' + S.token, true);
    x.onload = function () {
      if (playing !== p || p.sub !== i) return;
      if (x.status !== 200) return toast('No s\'han pogut carregar els subtítols');
      subs = parseVtt(x.responseText);
    };
    x.send();
  }
  function cycleSub() {
    var p = playing;
    if (!p || !p.subTracks) return;
    if (!p.subTracks.length) return toast('Aquest vídeo no té subtítols de text');
    var k = -1;
    p.subTracks.forEach(function (s, j) { if (s.Index === p.sub) k = j; });
    selectSub(k + 1 < p.subTracks.length ? p.subTracks[k + 1].Index : -1, true);
    report('/Sessions/Playing/Progress');
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
    var big = rep > 3, d = playing.duration || video.duration || 0;
    switch (k) {
      case 13: case 415: case 19:
        if (k === 415 || (k === 13 && video.paused)) video.play(); else video.pause();
        break;
      case 37: case 412: video.currentTime = Math.max(0, video.currentTime - (big || k === 412 ? 60 : 10)); break;
      case 39: case 417: video.currentTime = Math.min(d ? d - 2 : 1e9, video.currentTime + (big || k === 417 ? 60 : 10)); break;
      case 413: closePlayer(); return true;
      case 38: cycleSub(); break;
      case 40: cycleAudio(); break;
      default: return false;
    }
    showOsd();
    return true;
  }

  function chipAct(c) {
    var v = view();
    if (c.act === 'sort') {
      var nv = libraryView(v.lib, c.idx); nv.focus = { r: 0, c: c.idx };
      if (stack.length > 1) replaceView(nv); else setRoot(nv);
      return nv.load();
    }
    if (c.act === 'season') { showSeason(v, c.idx); v.focus = { r: 0, c: c.idx }; return updateFocus(); }
    if (c.act === 'play') return play(c.it, c.pos);
    if (c.act === 'played') return setPlayed(c.it, !c.played);
    if (c.act === 'series') return openSeries({ Id: c.it.SeriesId, Name: c.it.SeriesName });
    if (c.act === 'bitrate') { save('jfbr', c.v); toast('Qualitat màxima: ' + c.title); var f = v.focus; showSettings(); view().focus = f; return updateFocus(); }
    if (c.act === 'logout') return logout('Sessió tancada');
  }

  function gridKey(k) {
    var v = view(), f = v.focus, row = v.rows[f.r], cur = row && row[f.c];
    switch (k) {
      case 37: if (f.c > 0) f.c--; break;
      case 39: if (row && f.c < row.length - 1) f.c++; break;
      case 38:
        if (f.r === 0) { area = tabs[tab].search ? 'search' : 'tabs'; break; }
        f.r--; f.c = nearest(v.rows[f.r], cur && cur.el);
        if (v.rows[f.r][0].kind === 'chip') v.rows[f.r].forEach(function (c, i) { if (c.sel) f.c = i; });
        break;
      case 40:
        if (f.r < v.rows.length - 1) { f.r++; f.c = cur && cur.kind === 'chip' ? 0 : nearest(v.rows[f.r], cur && cur.el); }
        break;
      case 13:
        if (!cur) return true;
        if (cur.kind === 'chip') return chipAct(cur), true;
        return openItem(cur.it), true;
      default: return false;
    }
    updateFocus();
    return true;
  }

  document.addEventListener('keydown', function (ev) {
    var k = ev.keyCode, now = Date.now();
    rep = (k === lastKey && now - lastTime < 250) ? rep + 1 : 0;
    lastKey = k; lastTime = now;

    if ($('setup').className.indexOf('hidden') < 0) { if (setupKey(k, ev)) ev.preventDefault(); return; }
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
      else if (k === 39) tabFocus = Math.min(tabs.length - 1, tabFocus + 1);
      else if (k === 13 || k === 40) {
        if (tabFocus !== tab) openTab(tabFocus);
        if (tabs[tab].search) area = 'search';
        else if (view().rows.length) area = 'grid';
      } else return;
      updateFocus(); ev.preventDefault(); return;
    }
    if (gridKey(k)) ev.preventDefault();
  });

  document.addEventListener('webkitvisibilitychange', function () {
    if (document.webkitHidden && playing) { report('/Sessions/Playing/Progress'); video.pause(); }
  });

  function tick() { var d = new Date(); $('clock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  setInterval(tick, 10000); tick();

  if (S.token) startBrowse(); else showSetup('');
})();
