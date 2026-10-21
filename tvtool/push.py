# push.py LOCAL REMOTE — upload a file to the TV over the root telnet shell
import sys, base64, hashlib
sys.path.insert(0, __import__('os').path.dirname(__file__)); import tsh
data = open(sys.argv[1], 'rb').read(); b = base64.b64encode(data).decode()
tsh.run('rm -f /tmp/push.b64', 3)
for i in range(0, len(b), 600): tsh.run(f'echo {b[i:i+600]} >> /tmp/push.b64', 2)
out = tsh.run(f'base64 -d /tmp/push.b64 > {sys.argv[2]} && md5sum {sys.argv[2]}', 5)
print('OK' if hashlib.md5(data).hexdigest() in out else 'MD5 MISMATCH: ' + out)
