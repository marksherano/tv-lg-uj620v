# cdp.py "<js expression>" — evaluate JS in the running Brillo+ page via webOS remote debugger
import json, sys, urllib.request, websocket, os
pages = json.load(urllib.request.urlopen('http://%s:9998/json' % os.environ.get('TV_IP', '192.168.1.37'), timeout=5))
page = [p for p in pages if __import__('os').environ.get('PAGE','brillo') in p['url']][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=10, suppress_origin=True)
ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': sys.argv[1], 'returnByValue': True}}))
while True:
    m = json.loads(ws.recv())
    if m.get('id') == 1: print(json.dumps(m.get('result'), ensure_ascii=False, indent=1)); break
