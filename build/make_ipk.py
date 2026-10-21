# Builds brillo/ into an ipk (ar: debian-binary, control.tar.gz, data.tar.gz)
import io, json, os, sys, tarfile, time
from PIL import Image, ImageDraw
SRC = os.path.abspath(sys.argv[1]); OUT = sys.argv[2]
info = json.load(open(os.path.join(SRC, 'appinfo.json')))
appid, ver = info['id'], info['version']

def icon(size, path):
    im = Image.new('RGBA', (size, size), (16, 20, 24, 255)); d = ImageDraw.Draw(im)
    c, r = size / 2, size * 0.2
    for i in range(8):  # sun rays
        import math; a = i * math.pi / 4
        d.line([(c + math.cos(a) * r * 1.35, c + math.sin(a) * r * 1.35),
                (c + math.cos(a) * r * 1.9, c + math.sin(a) * r * 1.9)], fill=(255, 194, 61), width=max(2, size // 22))
    d.ellipse([c - r, c - r, c + r, c + r], fill=(255, 194, 61))
    im.save(path)
if not os.path.exists(os.path.join(SRC, 'icon.png')):
    icon(80, os.path.join(SRC, 'icon.png')); icon(130, os.path.join(SRC, 'largeIcon.png'))

def tgz(entries):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz', format=tarfile.GNU_FORMAT) as t:
        for name, data, mode in entries:
            ti = tarfile.TarInfo(name); ti.mtime = int(time.time()); ti.uid = ti.gid = 0
            if data is None: ti.type = tarfile.DIRTYPE; ti.mode = 0o755; t.addfile(ti)
            else: ti.size = len(data); ti.mode = mode; t.addfile(ti, io.BytesIO(data))
    return buf.getvalue()

base = './usr/palm/applications/' + appid
entries = []
for p in ['./usr', './usr/palm', './usr/palm/applications', base]: entries.append((p, None, 0))
for f in sorted(os.listdir(SRC)):
    data = open(os.path.join(SRC, f), 'rb').read()
    if f.endswith(('.sh', '.js', '.json', '.html', '.css')): data = data.replace(b'\r\n', b'\n')
    entries.append((base + '/' + f, data, 0o755 if f.endswith('.sh') else 0o644))
control = (f"Package: {appid}\nVersion: {ver}\nSection: misc\nPriority: optional\nArchitecture: all\n"
           f"Installed-Size: 1\nMaintainer: Marc\nDescription: {info['title']}\n").encode()
members = [('debian-binary', b'2.0\n'), ('control.tar.gz', tgz([('./control', control, 0o644)])),
           ('data.tar.gz', tgz(entries))]
with open(OUT, 'wb') as o:
    o.write(b'!<arch>\n')
    for name, data in members:
        o.write(f"{name + '/':<16}{int(time.time()):<12}{0:<6}{0:<6}{100644:<8}{len(data):<10}`\n".encode())
        o.write(data)
        if len(data) % 2: o.write(b'\n')
print(OUT, os.path.getsize(OUT), 'bytes')
