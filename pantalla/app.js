/* Pantalla — shows photos/videos sent from the phone (via the web remote). Chromium 38: ES5 only.
   Launch params: { items: [{ url, type: 'photo'|'video', name }], start: 0 } */
(function () {
  'use strict';
  translatePage();

  var SLIDE_MS = 8000;
  var items = [], idx = 0, slideTimer = null, paused = false, barTimer = null, front = 0;
  var video = document.getElementById('video');
  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtT(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60);
  }

  function params() {
    try {
      var p = window.PalmSystem && PalmSystem.launchParams;
      return typeof p === 'string' ? JSON.parse(p || '{}') : (p || {});
    } catch (e) { return {}; }
  }

  function showBar() {
    $('bar').className = '';
    clearTimeout(barTimer);
    barTimer = setTimeout(function () { if (!(cur() && cur().type === 'video' && video.paused)) $('bar').className = 'off'; }, 4000);
    updBar();
  }
  function cur() { return items[idx]; }
  function updBar() {
    var it = cur(); if (!it) return;
    $('title').textContent = it.name || (it.type === 'video' ? 'Vídeo' : 'Foto');
    var n = items.length > 1 ? T('{0} de {1}', idx + 1, items.length) : '';
    if (it.type === 'video') {
      var d = video.duration || 0;
      $('prog').className = '';
      $('fill').style.width = (d ? video.currentTime / d * 100 : 0) + '%';
      $('info').textContent = [n, fmtT(video.currentTime) + (d ? ' / ' + fmtT(d) : ''), video.paused ? T('❚❚ En pausa') : '']
        .filter(Boolean).join('  ·  ');
      $('help').textContent = T('OK pausa · ◀ ▶ 10 s') + (items.length > 1 ? T(' · ▲ ▼ anterior / següent') : '') + T(' · ENRERE sortir');
    } else {
      $('prog').className = 'hidden';
      $('info').textContent = [n, items.length > 1 ? T(paused ? '❚❚ Passi aturat' : '▶ Passi automàtic') : ''].filter(Boolean).join('  ·  ');
      $('help').textContent = (items.length > 1 ? T('◀ ▶ anterior / següent · OK atura el passi · ') : '') + T('ENRERE sortir');
    }
  }
  setInterval(function () { if (cur() && cur().type === 'video' && $('bar').className === '') updBar(); }, 1000);

  function show(i) {
    if (!items.length) return;
    idx = (i + items.length) % items.length;
    var it = cur();
    clearTimeout(slideTimer);
    $('msg').textContent = '';
    if (it.type === 'video') {
      $('p0').className = $('p1').className = 'layer photo';
      video.className = 'layer';
      video.src = it.url; video.load(); video.play();
    } else {
      video.pause(); video.removeAttribute('src'); video.load(); video.className = 'layer hidden';
      // cross-fade between the two photo layers once the new image has loaded
      var img = new Image();
      img.onload = function () {
        if (cur() !== it) return;
        front = 1 - front;
        $('p' + front).style.backgroundImage = 'url("' + it.url + '")';
        $('p' + front).className = 'layer photo on';
        $('p' + (1 - front)).className = 'layer photo';
        schedule();
      };
      img.onerror = function () { $('msg').textContent = T("No s'ha pogut obrir la foto"); schedule(); };
      img.src = it.url;
    }
    showBar();
  }
  function schedule() {
    clearTimeout(slideTimer);
    if (items.length > 1 && !paused) slideTimer = setTimeout(function () { show(idx + 1); }, SLIDE_MS);
  }

  video.addEventListener('ended', function () { if (items.length > 1) show(idx + 1); else showBar(); });
  video.addEventListener('error', function () {
    $('msg').textContent = T('Aquesta TV no pot reproduir aquest vídeo');
    if (items.length > 1) slideTimer = setTimeout(function () { show(idx + 1); }, 3000);
  });
  video.addEventListener('playing', function () { $('msg').textContent = ''; });
  video.addEventListener('waiting', function () { $('msg').textContent = T('Carregant…'); });

  function load() {
    var p = params();
    // the web remote sends its own language, so messages match the phone that sent the photos
    if (LANG_NAMES[p.lang] && p.lang !== LANG) { setLang(p.lang); translatePage(); }
    if (p.items && p.items.length) {
      items = p.items; paused = false;
      show(p.start || 0);
    }
  }

  document.addEventListener('keydown', function (ev) {
    var k = ev.keyCode, it = cur();
    if (k === 461 || k === 27) { window.close(); return; }
    if (!it) return;
    if (it.type === 'video') {
      if (k === 13 || k === 415 || k === 19) { if (video.paused && k !== 19) video.play(); else video.pause(); }
      else if (k === 37 || k === 412) video.currentTime = Math.max(0, video.currentTime - (k === 412 ? 60 : 10));
      else if (k === 39 || k === 417) video.currentTime = Math.min((video.duration || 1) - 1, video.currentTime + (k === 417 ? 60 : 10));
      else if (k === 38) show(idx - 1);
      else if (k === 40) show(idx + 1);
      else return;
    } else {
      if (k === 37) show(idx - 1);
      else if (k === 39) show(idx + 1);
      else if (k === 13) { paused = !paused; schedule(); }
      else if (k !== 38 && k !== 40) return;
    }
    ev.preventDefault();
    showBar();
  });

  // a new send while the app is already open arrives as a relaunch
  document.addEventListener('webOSRelaunch', function () {
    load();
    if (window.PalmSystem && PalmSystem.activate) PalmSystem.activate();
  });

  load();
})();
