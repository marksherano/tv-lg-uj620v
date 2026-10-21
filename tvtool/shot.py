# shot.py OUT.png — screenshot of the debuggable page selected by $PAGE
import json, base64, os, sys, urllib.request, websocket
page = [p for p in json.load(urllib.request.urlopen('http://%s:9998/json' % os.environ.get('TV_IP', '192.168.1.37'), timeout=5)) if os.environ.get('PAGE', 'brillo') in p['url']][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=20, suppress_origin=True)
ws.send(json.dumps({'id': 1, 'method': 'Page.captureScreenshot', 'params': {}}))
while True:
    m = json.loads(ws.recv())
    if m.get('id') == 1: break
open(sys.argv[1], 'wb').write(base64.b64decode(m['result']['data'])); print('ok')
