# push.py LOCAL REMOTE — upload a file to the TV over the root telnet shell
# (base64 typed into a heredoc on one connection, then checked with md5sum)
import sys, base64, hashlib, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import tsh

def push(local, remote, sh=None):
    data = open(local, 'rb').read(); b = base64.b64encode(data).decode()
    own = sh is None
    if own: sh = tsh.Shell()
    try:
        sh.send_lines(["cat > /tmp/push.b64 <<'__B64__'"] + [b[i:i+76] for i in range(0, len(b), 76)] + ['__B64__'])
        out = sh.run(f'base64 -d /tmp/push.b64 > {remote} && md5sum {remote}; rm -f /tmp/push.b64', 10)
    finally:
        if own: sh.close()
    return hashlib.md5(data).hexdigest() in out, out

if __name__ == '__main__':
    ok, out = push(sys.argv[1], sys.argv[2])
    print('OK' if ok else 'MD5 MISMATCH: ' + out)
    sys.exit(0 if ok else 1)
