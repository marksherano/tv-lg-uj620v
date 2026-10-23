/* Brillo+ — picture/brightness manager for LG webOS 3.x (Chromium 38: ES5 only). */
(function () {
  'use strict';

  var CONF_DIR = '/media/developer/brillo';
  var EXEC = 'luna://org.webosbrew.hbchannel.service/exec';
  var SETTINGS = 'luna://com.webos.settingsservice/';

  var CONTROLS = [
    { key: 'backlight', label: 'Llum de fons', min: 0, max: 100 },
    { key: 'brightness', label: 'Brillantor', min: 0, max: 100 },
    { key: 'contrast', label: 'Contrast', min: 0, max: 100 },
    { key: 'color', label: 'Color', min: 0, max: 100 },
    { key: 'sharpness', label: 'Nitidesa', min: 0, max: 50 },
    { key: 'colorTemperature', label: 'Temperatura', min: -50, max: 50, center: true,
      fmt: function (v) { return v === 0 ? '0' : (v < 0 ? 'C' + (-v) : 'W' + v); } },
    { key: 'energySaving', label: 'Estalvi energia', opts: ['off', 'min', 'med', 'max', 'auto'],
      names: { off: 'No', min: 'Mín', med: 'Mitjà', max: 'Màx', auto: 'Auto' } },
    { key: 'eyeComfortMode', label: 'Confort visual', opts: ['off', 'on'], names: { off: 'No', on: 'Sí' } },
    { key: 'localDimming', label: 'Atenuació local', opts: ['off', 'low', 'medium', 'high'],
      names: { off: 'No', low: 'Baixa', medium: 'Mitjana', high: 'Alta' } },
    { key: 'dynamicContrast', label: 'Contrast dinàmic', opts: ['off', 'low', 'medium', 'high'],
      names: { off: 'No', low: 'Baix', medium: 'Mitjà', high: 'Alt' } },
    { key: 'gamma', label: 'Gamma', opts: ['low', 'medium', 'high1', 'high2'],
      names: { low: 'Baixa', medium: 'Mitjana', high1: 'Alta 1', high2: 'Alta 2' } }
  ];

  var BUILTIN = [
    { name: 'Dia', desc: 'Llum 90 · sense estalvi',
      s: { backlight: 90, brightness: 50, contrast: 90, energySaving: 'off', eyeComfortMode: 'off' } },
    { name: 'Tarda', desc: 'Llum 60 · to neutre',
      s: { backlight: 60, brightness: 50, contrast: 88, energySaving: 'off', eyeComfortMode: 'off' } },
    { name: 'Nit', desc: 'Llum 25 · confort visual',
      s: { backlight: 25, brightness: 48, contrast: 85, energySaving: 'off', eyeComfortMode: 'on' } },
    { name: 'Cinema', desc: 'Llum 40 · atenuació local',
      s: { backlight: 40, brightness: 50, contrast: 85, localDimming: 'medium', dynamicContrast: 'off',
           energySaving: 'off', eyeComfortMode: 'off' } }
  ];

  var cfg = {
    custom: [null, null, null],
    schedOn: false,
    sched: [
      { label: 'Matí', t: 7 * 60, p: 0 },
      { label: 'Tarda', t: 18 * 60, p: 1 },
      { label: 'Nit', t: 22 * 60, p: 2 }
    ]
  };

  var values = {};      // current picture settings as read from the TV
  var types = {};       // original JSON type of each value ('number' / 'string')
  var useExec = false;  // fall back to root exec if direct settings calls are refused
  var bridges = [];

  /* ---------- luna helpers ---------- */
  function luna(uri, params, cb) {
    var b = new PalmServiceBridge();
    bridges.push(b);
    b.onservicecallback = function (msg) {
      bridges.splice(bridges.indexOf(b), 1);
      var r;
      try { r = JSON.parse(msg); } catch (e) { r = { returnValue: false, errorText: 'bad response' }; }
      if (cb) cb(r);
    };
    b.call(uri, JSON.stringify(params || {}));
  }

  function sh(cmd, cb) {
    luna(EXEC, { command: cmd }, function (r) {
      if (cb) cb(r.returnValue !== false, r.stdoutString || '', r);
    });
  }

  function lunaSendCmd(method, params) {
    return 'luna-send -n 1 ' + SETTINGS + method + " '" + JSON.stringify(params) + "'";
  }

  function settingsCall(method, params, cb) {
    if (!useExec) {
      luna(SETTINGS + method, params, function (r) {
        if (r.returnValue) return cb(r);
        useExec = true;
        settingsCall(method, params, cb);
      });
      return;
    }
    sh(lunaSendCmd(method, params), function (ok, out) {
      var r;
      try { r = JSON.parse(out); } catch (e) { r = { returnValue: false, errorText: out || 'exec error' }; }
      cb(r);
    });
  }

  function b64(s) { return btoa(unescape(encodeURIComponent(s))); }
  function writeFile(path, text, cb) {
    sh('mkdir -p ' + CONF_DIR + ' && echo ' + b64(text) + ' | base64 -d > ' + path, cb);
  }

  /* ---------- picture settings ---------- */
  function coerce(key, v) {
    if (types[key] === 'string') return String(v);
    if (types[key] === 'number' && typeof v === 'string' && /^-?\d+$/.test(v)) return parseInt(v, 10);
    return v;
  }

  function readSettings(cb) {
    var keys = CONTROLS.map(function (c) { return c.key; });
    settingsCall('getSystemSettings', { category: 'picture', keys: keys }, function (r) {
      if (!r.returnValue || !r.settings) { status(T('No puc llegir els ajustos: {0}', r.errorText || '?'), 'err'); return; }
      keys.forEach(function (k) {
        if (k in r.settings) { types[k] = typeof r.settings[k]; values[k] = r.settings[k]; }
      });
      var d = r.dimension || {};
      el('dim').textContent = (d.input ? T('Entrada: {0}', d.input) : '') + (d.pictureMode ? '  ·  ' + T('Mode: {0}', d.pictureMode) : '');
      if (cb) cb();
    });
  }

  var pending = {}, pendingTimer = null;
  function queueSet(obj) {
    for (var k in obj) pending[k] = coerce(k, obj[k]);
    if (pendingTimer) return;
    pendingTimer = setTimeout(flush, 120);
  }
  function flush() {
    pendingTimer = null;
    var s = pending; pending = {};
    settingsCall('setSystemSettings', { category: 'picture', settings: s }, function (r) {
      if (!r.returnValue) status(T('Error en aplicar: {0}', r.errorText || '?'), 'err');
    });
  }

  function applySettings(s, msg) {
    for (var k in s) values[k] = coerce(k, s[k]);
    queueSet(s);
    render();
    if (msg) status(msg, 'ok');
  }

  /* ---------- config persistence ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(t) { return pad(Math.floor(t / 60)) + ':' + pad(t % 60); }
  function presetByIndex(i) {
    if (i < BUILTIN.length) return BUILTIN[i];
    var c = cfg.custom[i - BUILTIN.length];
    return c ? { name: T('Personal {0}', i - BUILTIN.length + 1), s: c } : null;
  }

  function saveConfig() {
    var lines = [cfg.schedOn ? 'on' : 'off'];
    cfg.sched.forEach(function (e) {
      var p = presetByIndex(e.p);
      if (!p) return;
      var s = {};
      for (var k in p.s) s[k] = coerce(k, p.s[k]);
      lines.push(hhmm(e.t).replace(':', '') + ' ' + JSON.stringify(s).replace(/ /g, ''));
    });
    writeFile(CONF_DIR + '/config.json', JSON.stringify(cfg), function () {
      writeFile(CONF_DIR + '/schedule.conf', lines.join('\n') + '\n', function (ok) {
        // let the daemon re-apply the currently active entry with the new schedule
        sh('rm -f /tmp/brillo.applied');
        if (!ok) status(T("No s'ha pogut desar la configuració"), 'err');
      });
    });
  }

  function loadConfig(cb) {
    sh('cat ' + CONF_DIR + '/config.json 2>/dev/null', function (ok, out) {
      try {
        var c = JSON.parse(out);
        if (c && c.sched) cfg = c;
      } catch (e) { /* first run: keep defaults */ }
      cb();
    });
  }

  /* ---------- UI ---------- */
  function el(id) { return document.getElementById(id); }
  var statusTimer;
  function status(t, cls) {
    var s = el('status');
    s.textContent = t; s.className = 'status ' + (cls || '');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { s.textContent = ''; }, 3500);
  }

  // focusable items: { col: 'main'|'side', kind, ... }
  var items = [], focus = 0;

  function buildItems() {
    items = [];
    CONTROLS.forEach(function (c) { items.push({ col: 'main', kind: 'ctl', c: c }); });
    BUILTIN.forEach(function (p, i) { items.push({ col: 'side', kind: 'preset', i: i }); });
    cfg.custom.forEach(function (p, i) { items.push({ col: 'side', kind: 'custom', i: i }); });
    items.push({ col: 'side', kind: 'schedOn' });
    cfg.sched.forEach(function (e, i) { items.push({ col: 'side', kind: 'sched', i: i }); });
    items.push({ col: 'side', kind: 'lang' });
  }

  function rowHtml(it, idx) {
    var f = idx === focus ? ' focus' : '';
    var h = '';
    if (it.kind === 'ctl') {
      var c = it.c, v = values[c.key];
      h += '<div class="row' + f + '"><div class="label">' + T(c.label) + '</div>';
      if (v === undefined) {
        h += '<div class="opts"><span class="opt">—</span></div>';
      } else if (c.opts) {
        h += '<div class="opts">';
        c.opts.forEach(function (o) { h += '<span class="opt' + (o === v ? ' sel' : '') + '">' + T(c.names[o]) + '</span>'; });
        h += '</div>';
      } else {
        var n = parseInt(v, 10), pct = (n - c.min) / (c.max - c.min) * 100;
        var style = c.center
          ? 'left:' + Math.min(50, pct) + '%;width:' + Math.abs(pct - 50) + '%'
          : 'width:' + pct + '%';
        h += '<div class="bar"><div class="fill' + (c.center ? ' center' : '') + '" style="' + style + '"></div></div>' +
             '<div class="val">' + (c.fmt ? c.fmt(n) : n) + '</div>';
      }
      return h + '</div>';
    }
    if (it.kind === 'preset') {
      var p = BUILTIN[it.i];
      return '<div class="row preset' + f + '"><div class="pname">' + T(p.name) + '</div><div class="pdesc">' + T(p.desc) +
             '</div><div class="pact">' + T('OK aplica') + '</div></div>';
    }
    if (it.kind === 'custom') {
      var cs = cfg.custom[it.i];
      return '<div class="row preset' + f + '"><div class="pname">' + T('Personal {0}', it.i + 1) + '</div><div class="pdesc">' +
             (cs ? T('Llum {0} · Bri. {1}', cs.backlight, cs.brightness) : T('buit')) +
             '</div><div class="pact">' + T(cs ? 'OK aplica · ▶ desa' : 'OK desa') + '</div></div>';
    }
    if (it.kind === 'schedOn') {
      return '<div class="row sched' + f + '"><div class="label">' + T('Automàtic') + '</div><div class="opts">' +
             '<span class="opt' + (!cfg.schedOn ? ' sel' : '') + '">' + T('No') + '</span>' +
             '<span class="opt' + (cfg.schedOn ? ' sel' : '') + '">' + T('Sí') + '</span></div></div>';
    }
    if (it.kind === 'lang') {
      return '<div class="row sched' + f + '"><div class="label">' + T('Idioma') + '</div><div class="opts">' +
             LANGS.map(function (l) { return '<span class="opt' + (l === LANG ? ' sel' : '') + '">' + LANG_NAMES[l] + '</span>'; }).join('') +
             '</div></div>';
    }
    var e = cfg.sched[it.i], pr = presetByIndex(e.p);
    return '<div class="row sched' + f + '"><div class="label">' + T(e.label) + '</div>' +
           '<div class="val">' + hhmm(e.t) + '  →  ' + (pr ? T(pr.name) : '—') + '</div></div>';
  }

  function render() {
    var main = '', presets = '', sched = '', lang = '';
    items.forEach(function (it, i) {
      var h = rowHtml(it, i);
      if (it.col === 'main') main += h;
      else if (it.kind === 'preset' || it.kind === 'custom') presets += h;
      else if (it.kind === 'lang') lang = h;
      else sched += h;
    });
    el('controls').innerHTML = main;
    el('presets').innerHTML = presets;
    el('schedule').innerHTML = sched +
      '<div style="font-size:20px;color:#6c7783;margin:4px 0 14px">' + T('◀ ▶ hora (15 min) · OK canvia el perfil') + '</div>' + lang;
  }

  function adjust(it, dir, big) {
    if (it.kind === 'ctl') {
      var c = it.c, v = values[c.key];
      if (v === undefined) return;
      var nv;
      if (c.opts) {
        var i = c.opts.indexOf(v);
        nv = c.opts[Math.max(0, Math.min(c.opts.length - 1, (i < 0 ? 0 : i) + dir))];
      } else {
        nv = Math.max(c.min, Math.min(c.max, parseInt(v, 10) + dir * (big ? 5 : 1)));
      }
      var o = {}; o[c.key] = nv;
      applySettings(o);
    } else if (it.kind === 'schedOn') {
      cfg.schedOn = dir > 0; saveConfig(); render();
      status(T(cfg.schedOn ? 'Programació activada' : 'Programació desactivada'), 'ok');
    } else if (it.kind === 'sched') {
      var e = cfg.sched[it.i];
      e.t = (e.t + dir * 15 + 1440) % 1440; render(); saveSoon();
    } else if (it.kind === 'lang') {
      setLang(LANGS[(LANGS.indexOf(LANG) + dir + LANGS.length) % LANGS.length]);
      translatePage(); render(); readSettings(render);   // also redraws the input / mode line
    } else if (it.kind === 'custom' && dir > 0) {
      saveCustom(it.i);
    } else if (dir < 0 && it.col === 'side') {
      moveTo('main');
    }
  }

  var saveTimer;
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveConfig, 800); }

  function snapshot() {
    var s = {};
    CONTROLS.forEach(function (c) { if (values[c.key] !== undefined) s[c.key] = values[c.key]; });
    return s;
  }
  function saveCustom(i) {
    cfg.custom[i] = snapshot(); saveConfig(); render();
    status(T('Desat a Personal {0}', i + 1), 'ok');
  }

  function ok(it) {
    if (it.kind === 'preset') applySettings(BUILTIN[it.i].s, T('Perfil {0} aplicat', T(BUILTIN[it.i].name)));
    else if (it.kind === 'custom') {
      if (cfg.custom[it.i]) applySettings(cfg.custom[it.i], T('Personal {0} aplicat', it.i + 1));
      else saveCustom(it.i);
    } else if (it.kind === 'schedOn') adjust(it, cfg.schedOn ? -1 : 1);
    else if (it.kind === 'lang') adjust(it, 1);
    else if (it.kind === 'sched') {
      var e = cfg.sched[it.i], n = BUILTIN.length + cfg.custom.length, p = e.p;
      do { p = (p + 1) % n; } while (!presetByIndex(p));
      e.p = p; render(); saveSoon();
    }
  }

  function moveTo(col) {
    for (var i = 0; i < items.length; i++) if (items[i].col === col) { focus = i; break; }
    render();
  }

  var lastKey = 0, lastKeyTime = 0, repeat = 0;
  document.addEventListener('keydown', function (ev) {
    var it = items[focus], k = ev.keyCode;
    var now = Date.now();
    repeat = (k === lastKey && now - lastKeyTime < 200) ? repeat + 1 : 0;
    lastKey = k; lastKeyTime = now;
    switch (k) {
      case 38: focus = (focus - 1 + items.length) % items.length; render(); break;
      case 40: focus = (focus + 1) % items.length; render(); break;
      case 37: adjust(it, -1, repeat > 4); break;
      case 39: adjust(it, 1, repeat > 4); break;
      case 13: ok(it); break;
      case 461: case 27:
        window.close();  // PalmSystem.platformBack() is a no-op on this webOS 3 build
        break;
      default: return;
    }
    ev.preventDefault();
  });

  // refresh when the app comes back to the foreground (values may have changed in Settings)
  document.addEventListener('webkitvisibilitychange', function () {
    if (!document.webkitHidden) readSettings(render);
  });

  /* ---------- start ---------- */
  translatePage();
  buildItems();
  render();
  loadConfig(function () {
    buildItems();
    readSettings(function () { render(); });
  });
})();
