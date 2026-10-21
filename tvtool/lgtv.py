import json, sys, os, websocket
import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
KEYF = os.path.join(os.path.dirname(__file__), 'clientkey.txt')
IP = os.environ.get('TV_IP', '192.168.1.37')
MANIFEST = {'appVersion': '1.1', 'manifestVersion': 1, 'permissions': ['APP_TO_APP', 'CLOSE', 'CONTROL_AUDIO', 'CONTROL_DISPLAY', 'CONTROL_INPUT_JOYSTICK', 'CONTROL_INPUT_MEDIA_PLAYBACK', 'CONTROL_INPUT_MEDIA_RECORDING', 'CONTROL_INPUT_TEXT', 'CONTROL_INPUT_TV', 'CONTROL_MOUSE_AND_KEYBOARD', 'CONTROL_POWER', 'CONTROL_TV_SCREEN', 'LAUNCH', 'LAUNCH_WEBAPP', 'READ_APP_STATUS', 'READ_COUNTRY_INFO', 'READ_CURRENT_CHANNEL', 'READ_INPUT_DEVICE_LIST', 'READ_INSTALLED_APPS', 'READ_LGE_SDX', 'READ_LGE_TV_INPUT_EVENTS', 'READ_NETWORK_STATE', 'READ_NOTIFICATIONS', 'READ_POWER_STATE', 'READ_RUNNING_APPS', 'READ_SETTINGS', 'READ_TV_CHANNEL_LIST', 'READ_TV_CURRENT_TIME', 'READ_UPDATE_INFO', 'SEARCH', 'TEST_OPEN', 'TEST_PROTECTED', 'TEST_SECURE', 'UPDATE_FROM_REMOTE_APP', 'WRITE_NOTIFICATION_ALERT', 'WRITE_NOTIFICATION_TOAST', 'WRITE_SETTINGS']}
def connect():
    ws = websocket.create_connection(f'ws://{IP}:3000', timeout=60, suppress_origin=True)
    p = {"pairingType":"PROMPT","manifest":MANIFEST}
    if os.path.exists(KEYF): p["client-key"] = open(KEYF).read().strip()
    ws.send(json.dumps({"type":"register","id":"reg0","payload":p}))
    while True:
        m = json.loads(ws.recv())
        if m.get("type") == "registered":
            open(KEYF,'w').write(m["payload"]["client-key"]); return ws
        if m.get("type") == "error": raise SystemExit(m)
_n = [0]
def req(ws, uri, payload=None):
    _n[0] += 1; i = f"r{_n[0]}"
    ws.send(json.dumps({"type":"request","id":i,"uri":uri,"payload":payload or {}}))
    while True:
        m = json.loads(ws.recv())
        if m.get("id") == i: return m
if __name__ == '__main__':
    ws = connect()
    uri = sys.argv[1]; pl = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    print(json.dumps(req(ws, uri, pl), indent=1, ensure_ascii=False))
