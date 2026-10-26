# install.py [--remove] WHAT...   — install (or remove) things on the TV in one step, from any console
#   apps:   brillo cat3 sx3 jellyfin pantalla arrencada  (builds the ipk, uploads it and installs it)
#   others: remote  (web remote server + its boot script)   debloat  (boot script, applied at next boot)
# Needs the root telnet shell (Homebrew Channel) and TV_IP if the TV is not at 192.168.1.37.
import json, os, re, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE); import tsh, push

APPS = ['brillo', 'cat3', 'sx3', 'jellyfin', 'pantalla', 'arrencada']
INITD = '/var/lib/webosbrew/init.d/'
REMOTE = '/media/developer/remote/'

def say(t): print(t, flush=True)

def check(ok, what):
    if not ok: sys.exit('ERROR: ' + what)

def init_script(sh, local, name, start=True):
    ok, out = push.push(os.path.join(ROOT, local), INITD + name, sh); check(ok, 'pujant ' + local + ': ' + out)
    sh.run('chmod 755 ' + INITD + name, 3)
    if start: sh.run(INITD + name, 5)

def luna(sh, uri, params, wait=10):
    # single quotes survive the shell; the JSON never contains one
    return sh.run("luna-send -n 1 %s '%s'" % (uri, json.dumps(params)), wait)

def install_call(sh, method, params, timeout=90):
    """appInstallService dev/install or dev/remove; returns the final state ('installed', 'removed', '… failed')."""
    sh.run("rm -f /tmp/inst.log; (luna-send -w %d -i luna://com.webos.appInstallService/dev/%s '%s' > /tmp/inst.log 2>&1 &)"
           % (timeout * 1000, method, json.dumps(params)), 3)
    for _ in range(timeout):
        out = sh.run('sleep 1; cat /tmp/inst.log', 4)
        states = re.findall(r'"state":\s*"([^"]+)"', out)
        if states and (states[-1] in ('installed', 'removed') or 'fail' in states[-1]): break
    sh.run('pkill -f "luna-send -w %d -i luna://com.webos.appInstallService"' % (timeout * 1000), 3)
    return states[-1] if states else (out.strip() or 'sense resposta')

def install_app(sh, folder):
    info = json.load(open(os.path.join(ROOT, folder, 'appinfo.json'), encoding='utf-8'))
    appid = info['id']
    say('%s (%s %s): empaquetant…' % (folder, appid, info['version']))
    ipk = os.path.join(tempfile.mkdtemp(), folder + '.ipk')
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'build', 'make_ipk.py'), os.path.join(ROOT, folder), ipk])
    say('  pujant a la TV…')
    ok, out = push.push(ipk, '/tmp/app.ipk', sh); check(ok, 'la pujada no coincideix: ' + out)
    say('  instal·lant…')
    st = install_call(sh, 'install', {'id': appid, 'ipkUrl': '/tmp/app.ipk', 'subscribe': True})
    sh.run('rm -f /tmp/app.ipk', 3)
    check(st == 'installed', "la TV no l'ha instal·lada: " + st)
    if folder == 'brillo':
        init_script(sh, 'tvtool/brillo-init', 'brillo')
    if folder == 'arrencada':
        # keep the untouched input list once, then make the app the last input in it (see README)
        sh.run('[ -d /var/lib/webosbrew/eim.backup ] || cp -a /var/lib/eim /var/lib/webosbrew/eim.backup', 5)
        init_script(sh, 'tvtool/arrencada-init', 'arrencada', start=False)
        out = sh.run('sh /media/developer/apps/usr/palm/applications/%s/arm.sh' % appid, 15)
        check('arm: ok' in out, "no s'ha pogut fer que la TV l'obri en engegar-se:\n" + out)
    say('  fet. Si és nova i no surt a la barra d\'inici, mira el README.')

def remove_app(sh, folder):
    appid = json.load(open(os.path.join(ROOT, folder, 'appinfo.json'), encoding='utf-8'))['id']
    say('%s (%s): desinstal·lant…' % (folder, appid))
    if folder == 'brillo':
        sh.run('rm -f %sbrillo; pkill -f cat.brillo.plus/daemon.sh' % INITD, 5)
    if folder == 'arrencada':
        sh.run('rm -f %sarrencada; umount /var/lib/eim 2>/dev/null; [ -d /var/lib/webosbrew/eim.backup ] && '
               'cp -a /var/lib/webosbrew/eim.backup/. /var/lib/eim/ && rm -rf /var/lib/webosbrew/eim' % INITD, 10)
    st = install_call(sh, 'remove', {'id': appid, 'subscribe': True})
    check(st == 'removed', "la TV no l'ha desinstal·lada: " + st)
    say('  fet.' + (' Reinicia la TV.' if folder == 'arrencada' else ''))

def install_remote(sh):
    sh.run('mkdir -p ' + REMOTE, 3)
    files = [f for f in sorted(os.listdir(os.path.join(ROOT, 'remote')))
             if f != 'remote-init' and not f.startswith('config')]
    for f in files:
        say('remote: pujant ' + f + '…')
        ok, out = push.push(os.path.join(ROOT, 'remote', f), REMOTE + f, sh); check(ok, f + ': ' + out)
    init_script(sh, 'remote/remote-init', 'remote')
    out = sh.run('sleep 3; cat /tmp/remote.log', 8)
    check('listening' in out, "el servidor no s'ha engegat:\n" + out)
    say('remote: en marxa a http://%s:8080/' % os.environ.get('TV_IP', '192.168.1.37'))

def remove_remote(sh):
    sh.run('rm -f %sremote; pkill -f remote/server.js; rm -rf %s' % (INITD, REMOTE), 5)
    say('remote: aturat i esborrat (les fotos i vídeos compartits de /media/developer/share es queden).')

def install_debloat(sh):
    init_script(sh, 'tvtool/debloat', 'debloat', start=False)
    say("debloat: instal·lat; s'aplica en reiniciar la TV.")

def remove_debloat(sh):
    sh.run('rm -f %sdebloat' % INITD, 3)
    say('debloat: esborrat; reinicia la TV per desfer-ho tot.')

ACTIONS = {'remote': (install_remote, remove_remote), 'debloat': (install_debloat, remove_debloat)}

if __name__ == '__main__':
    args = sys.argv[1:]; remove = '--remove' in args; args = [a for a in args if a != '--remove']
    bad = [a for a in args if a not in APPS and a not in ACTIONS]
    if not args or bad:
        sys.exit(__doc__ or open(__file__, encoding='utf-8').read().split('\nimport')[0])
    try: sh = tsh.Shell()
    except OSError: sys.exit('ERROR: no hi ha telnet a %s:23. Està encesa la TV? Obre Homebrew Channel i torna-ho a provar.'
                             % os.environ.get('TV_IP', '192.168.1.37'))
    try:
        for a in args:
            if a in APPS: (remove_app if remove else install_app)(sh, a)
            else: ACTIONS[a][1 if remove else 0](sh)
    finally:
        sh.close()
