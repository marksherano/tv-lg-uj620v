# key.py CODE [CODE...] — send remote keys (keyCodes) to the Brillo+ page via remote debugger
import json, sys, time, urllib.request, websocket, os
pages = json.load(urllib.request.urlopen('http://%s:9998/json' % os.environ.get('TV_IP', '192.168.1.37'), timeout=5))
page = [p for p in pages if __import__('os').environ.get('PAGE','brillo') in p['url']][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=10, suppress_origin=True)
n = 0
for code in sys.argv[1:]:
    for t in ('rawKeyDown', 'keyUp'):
        n += 1
        ws.send(json.dumps({'id': n, 'method': 'Input.dispatchKeyEvent',
                            'params': {'type': t, 'windowsVirtualKeyCode': int(code), 'nativeVirtualKeyCode': int(code)}}))
        while json.loads(ws.recv()).get('id') != n: pass
    time.sleep(0.3)
