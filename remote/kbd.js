/* Phone keyboard: knows when a text field on the TV has the focus (the same subscription LG's own
   phone app uses, com.webos.service.ime/registerRemoteKeyboard) and types into it with insertText.
   The phone long-polls /api/kb, so its keyboard shows up as soon as the TV asks for text.
   Node 0.12, ES5. */
var spawn = require('child_process').spawn;

module.exports = function (luna, send) {
  var kb = { v: 0, focus: false, password: false, type: 'text', len: 0 };
  var waiters = [];

  function changed() {
    kb.v++;
    var w = waiters; waiters = [];
    w.forEach(function (x) { clearTimeout(x.t); send(x.res, 200, kb); });
  }

  function onEvent(o) {
    var w = o.currentWidget;
    if (!w) return;
    var focus = !!w.focus, password = !!w.hiddenText, type = w.contentType || 'text';
    var len = w.surroundingTextLength || 0;
    // a new field (or the same one losing/gaining focus) is what the phone cares about
    if (focus !== kb.focus || password !== kb.password || type !== kb.type || o.focusChanged) {
      kb.focus = focus; kb.password = password; kb.type = type; kb.len = len;
      return changed();
    }
    kb.len = len;
  }

  // luna-send -i prints one pretty-printed JSON object after another; split them by brace depth
  function subscribe() {
    var p = spawn('luna-send', ['-i', '-a', 'com.webos.service.secondscreen.gateway',
      'luna://com.webos.service.ime/registerRemoteKeyboard', '{"subscribe":true}']);
    var buf = '', depth = 0, inStr = false, esc = false, start = -1;
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', function (chunk) {
      var base = buf.length;
      buf += chunk;
      for (var i = base; i < buf.length; i++) {
        var c = buf.charAt(i);
        if (inStr) {
          if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false;
        } else if (c === '"') inStr = true;
        else if (c === '{') { if (depth++ === 0) start = i; }
        else if (c === '}' && depth > 0 && --depth === 0) {
          try { onEvent(JSON.parse(buf.slice(start, i + 1))); } catch (e) { /* ignore */ }
          buf = buf.slice(i + 1); i = -1;
        }
      }
      if (depth === 0) buf = '';
    });
    p.on('error', function () {});
    p.on('exit', function () {
      if (kb.focus) { kb.focus = false; changed(); }
      setTimeout(subscribe, 5000);
    });
  }
  subscribe();

  return {
    // GET /api/kb?v=<last version seen>: answers at once if something changed, else waits up to 25 s
    poll: function (q, res) {
      if (String(q.v) !== String(kb.v)) return send(res, 200, kb);
      var x = { res: res };
      x.t = setTimeout(function () {
        waiters.splice(waiters.indexOf(x), 1);
        send(res, 200, kb);
      }, 25000);
      res.on('close', function () {
        clearTimeout(x.t);
        var i = waiters.indexOf(x); if (i >= 0) waiters.splice(i, 1);
      });
      waiters.push(x);
    },

    // POST /api/text?t=..[&replace=1][&enter=1] | ?del=<n> | ?enter=1
    // replace=1 swaps the whole field for t, so the phone can mirror its own input box as you type
    text: function (q, res) {
      function enter(r) {
        if (q.enter !== '1') return send(res, 200, r);
        luna('luna://com.webos.service.ime/sendEnterKey', {}, function (r2) { send(res, 200, r2); });
      }
      if (q.del) {
        var n = Math.min(Math.max(parseInt(q.del, 10) || 1, 1), 500);
        return luna('luna://com.webos.service.ime/deleteCharacters', { count: n }, enter);
      }
      if (q.t == null && q.enter === '1') return enter({ returnValue: true });
      var t = String(q.t || '').slice(0, 500);
      luna('luna://com.webos.service.ime/insertText', { text: t, replace: q.replace === '1' }, enter);
    }
  };
};
