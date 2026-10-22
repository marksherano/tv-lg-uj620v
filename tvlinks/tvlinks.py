#!/usr/bin/env python3
"""Turns video page links (RTVE, Atresplayer clips, regional TVs, Vimeo...) into a direct URL the TV
can play, using yt-dlp. Runs on any always-on Linux box on the LAN; the TV remote (remote/share.js) calls
GET /resolve?u=<link> and opens the result in Pantalla. Content with DRM cannot be resolved.

It also turns the TV on, since nothing on the TV answers while it is off: the TV registers itself
(GET /wake/register?mac=…&port=…, its IP is taken from the request) and GET or POST /wake sends it a
Wake-on-LAN packet ("Turn on with mobile" must be on in the TV menu). GET /tv is a page with that
button that opens the TV remote as soon as the TV answers."""
import ipaddress
import json
import os
import re
import socket
import subprocess
import sys
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


WAKE_PAGE = '''<!DOCTYPE html>
<html lang="ca"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#111318"><title>Encén la TV</title>
<style>
body { margin: 0; background: #111318; color: #e8e8ee; font: 17px system-ui, sans-serif; text-align: center; }
h1 { font-size: 22px; margin: 48px 0 8px; }
button { margin: 32px auto 16px; width: 180px; height: 180px; border-radius: 50%; border: 0; background: #c0392b;
  color: #fff; font-size: 64px; }
button:disabled { opacity: .5; }
#st { color: #9a9aa6; min-height: 2.5em; padding: 0 24px; }
a { color: #4ea3ff; }
</style></head><body>
<h1>TV de casa</h1>
<button id="b">⏻</button>
<div id="st">Prem el botó per encendre-la</div>
<script>
var b = document.getElementById('b'), st = document.getElementById('st'), tv = null, tries = 0;
// this server checks whether the TV answers (browsers may block requests to other LAN hosts)
function check(cb) { fetch('wake/tv', { cache: 'no-store' }).then(function (r) { return r.json(); })
  .then(function (j) { tv = j.tv; cb(j.on); }, function () { cb(false); }); }
function poll() {
  check(function (on) {
    if (on) { st.innerHTML = 'Encesa! Obrint el <a href="' + tv + '">comandament</a>…'; location.href = tv; return; }
    if (++tries > 30) { b.disabled = false; st.textContent = 'No respon. Comprova que «Encén amb el mòbil» està activat al menú de la TV.'; return; }
    setTimeout(poll, 2000);
  });
}
b.onclick = function () {
  b.disabled = true; tries = 0; st.textContent = 'Enviant…';
  fetch('wake', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (j) {
    if (j.error) { b.disabled = false; st.textContent = j.error; return; }
    tv = j.tv; st.textContent = 'Encenent la TV…'; poll();
  }, function () { b.disabled = false; st.textContent = 'Error de connexió'; });
};
check(function (on) { if (on) st.innerHTML = 'Ja està encesa: <a href="' + tv + '">obre el comandament</a>'; });
</script></body></html>'''


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
        if u.path == '/wake':
            return self.reply(*wake())
        if u.path == '/wake/tv':
            tv = load_tv()
            if not tv:
                return self.reply(200, {'tv': None, 'on': False})
            try:
                socket.create_connection((tv['ip'], tv['port']), timeout=1.5).close()
                on = True
            except OSError:
                on = False
            return self.reply(200, {'tv': 'http://%s:%d/' % (tv['ip'], tv['port']), 'on': on})
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

    def reply(self, code, body):
        html = isinstance(body, str)
        data = (body if html else json.dumps(body, ensure_ascii=False)).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8' if html else 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        sys.stderr.write('%s %s\n' % (self.log_date_time_string(), fmt % args))


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
