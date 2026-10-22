#!/usr/bin/env python3
"""Turns video page links (RTVE, Atresplayer clips, regional TVs, Vimeo...) into a direct URL the TV
can play, using yt-dlp. Runs on any always-on Linux box on the LAN; the TV remote (remote/share.js) calls
GET /resolve?u=<link> and opens the result in Pantalla. Content with DRM cannot be resolved."""
import ipaddress
import json
import os
import subprocess
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8097
HERE = os.path.dirname(os.path.abspath(__file__))
YTDLP = os.path.join(HERE, 'yt-dlp')  # zipapp, kept up to date by `yt-dlp -U` from cron
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


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        u = urllib.parse.urlsplit(self.path)
        if not ipaddress.ip_address(self.client_address[0]).is_private:
            return self.reply(403, {'error': 'només xarxa local'})
        if u.path != '/resolve':
            return self.reply(404, {'error': 'not found'})
        link = (urllib.parse.parse_qs(u.query).get('u') or [''])[0].strip()
        if not link.startswith(('http://', 'https://')):
            return self.reply(400, {'error': 'enllaç no vàlid'})
        try:
            code, body = resolve(link)
        except subprocess.TimeoutExpired:
            code, body = 504, {'error': 'yt-dlp ha trigat massa'}
        self.reply(code, body)

    def reply(self, code, body):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        sys.stderr.write('%s %s\n' % (self.log_date_time_string(), fmt % args))


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
