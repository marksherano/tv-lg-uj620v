# tv-lg-uj620v

[Català](README.md) · **Castellano**

Apps y herramientas caseras para una **LG 49UJ620V** (2017, webOS 3.9) rooteada con
[Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel).

> ⚠️ Proyecto personal, sin ninguna relación con LG ni con la CCMA/3Cat. Úsalo bajo tu propia
> responsabilidad: modificar una TV rooteada puede dejarla en mal estado.
> **No crees nunca `start-devmode.sh`** en firmwares recientes: el sistema verifica su firma y,
> si falla, desactiva el modo desarrollador y borra `/media/developer` (todas las apps de Homebrew).

## Contenido

| Carpeta | Qué es |
|---|---|
| [`brillo/`](brillo) | **Brillo+** — control de retroiluminación, brillo, contraste, color, ahorro de energía… con perfiles (Día, Tarde, Noche, Cine, 3 personales) y programación horaria. |
| [`cat3/`](cat3) | **3Cat Lite** — cliente no oficial de 3Cat para TVs en las que la app nueva no es compatible: directos, guía de programación, últimos vídeos, programas A–Z, búsqueda, subtítulos, favoritos y «Seguir viendo». |
| [`remote/`](remote) | **Mando web** — servidor Node que corre en la TV (puerto 8080) con una página para el móvil: flechas, volumen, apps, entradas, escribir texto, mensajes en pantalla, apagar pantalla, ahorro de energía y temporizador de apagado. Incluye **Enviar a la TV** (`/envia`: fotos, vídeos y enlaces de YouTube, 3Cat, RTVE, Atresplayer… desde el móvil, también con un atajo del iPhone) y **Estadísticas** (`/estadistiques`: tiempo de uso por día y por app). |
| [`pantalla/`](pantalla) | **Pantalla** — app de la TV que muestra lo que se envía desde el móvil: fotos (pase automático) y vídeos (incluido HEVC `.mov` del iPhone). |
| [`arrencada/`](arrencada) | **Arrencada** — app invisible que la TV abre sola al encenderse y que activa los servicios de Homebrew Channel (telnet, ssh, mando…) sin tener que abrirlo. |
| [`firebat/`](firebat) | **tvlinks** — servicio para el miniPC de casa que, con yt-dlp, convierte enlaces de páginas de vídeo (RTVE, clips de Atresplayer, autonómicas, Vimeo…) en la dirección directa que la TV puede reproducir. El contenido con DRM no funciona. |
| [`tvtool/`](tvtool) | Herramientas para el ordenador (Python): consola root por telnet, subir archivos, depurar apps por CDP, script de limpieza (*debloat*). |
| [`build/make_ipk.py`](build/make_ipk.py) | Empaqueta una carpeta de app en un `.ipk` instalable. |

![Brillo+](docs/brillo.png)

Las interfaces de las apps están en catalán.

## Requisitos

- TV LG con webOS 3.x rooteada y Homebrew Channel (telnet root en el puerto 23).
- En el ordenador: Python 3 con `websocket-client` y `Pillow`.
- Las herramientas usan la IP de la variable de entorno `TV_IP`:

```bash
export TV_IP=192.168.1.37
```

## Construir e instalar una app

```bash
python build/make_ipk.py brillo build/brillo.ipk
MSYS_NO_PATHCONV=1 python tvtool/push.py build/brillo.ipk /tmp/app.ipk
python tvtool/tsh.py 'luna-send -w 20000 -i luna://com.webos.appInstallService/dev/install "{\"id\":\"cat.brillo.plus\",\"ipkUrl\":\"/tmp/app.ipk\",\"subscribe\":true}"' 30
```

Las apps nuevas no aparecen solas en la barra de inicio si ya la has editado: hay que añadir
`<appid>_default` a la lista `com.webos.launcher.appordering:1` de db8 (como
`com.webos.surfacemanager`) y reiniciar.

## Scripts de arranque

Los scripts de `/var/lib/webosbrew/init.d/` se ejecutan cuando corre el script de inicio de
Homebrew Channel. En esta TV el script no se ejecuta solo al encenderse, y lo hace la app
**Arrencada** (o abrir a mano Homebrew Channel). Con «Inicio rápido» activado, todo sobrevive a los
apagados con el mando.

**Arrencada** (`cat.arrencada`) usa el mismo truco que
[webosbrew-autostart](https://github.com/webosbrew/webosbrew-autostart), sin tocar nada del sistema:

- Está registrada como «app de entrada» (`com.webos.service.eim/addDevice`) y es la última entrada
  guardada en `/var/lib/eim`, así que la TV la abre al encenderse.
- Al abrirse lanza `boot.sh` como root: monta una copia de `/var/lib/eim` encima (el original ya no
  cambia nunca), se oculta de la lista de entradas, vuelve a la última entrada real (o la TV) y llama a
  `org.webosbrew.hbchannel.service/autostart`, que es lo que hace la app de Homebrew Channel.
- Si `restart sam` (de `debloat`) cierra la app que se había abierto, la vuelve a abrir. El registro queda en `/tmp/arrencada.log`.

Instalación (una vez):

```bash
python build/make_ipk.py arrencada build/arrencada.ipk
MSYS_NO_PATHCONV=1 python tvtool/push.py build/arrencada.ipk /tmp/app.ipk
python tvtool/tsh.py 'luna-send -w 20000 -i luna://com.webos.appInstallService/dev/install "{\"id\":\"cat.arrencada\",\"ipkUrl\":\"/tmp/app.ipk\",\"subscribe\":true}"' 30
python tvtool/tsh.py 'cp -a /var/lib/eim /var/lib/webosbrew/eim.backup; luna-send -n 1 luna://com.webos.service.eim/addDevice "{\"appId\":\"cat.arrencada\",\"pigImage\":\"\",\"mvpdIcon\":\"\"}"'
```

Para quitarla: `umount /var/lib/eim; cp -a /var/lib/webosbrew/eim.backup/. /var/lib/eim/; rm -rf /var/lib/webosbrew/eim`,
desinstalar `cat.arrencada` y reiniciar.

| Archivo | Instalado en la TV como |
|---|---|
| [`tvtool/debloat`](tvtool/debloat) | `/var/lib/webosbrew/init.d/debloat` — bloquea dominios de anuncios/telemetría, desactiva LivePlus y apps promocionales, oculta apps del menú |
| [`tvtool/brillo-init`](tvtool/brillo-init) | `/var/lib/webosbrew/init.d/brillo` — arranca el servicio de programación de Brillo+ |
| [`remote/remote-init`](remote/remote-init) | `/var/lib/webosbrew/init.d/remote` — arranca el mando web |

Para deshacer cualquier cambio: borra el archivo correspondiente de `init.d` y reinicia la TV.

## Enlaces de vídeo con yt-dlp (miniPC)

La TV no puede ejecutar yt-dlp (Python 2.7 y sistema ARM *soft-float*), así que lo hace el miniPC de
casa (`firebat`, 192.168.1.157, Ubuntu). Cuando el enlace enviado no es de YouTube, 3Cat ni un archivo
directo, el mando pide `http://192.168.1.157:8097/resolve?u=<enlace>` y abre el resultado (MP4 o HLS,
hasta 1080p) en Pantalla. Solo responde a la red local.

Instalación en el miniPC (sin root; se arranca con el `crontab` del usuario y yt-dlp se actualiza cada día):

```bash
mkdir -p ~/tvlinks && cp firebat/tvlinks.py firebat/start.sh ~/tvlinks/
curl -sSL -o ~/tvlinks/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
chmod +x ~/tvlinks/yt-dlp ~/tvlinks/start.sh
(crontab -l; echo '@reboot $HOME/tvlinks/start.sh'; echo '*/5 * * * * $HOME/tvlinks/start.sh'
 echo '30 5 * * * python3 $HOME/tvlinks/yt-dlp -U >> $HOME/tvlinks/update.log 2>&1') | crontab -
~/tvlinks/start.sh
```

## Notas técnicas (webOS 3.9)

- El navegador de las apps es Chromium 38: **solo ES5** (nada de `let`, `const`, funciones flecha…).
- `PalmSystem.platformBack()` no hace nada: para salir de una app, `window.close()`.
- Teclas desde root: `luna://com.webos.service.networkinput/sendSpecialKey {"key":"UP"}`.
- Las apps de Homebrew pueden ejecutar órdenes como root con `luna://org.webosbrew.hbchannel.service/exec`.
- API pública de 3Cat: `api.3cat.cat/videos`, `api.3cat.cat/programestv`, `api.3cat.cat/v2/graellatvfutur` (programación) y
  `api-media.3cat.cat/pvideo/media.jsp` (MP4 para los vídeos, HLS para los directos, subtítulos VTT).

## Licencia

[MIT](LICENSE). Los datos y contenidos de 3Cat son propiedad de la CCMA; este proyecto solo consume su API pública.
