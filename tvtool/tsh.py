import socket, sys, time, re, os

class Shell:
    """Root telnet shell on the TV; one connection can run many commands."""
    def __init__(self):
        self.s = socket.create_connection((os.environ.get('TV_IP', '192.168.1.37'), 23), timeout=10)
        self.buf = b''
        self.rd(1.5)

    def rd(self, t, until=None):
        s = self.s
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
                self.buf += bytes(out)
                if until and until in self.buf: return
            except socket.timeout: pass

    def run(self, cmd, wait=4):
        self.buf = b''
        # markers are split with "" so the shell's echo of the input line doesn't match them
        self.s.send(('echo __ST""ART__; ' + cmd + '; echo __E""ND__\n').encode())
        self.rd(wait, b'__END__')
        t = self.buf.decode('utf8', 'replace').replace('\r', '')
        t = t.split('__START__\n', 1)[-1]
        return t.split('__END__')[0]

    def send_lines(self, lines):
        """Type raw lines (e.g. a heredoc body) without waiting for each one."""
        for i in range(0, len(lines), 10):
            self.s.send(''.join(l + '\n' for l in lines[i:i+10]).encode())
            self.rd(0.05)

    def close(self):
        self.s.close()

def run(cmd, wait=4):
    sh = Shell()
    try: return sh.run(cmd, wait)
    finally: sh.close()

if __name__ == '__main__':
    print(run(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 6))
