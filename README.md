# tv-lg-uj620v

**Català** · [Castellano](README.es.md)

Apps i eines casolanes per a una **LG 49UJ620V** (2017, webOS 3.9) rootejada amb
[Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel).

> ⚠️ Projecte personal, sense cap relació amb LG ni amb la CCMA/3Cat. Fes-lo servir sota la teva
> responsabilitat: modificar una TV rootejada pot deixar-la en mal estat.
> **No creïs mai `start-devmode.sh`** en firmwares recents: el sistema en verifica la signatura i,
> si falla, desactiva el mode desenvolupador i esborra `/media/developer` (totes les apps de Homebrew).

## Contingut

| Carpeta | Què és |
|---|---|
| [`brillo/`](brillo) | **Brillo+** — control de llum de fons, brillantor, contrast, color, estalvi d'energia… amb perfils (Dia, Tarda, Nit, Cinema, 3 personals) i programació horària. |
| [`cat3/`](cat3) | **3Cat Lite** — client no oficial de 3Cat per a TVs on l'app nova no és compatible: directes, guia de programació, últims vídeos, programes A–Z, cerca, subtítols, preferits i «Continuar veient». |
| [`remote/`](remote) | **Comandament web** — servidor Node que corre a la TV (port 8080) amb una pàgina per al mòbil: fletxes, volum, apps, entrades, missatges a la pantalla, pantalla off, estalvi d'energia i temporitzador d'apagada. **Teclat**: quan la TV obre un camp de text (navegador, Wi-Fi, Jellyfin Lite…) el mòbil ho avisa i el que hi escrius surt a la TV en directe. Inclou **Envia a la TV** (`/envia`: fotos, vídeos i enllaços de YouTube, 3Cat, RTVE, Atresplayer… també des del menú **Compartir** d'Android i de l'iPhone), **Estadístiques** (`/estadistiques`: temps d'ús per dia i per app) i **Estat de la TV** (`/estat`: temperatura, memòria, disc, xarxa, serveis en marxa, apps instal·lades i registres d'arrencada). |
| [`jellyfin/`](jellyfin) | **Jellyfin Lite** — client lleuger de [Jellyfin](https://jellyfin.org): inici amb «Continuar veient», «Següents capítols» i novetats, una pestanya per biblioteca (A–Z, novetats, no vistos…), sèries per temporades, fitxa amb sinopsi, cerca, subtítols i canvi d'àudio. Entra amb Quick Connect (un codi a la pantalla) o usuari i contrasenya, i desa la posició al servidor. Reprodueix directament MP4/MOV (H.264, HEVC) i WebM; la resta (MKV…) la converteix el servidor a HLS. |
| [`pantalla/`](pantalla) | **Pantalla** — app de la TV que mostra el que s'envia des del mòbil: fotos (passi automàtic) i vídeos (inclòs HEVC `.mov` de l'iPhone). |
| [`arrencada/`](arrencada) | **Arrencada** — app invisible que la TV obre sola en engegar-se i que activa els serveis de Homebrew Channel (telnet, ssh, comandament…) sense haver d'obrir-lo. |
| [`tvlinks/`](tvlinks) | **tvlinks** — servei per a un ordinador de casa sempre encès (Linux) que, amb yt-dlp, converteix enllaços de pàgines de vídeo (RTVE, clips d'Atresplayer, autonòmiques, Vimeo…) en l'adreça directa que la TV pot reproduir. El contingut amb DRM no funciona. |
| [`tvtool/`](tvtool) | Eines per a l'ordinador (Python): consola root per telnet, pujar fitxers, depurar apps per CDP, script de neteja (*debloat*). |
| [`build/make_ipk.py`](build/make_ipk.py) | Empaqueta una carpeta d'app en un `.ipk` instal·lable. |

![Brillo+](docs/brillo.png)

![3Cat Lite — guia de programació](docs/3cat-guia.png)

<img src="docs/mobil.png" alt="Comandament web al mòbil: comandament, Envia a la TV i Estadístiques" width="625">

## Requisits

- TV LG amb webOS 3.x rootejada i Homebrew Channel (telnet root al port 23).
- A l'ordinador: Python 3 amb `websocket-client` i `Pillow`.
- Les eines fan servir la IP de la variable d'entorn `TV_IP`:

```bash
export TV_IP=192.168.1.37
```

## Construir i instal·lar una app

```bash
python build/make_ipk.py brillo build/brillo.ipk
MSYS_NO_PATHCONV=1 python tvtool/push.py build/brillo.ipk /tmp/app.ipk
python tvtool/tsh.py 'luna-send -w 20000 -i luna://com.webos.appInstallService/dev/install "{\"id\":\"cat.brillo.plus\",\"ipkUrl\":\"/tmp/app.ipk\",\"subscribe\":true}"' 30
```

Les apps noves no surten soles a la barra d'inici si ja l'has editada: cal afegir `<appid>_default`
a la llista `com.webos.launcher.appordering:1` de db8 (com a `com.webos.surfacemanager`) i reiniciar.

## Scripts d'arrencada

Els scripts de `/var/lib/webosbrew/init.d/` s'executen quan corre l'script d'inici de Homebrew Channel.
En aquesta TV l'script no s'executa sol en engegar-se, i ho fa l'app **Arrencada** (o obrir a mà
Homebrew Channel). Amb «Encesa ràpida» activada, tot sobreviu a les apagades amb el comandament.

**Arrencada** (`cat.arrencada`) fa servir el mateix truc que
[webosbrew-autostart](https://github.com/webosbrew/webosbrew-autostart), sense tocar res del sistema:

- Està registrada com a «app d'entrada» (`com.webos.service.eim/addDevice`) i és l'última entrada
  desada a `/var/lib/eim`, així que la TV l'obre en engegar-se.
- En obrir-se llança `boot.sh` com a root: munta una còpia de `/var/lib/eim` a sobre (l'original no
  canvia mai més), s'amaga de la llista d'entrades, torna a l'última entrada real (o la TV) i crida
  `org.webosbrew.hbchannel.service/autostart`, que és el que fa l'app de Homebrew Channel.
- Si `restart sam` (de `debloat`) tanca l'app que s'havia obert, la torna a obrir. El registre queda a `/tmp/arrencada.log`.

Instal·lació (un cop):

```bash
python build/make_ipk.py arrencada build/arrencada.ipk
MSYS_NO_PATHCONV=1 python tvtool/push.py build/arrencada.ipk /tmp/app.ipk
python tvtool/tsh.py 'luna-send -w 20000 -i luna://com.webos.appInstallService/dev/install "{\"id\":\"cat.arrencada\",\"ipkUrl\":\"/tmp/app.ipk\",\"subscribe\":true}"' 30
python tvtool/tsh.py 'cp -a /var/lib/eim /var/lib/webosbrew/eim.backup; luna-send -n 1 luna://com.webos.service.eim/addDevice "{\"appId\":\"cat.arrencada\",\"pigImage\":\"\",\"mvpdIcon\":\"\"}"'
```

Per treure-la: `umount /var/lib/eim; cp -a /var/lib/webosbrew/eim.backup/. /var/lib/eim/; rm -rf /var/lib/webosbrew/eim`,
desinstal·lar `cat.arrencada` i reiniciar.

| Fitxer | Instal·lat a la TV com a |
|---|---|
| [`tvtool/debloat`](tvtool/debloat) | `/var/lib/webosbrew/init.d/debloat` — bloqueja dominis d'anuncis/telemetria, desactiva LivePlus i apps promocionals, amaga apps del menú |
| [`tvtool/brillo-init`](tvtool/brillo-init) | `/var/lib/webosbrew/init.d/brillo` — arrenca el servei de programació de Brillo+ |
| [`remote/remote-init`](remote/remote-init) | `/var/lib/webosbrew/init.d/remote` — arrenca el comandament web |

Per desfer qualsevol canvi: esborra el fitxer corresponent de `init.d` i reinicia la TV.

## Compartir des del mòbil

- **Android**: la pàgina del comandament és una PWA amb `share_target`, i un cop instal·lada surt com a
  «Comandament» al menú Compartir (fotos, vídeos i enllaços). Com que la TV no té HTTPS, abans cal
  afegir-ne l'adreça a `chrome://flags/#unsafely-treat-insecure-origin-as-secure` a Chrome. Els passos
  són a `/envia`.
- **iPhone**: una drecera «Envia a la TV» que envia cada element compartit a `POST /api/compartir`.
  El servidor hi accepta una foto, un vídeo o qualsevol cosa que contingui un enllaç, i les fotos que
  arriben seguides surten juntes al mateix passi. Els passos també són a `/envia`.

## Enllaços de vídeo amb yt-dlp

La TV no pot executar yt-dlp (el seu Python és massa antic), així que ho fa un altre ordinador de la
xarxa local que estigui sempre encès (un miniPC, un NAS amb Linux…) amb Python 3. Quan l'enllaç enviat
no és de YouTube, 3Cat ni un fitxer directe, el comandament demana `<servei>/resolve?u=<enllaç>` i obre
el resultat (MP4 o HLS, fins a 1080p) a Pantalla. El servei només respon a la xarxa local.

Instal·lació a l'ordinador (sense root; s'arrenca amb el `crontab` de l'usuari i yt-dlp s'actualitza cada dia):

```bash
mkdir -p ~/tvlinks && cp tvlinks/tvlinks.py tvlinks/start.sh ~/tvlinks/
curl -sSL -o ~/tvlinks/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
chmod +x ~/tvlinks/yt-dlp ~/tvlinks/start.sh
(crontab -l; echo '@reboot $HOME/tvlinks/start.sh'; echo '*/5 * * * * $HOME/tvlinks/start.sh'
 echo '30 5 * * * python3 $HOME/tvlinks/yt-dlp -U >> $HOME/tvlinks/update.log 2>&1') | crontab -
~/tvlinks/start.sh
```

A la TV, copia [`remote/config.example.json`](remote/config.example.json) com a
`/media/developer/remote/config.json` amb l'adreça d'aquest ordinador (port 8097).

## Notes tècniques (webOS 3.9)

- El navegador de les apps és Chromium 38: **només ES5** (res de `let`, `const`, fletxes…).
- `PalmSystem.platformBack()` no fa res: per sortir d'una app, `window.close()`.
- Tecles des de root: `luna://com.webos.service.networkinput/sendSpecialKey {"key":"UP"}`.
- Les apps de Homebrew poden executar ordres com a root amb `luna://org.webosbrew.hbchannel.service/exec`.
- API pública de 3Cat: `api.3cat.cat/videos`, `api.3cat.cat/programestv`, `api.3cat.cat/v2/graellatvfutur` (programació) i
  `api-media.3cat.cat/pvideo/media.jsp` (MP4 per als vídeos, HLS per als directes, subtítols VTT).

## Llicència

[MIT](LICENSE). Les dades i els continguts de 3Cat són propietat de la CCMA; aquest projecte només en consumeix l'API pública.
