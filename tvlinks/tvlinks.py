#!/usr/bin/env python3
"""Turns video page links (RTVE, Atresplayer clips, regional TVs, Vimeo...) into a direct URL the TV
can play, using yt-dlp. Runs on any always-on Linux box on the LAN; the TV remote (remote/share.js) calls
GET /resolve?u=<link> and opens the result in Pantalla. Content with DRM cannot be resolved.

It also turns the TV on, since nothing on the TV answers while it is off: the TV registers itself
(GET /wake/register?mac=…&port=…, its IP is taken from the request) and GET or POST /wake sends it a
Wake-on-LAN packet ("Turn on with mobile" must be on in the TV menu). GET /tv is the phone's "TV" app
(icon and manifest below): it shows the TV remote inside it while the TV answers, and the power button
while it does not."""
import base64
import ipaddress
import json
import os
import re
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8097
HERE = os.path.dirname(os.path.abspath(__file__))
YTDLP = os.path.join(HERE, 'yt-dlp')
WAKE = os.path.join(HERE, 'wake.json')  # {"mac", "ip", "port"} sent by the TV, kept on this box only  # zipapp, kept up to date by `yt-dlp -U` from cron
# webOS 3.9 plays H.264 MP4 and HLS: prefer one progressive MP4, then HLS, up to 1080p
FORMAT = ('best[ext=mp4][vcodec^=avc1][height<=1080][protocol^=http]'
          '/best[ext=mp4][height<=1080][protocol^=http]'
          '/best[protocol^=m3u8][height<=1080]/best[height<=1080]/best')


def resolve(link):
    p = subprocess.run([sys.executable, YTDLP, '-J', '--no-playlist', '--no-warnings', '-f', FORMAT, link],
                       capture_output=True, text=True, timeout=90)
    if p.returncode != 0:
        err = (p.stderr.strip().splitlines() or ['yt-dlp error'])[-1]
        return 422, {'error': err.replace('ERROR: ', '')}
    info = json.loads(p.stdout)
    if not info.get('url'):
        return 422, {'error': 'no hi ha cap format que la TV pugui reproduir'}
    return 200, {'url': info['url'], 'title': info.get('title') or '', 'ext': info.get('ext'),
                 'protocol': info.get('protocol'), 'headers': info.get('http_headers') or {}}


def load_tv():
    try:
        with open(WAKE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def answers(ip, port):
    try:
        socket.create_connection((ip, port), timeout=1.5).close()
        return True
    except OSError:
        return False


def wake():
    tv = load_tv()
    if not tv:
        return 409, {'error': "la TV encara no s'ha registrat (ha d'estar encesa un cop amb el comandament en marxa)"}
    packet = bytes(6 * [255]) + bytes.fromhex(tv['mac'].replace(':', '')) * 16
    net = ipaddress.ip_interface(tv['ip'] + '/24').network
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        # a sleeping TV may have dropped out of the ARP cache: broadcast as well as unicast
        for host in ('255.255.255.255', str(net.broadcast_address), tv['ip']):
            for port in (9, 7):
                try:
                    s.sendto(packet, (host, port))
                except OSError:
                    pass
    return 200, {'ok': True, 'tv': 'http://%s:%d/' % (tv['ip'], tv['port'])}


# --- Starting the remote when the TV is on without it ----------------------------------------------
# After a power-off the TV may reboot into Quick Start standby and come up with Live TV instead of
# Arrencada; Wake-on-LAN then only resumes it, so Homebrew Channel's startup (and the remote) never
# runs. LG's own API (SSAP, WebSocket on port 3000, no root) can still launch apps: open Arrencada,
# telling it which app to go back to. Pair once with `python3 tvlinks.py pair` (accept the prompt on the TV).
SSAP_KEY = os.path.join(HERE, 'clientkey.txt')
SSAP_MANIFEST = {'manifestVersion': 1, 'appVersion': '1.1', 'permissions': ['LAUNCH', 'READ_RUNNING_APPS']}
STUCK_AFTER = 20    # seconds the TV must answer without the remote (a real boot starts it by itself)
RELAUNCH_EVERY = 120
kick = {'since': 0, 'last': 0}
kick_lock = threading.Lock()


def ws_open(ip, port):
    s = socket.create_connection((ip, port), timeout=10)
    key = base64.b64encode(os.urandom(16)).decode()
    s.sendall(('GET / HTTP/1.1\r\nHost: %s:%d\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
               'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n' % (ip, port, key)).encode())
    head = b''
    while b'\r\n\r\n' not in head:
        c = s.recv(1)
        if not c:
            raise OSError('websocket handshake closed')
        head += c
    if b' 101 ' not in head.split(b'\r\n')[0]:
        raise OSError('websocket handshake: %r' % head.split(b'\r\n')[0])
    return s


def ws_send(s, text):
    data = text.encode()
    n = len(data)
    head = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + n.to_bytes(2, 'big'))
    mask = os.urandom(4)
    s.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))


def ws_recv(s):
    def take(n):
        buf = b''
        while len(buf) < n:
            c = s.recv(n - len(buf))
            if not c:
                raise OSError('websocket closed')
            buf += c
        return buf
    msg = b''
    while True:
        b0, b1 = take(2)
        n = b1 & 0x7f
        if n == 126:
            n = int.from_bytes(take(2), 'big')
        elif n == 127:
            n = int.from_bytes(take(8), 'big')
        data = take(n)
        op = b0 & 0x0f
        if op == 8:
            raise OSError('websocket closed')
        if op in (0, 1, 2):
            msg += data
            if b0 & 0x80:
                return json.loads(msg.decode())


def ssap(ip, calls, pair=False):
    """Registers with the stored key and runs [(uri, payload), …]; returns the payloads. With pair=True
    it asks for a new key instead (the TV shows a prompt to accept) and stores it."""
    payload = {'pairingType': 'PROMPT', 'manifest': SSAP_MANIFEST}
    if not pair:
        with open(SSAP_KEY) as f:
            payload['client-key'] = f.read().strip()
    s = ws_open(ip, 3000)
    if pair:
        s.settimeout(60)
    try:
        ws_send(s, json.dumps({'type': 'register', 'id': 'reg0', 'payload': payload}))
        while True:
            m = ws_recv(s)
            if m.get('type') == 'registered':
                if pair:
                    with open(SSAP_KEY, 'w') as f:
                        f.write(m['payload']['client-key'])
                break
            if m.get('type') == 'error':
                raise OSError('ssap register: %s' % m.get('error'))
        out = []
        for i, (uri, payload) in enumerate(calls):
            ws_send(s, json.dumps({'type': 'request', 'id': 'r%d' % i, 'uri': uri, 'payload': payload}))
            while True:
                m = ws_recv(s)
                if m.get('id') == 'r%d' % i:
                    out.append(m.get('payload') or {})
                    break
        return out
    finally:
        s.close()


def start_remote(ip):
    try:
        fg = ssap(ip, [('ssap://com.webos.applicationManager/getForegroundAppInfo', {})])[0].get('appId') or ''
        params = {'back': fg} if fg and fg != 'cat.arrencada' else {}
        ssap(ip, [('ssap://system.launcher/launch', {'id': 'cat.arrencada', 'params': params})])
        sys.stderr.write('%s started Arrencada (back to %s)\n' % (time.strftime('%d/%b/%Y %H:%M:%S'), fg or '?'))
    except (OSError, ValueError) as e:
        sys.stderr.write('%s could not start Arrencada: %s\n' % (time.strftime('%d/%b/%Y %H:%M:%S'), e))


def check_stuck(ip, on, up):
    """Called on every /wake/tv poll: launches Arrencada once the TV has been up without the remote."""
    now = time.time()
    with kick_lock:
        if on or not up:
            kick['since'] = 0
            return
        kick['since'] = kick['since'] or now
        if now - kick['since'] < STUCK_AFTER or now - kick['last'] < RELAUNCH_EVERY or not os.path.exists(SSAP_KEY):
            return
        kick['last'] = now
    threading.Thread(target=start_remote, args=(ip,), daemon=True).start()


WAKE_PAGE = '''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="TV">
<meta name="theme-color" content="#111318"><title>Encén la TV</title>
<link rel="icon" type="image/png" sizes="32x32" href="tv-32.png">
<link rel="apple-touch-icon" href="tv-180.png">
<link rel="manifest" href="tv.webmanifest">
<style>
html, body { height: 100%; }
body { margin: 0; background: #111318; color: #e8e8ee; font: 17px system-ui, sans-serif; text-align: center; }
h1 { font-size: 22px; margin: 48px 0 8px; }
button { margin: 32px auto 16px; width: 180px; height: 180px; border-radius: 50%; border: 0; background: #c0392b;
  color: #fff; font-size: 64px; }
button:disabled { opacity: .5; }
#st { color: #9a9aa6; min-height: 2.5em; padding: 0 24px; }
a { color: #4ea3ff; }
/* the remote is shown inside this page, so the phone app never leaves this address (on the iPhone a
   home screen app that goes to another address opens it in a separate Safari view) */
#app { position: fixed; top: 0; right: 0; bottom: 0; left: 0; overflow: auto; -webkit-overflow-scrolling: touch;
  background: #111318; }
#app iframe { display: block; width: 100%; height: 100%; border: 0; }
.hidden { display: none; }
</style></head><body>
<div id="wake">
<h1 id="h">TV de casa</h1>
<button id="b">⏻</button>
<div id="st"></div>
</div>
<div id="app" class="hidden"><iframe id="f" title="TV"></iframe></div>
<script>
// language of the phone (the remote's choice lives on another origin, so it is not visible here)
var L = (navigator.language || '').slice(0, 2), D = {
  es: { 'Encén la TV': 'Enciende la TV', 'TV de casa': 'TV de casa', 'Prem el botó per encendre-la': 'Pulsa el botón para encenderla',
    'Encesa! Obrint el comandament…': '¡Encendida! Abriendo el mando…',
    'No respon. Comprova que «Encén amb el mòbil» està activat al menú de la TV.': 'No responde. Comprueba que «Encender con el móvil» está activado en el menú de la TV.',
    'Enviant…': 'Enviando…', 'Encenent la TV…': 'Encendiendo la TV…', 'Error de connexió': 'Error de conexión',
    'Comprovant si la TV és encesa…': 'Comprobando si la TV está encendida…',
    "La TV és encesa, però el comandament no s'ha engegat. Obre l'app Homebrew Channel a la TV.": 'La TV está encendida, pero el mando no se ha iniciado. Abre la app Homebrew Channel en la TV.',
    'La TV és encesa. Engegant-hi el comandament…': 'La TV está encendida. Iniciando el mando en ella…',
    "La TV s'ha apagat. Prem el botó per tornar-la a encendre": 'La TV se ha apagado. Pulsa el botón para volver a encenderla',
    "la TV encara no s'ha registrat (ha d'estar encesa un cop amb el comandament en marxa)": 'la TV todavía no se ha registrado (tiene que estar encendida una vez con el mando en marcha)' },
  en: { 'Encén la TV': 'Turn on the TV', 'TV de casa': 'Home TV', 'Prem el botó per encendre-la': 'Press the button to turn it on',
    'Encesa! Obrint el comandament…': 'On! Opening the remote…',
    'No respon. Comprova que «Encén amb el mòbil» està activat al menú de la TV.': "It doesn't answer. Check that “Turn on via Mobile” is on in the TV menu.",
    'Enviant…': 'Sending…', 'Encenent la TV…': 'Turning on the TV…', 'Error de connexió': 'Connection error',
    'Comprovant si la TV és encesa…': 'Checking whether the TV is on…',
    "La TV és encesa, però el comandament no s'ha engegat. Obre l'app Homebrew Channel a la TV.": "The TV is on, but the remote has not started. Open the Homebrew Channel app on the TV.",
    'La TV és encesa. Engegant-hi el comandament…': 'The TV is on. Starting the remote on it…',
    "La TV s'ha apagat. Prem el botó per tornar-la a encendre": 'The TV turned off. Press the button to turn it on again',
    "la TV encara no s'ha registrat (ha d'estar encesa un cop amb el comandament en marxa)": 'the TV has not registered yet (it must be on once with the remote server running)' }
}[L === 'ca' ? '' : L === 'es' ? 'es' : 'en'] || {};
function T(s) { return D[s] || s; }
document.documentElement.lang = D['TV de casa'] ? (L === 'es' ? 'es' : 'en') : 'ca';
document.title = T('Encén la TV'); document.getElementById('h').textContent = T('TV de casa');
var b = document.getElementById('b'), st = document.getElementById('st'), f = document.getElementById('f');
var tv = null, tries = 0, upSince = 0, starting = false, waking = false, shown = false, offs = 0;
st.textContent = T('Comprovant si la TV és encesa…');
// this server checks whether the TV answers (browsers may block requests to other LAN hosts)
function check(cb) { fetch('wake/tv', { cache: 'no-store' }).then(function (r) { return r.json(); })
  .then(function (j) {
    tv = j.tv;
    // after a real boot the TV answers a minute or so before the remote has started: only a TV that
    // has been answering for a while without it is "on but no remote"
    upSince = j.up && !j.on ? upSince || Date.now() : 0;
    var stuck = upSince && Date.now() - upSince > 90000;
    starting = !!j.starting && !stuck;
    cb(j.on, stuck);
  }, function () { starting = false; cb(false, false); }); }
// the TV is on without the remote and tvlinks is opening Arrencada on it (after 20 s, then every 2 min):
// the power button would do nothing, so it is hidden and the page says what is going on
var STARTING = 'La TV és encesa. Engegant-hi el comandament…';
function showStarting() { b.style.visibility = 'hidden'; st.textContent = T(STARTING); }
// the TV is on but its remote server is not running: only opening Homebrew Channel starts it
var NOREMOTE = "La TV és encesa, però el comandament no s'ha engegat. Obre l'app Homebrew Channel a la TV.";
function openRemote() {
  if (shown || !tv) return;
  shown = true; waking = false; offs = 0;
  f.src = tv;
  document.getElementById('app').className = ''; document.getElementById('wake').className = 'hidden';
}
function closeRemote(msg) {
  shown = false; f.src = 'about:blank';
  document.getElementById('app').className = 'hidden'; document.getElementById('wake').className = '';
  b.disabled = false; b.style.visibility = ''; st.textContent = T(msg);
}
function poll() {
  check(function (on, stuck) {
    if (on) { st.textContent = T('Encesa! Obrint el comandament…'); return openRemote(); }
    // the TV answering means it woke up: wait for the remote (a real boot takes up to ~2 min) and,
    // if it does not come, tell why instead of blaming the Wake-on-LAN setting
    if (stuck) { waking = false; b.disabled = false; b.style.visibility = ''; st.textContent = T(NOREMOTE); return; }
    if (starting) showStarting();
    if (++tries > 30 && !upSince) { waking = false; b.disabled = false; st.textContent = T('No respon. Comprova que «Encén amb el mòbil» està activat al menú de la TV.'); return; }
    setTimeout(poll, 2000);
  });
}
b.onclick = function () {
  b.disabled = true; tries = 0; waking = true; st.textContent = T('Enviant…');
  fetch('wake', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (j) {
    if (j.error) { waking = false; b.disabled = false; st.textContent = T(j.error); return; }
    tv = j.tv; st.textContent = T('Encenent la TV…'); poll();
  }, function () { waking = false; b.disabled = false; st.textContent = T('Error de connexió'); });
};
// keep watching: the remote appears when the TV answers, the button when it stops answering
function watch() {
  if (document.hidden || waking) return;
  check(function (on, stuck) {
    if (on) { offs = 0; return openRemote(); }
    if (!shown) {
      if (starting) return showStarting();
      b.style.visibility = '';
      if (!b.disabled) st.textContent = T(stuck ? NOREMOTE : 'Prem el botó per encendre-la');
      return;
    }
    if (++offs >= 2) closeRemote("La TV s'ha apagat. Prem el botó per tornar-la a encendre");
  });
}
// the remote tells us when it loses the TV, so the button comes back without waiting
window.addEventListener('message', function (e) {
  if (tv && e.origin + '/' === tv && e.data === 'tv-off') { offs = 1; watch(); }
});
document.addEventListener('visibilitychange', watch);
setInterval(watch, 5000);
watch();
</script></body></html>'''

MANIFEST = {
    'name': 'TV', 'short_name': 'TV', 'start_url': '/tv', 'scope': '/', 'display': 'standalone',
    'background_color': '#111318', 'theme_color': '#111318',
    'icons': [{'src': '/tv-192.png', 'sizes': '192x192', 'type': 'image/png'},
              {'src': '/tv-512.png', 'sizes': '512x512', 'type': 'image/png'}],
}
ICONS = ('/tv-32.png', '/tv-180.png', '/tv-192.png', '/tv-512.png')


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if not ipaddress.ip_address(self.client_address[0]).is_private:
            return self.reply(403, {'error': 'només xarxa local'})
        if urllib.parse.urlsplit(self.path).path != '/wake':
            return self.reply(404, {'error': 'not found'})
        self.reply(*wake())

    def do_GET(self):
        u = urllib.parse.urlsplit(self.path)
        q = urllib.parse.parse_qs(u.query)
        if not ipaddress.ip_address(self.client_address[0]).is_private:
            return self.reply(403, {'error': 'només xarxa local'})
        if u.path in ('/', '/tv'):
            return self.reply(200, WAKE_PAGE)
        if u.path == '/tv.webmanifest':
            return self.reply(200, MANIFEST, 'application/manifest+json')
        if u.path in ICONS:
            with open(os.path.join(HERE, u.path[1:]), 'rb') as f:
                return self.reply(200, f.read(), 'image/png')
        if u.path == '/wake':
            return self.reply(*wake())
        if u.path == '/wake/tv':
            tv = load_tv()
            if not tv:
                return self.reply(200, {'tv': None, 'on': False})
            on = answers(tv['ip'], tv['port'])
            # on but no remote: the TV answers on its own LG port (3000) while the remote server is
            # not running (Homebrew Channel did not start at power-on)
            up = on or answers(tv['ip'], 3000)
            check_stuck(tv['ip'], on, up)
            return self.reply(200, {'tv': 'http://%s:%d/' % (tv['ip'], tv['port']), 'on': on, 'up': up,
                                    'starting': up and not on and os.path.exists(SSAP_KEY)})
        if u.path == '/wake/register':
            mac = (q.get('mac') or [''])[0].lower()
            port = (q.get('port') or ['8080'])[0]
            if not re.fullmatch(r'[0-9a-f]{2}(:[0-9a-f]{2}){5}', mac) or not port.isdigit():
                return self.reply(400, {'error': 'mac o port no vàlids'})
            tv = {'mac': mac, 'ip': self.client_address[0], 'port': int(port)}
            if tv != load_tv():
                with open(WAKE, 'w') as f:
                    json.dump(tv, f)
            return self.reply(200, {'ok': True})
        if u.path != '/resolve':
            return self.reply(404, {'error': 'not found'})
        link = (q.get('u') or [''])[0].strip()
        if not link.startswith(('http://', 'https://')):
            return self.reply(400, {'error': 'enllaç no vàlid'})
        try:
            code, body = resolve(link)
        except subprocess.TimeoutExpired:
            code, body = 504, {'error': 'yt-dlp ha trigat massa'}
        self.reply(code, body)

    def reply(self, code, body, ctype=None):
        if isinstance(body, bytes):
            data = body
        elif isinstance(body, str):
            data, ctype = body.encode(), 'text/html; charset=utf-8'
        else:
            data = json.dumps(body, ensure_ascii=False).encode()
            ctype = (ctype or 'application/json') + '; charset=utf-8'
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        if isinstance(body, bytes):
            self.send_header('Cache-Control', 'max-age=86400')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        sys.stderr.write('%s %s\n' % (self.log_date_time_string(), fmt % args))


if __name__ == '__main__':
    if sys.argv[1:] == ['pair']:
        tv = load_tv() or sys.exit('the TV has not registered yet')
        ssap(tv['ip'], [], pair=True)
        print('paired, key in %s' % SSAP_KEY)
        sys.exit()
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
