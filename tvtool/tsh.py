import socket, sys, time, re, os
def run(cmd, wait=4):
    s = socket.create_connection((os.environ.get('TV_IP', '192.168.1.37'), 23), timeout=10)
    buf = b''
    def rd(t):
        nonlocal buf
        end = time.time() + t
        s.settimeout(0.3)
        while time.time() < end:
            try:
                d = s.recv(65536)
                if not d: break
                out = bytearray(); i = 0
                while i < len(d):
                    if d[i] == 255 and i + 2 < len(d):
                        c, o = d[i+1], d[i+2]
                        if c in (251, 252): s.send(bytes([255, 254, o]))
                        elif c in (253, 254): s.send(bytes([255, 252, o]))
                        i += 3
                    else: out.append(d[i]); i += 1
                buf += bytes(out)
                if b'__END__' in buf: return
            except socket.timeout: pass
    rd(1.5)
    buf = b''
    # markers are split with "" so the shell's echo of the input line doesn't match them
    s.send(('echo __ST""ART__; ' + cmd + '; echo __E""ND__\n').encode())
    rd(wait)
    s.close()
    t = buf.decode('utf8', 'replace').replace('\r', '')
    t = t.split('__START__\n', 1)[-1]
    return t.split('__END__')[0]
if __name__ == '__main__':
    print(run(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 6))
