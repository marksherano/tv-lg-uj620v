# tv-lg-uj620v

[English](README.md) · [Català](README.ca.md) · **Castellano**

Apps y herramientas caseras para una **LG 49UJ620V** (2017, webOS 3.9) rooteada con
[Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel).

> ⚠️ Proyecto personal, sin ninguna relación con LG ni con la CCMA/3Cat. Úsalo bajo tu propia
> responsabilidad: modificar una TV rooteada puede dejarla en mal estado.
> **No crees nunca `start-devmode.sh`** en firmwares recientes: el sistema verifica su firma y,
> si falla, desactiva el modo desarrollador y borra `/media/developer` (todas las apps de Homebrew).

> 🔒 **Solo para una red local de confianza.** Con Homebrew Channel la TV abre un telnet root
> **sin contraseña** en el puerto 23, y el mando web (puerto 8080) no pide ninguna clave: cualquier
> aparato de la red puede controlar la TV. No abras nunca los puertos 23, 8080 ni 3000 a Internet
> (ninguna redirección de puertos en el router ni DMZ) y no conectes la TV a redes Wi-Fi compartidas o
> públicas. El mando solo acepta las acciones por `POST` y desde sus propias páginas, para que una web
> cualquiera abierta en un móvil de casa no pueda pulsar teclas ni apagar la TV.

## Contenido

| Carpeta | Qué es |
|---|---|
| [`brillo/`](brillo) | **Brillo+** — control de retroiluminación, brillo, contraste, color, ahorro de energía… con perfiles (Día, Tarde, Noche, Cine, 3 personales) y programación horaria. |
| [`cat3/`](cat3) | **3Cat Lite** — cliente no oficial de 3Cat para TVs en las que la app nueva no es compatible: directos, guía de programación, últimos vídeos, programas A–Z, búsqueda, subtítulos, favoritos, «Seguir viendo» y capítulo siguiente automático (cuenta atrás de 10 s al acabar). |
| [`sx3/`](sx3) | **SX3 Lite** — solo el canal infantil de 3Cat, más ligera que la app oficial: SX3 en directo con la programación del día, series para los pequeños y para los mayores (solo las que tienen capítulos), últimos capítulos, búsqueda, «Mis series», «Seguir viendo» y capítulo siguiente automático. Todo el texto en mayúsculas, más fácil para los niños que aprenden a leer. |
| [`remote/`](remote) | **Mando web** — servidor Node que corre en la TV (puerto 8080) con una página para el móvil organizada como el mando de LG (flechas, volumen, canales, teclas de colores y números, ajustes, lista de entradas, teletexto…; las teclas actúan al levantar el dedo, así que desplazar la página o el gesto de inicio del iPhone no pulsan ninguna), apps, entradas, mensajes en pantalla, apagar pantalla, ahorro de energía, temporizador de apagado y **encender la TV** (Wake-on-LAN a través de tvlinks). **Teclado**: cuando la TV abre un campo de texto (navegador, Wi-Fi, Jellyfin Lite…) el móvil lo avisa y lo que escribes sale en la TV en directo. Incluye **Enviar a la TV** (`/envia`: varias fotos y vídeos a la vez y enlaces de YouTube, 3Cat, RTVE, Atresplayer… también desde el menú **Compartir** de Android y del iPhone), **Enviados** (`/enviats`: revisar, volver a abrir y borrar lo enviado, uno a uno, una selección o todo), **Estadísticas** (`/estadistiques`: tiempo de uso por día y por app) y **Estado de la TV** (`/estat`: temperatura, memoria, disco, red, servicios en marcha, apps instaladas y registros de arranque). |
| [`jellyfin/`](jellyfin) | **Jellyfin Lite** — cliente ligero de [Jellyfin](https://jellyfin.org): inicio con «Seguir viendo», «Siguientes capítulos» y novedades, una pestaña por biblioteca (A–Z, novedades, no vistos…), series por temporadas, ficha con sinopsis, búsqueda, subtítulos, cambio de audio, botón para saltar la intro y los créditos y capítulo siguiente automático. Entra con Quick Connect (un código en pantalla) o usuario y contraseña, y guarda la posición en el servidor. Reproduce directamente MP4/MOV (H.264, HEVC) y WebM; el resto (MKV…) lo convierte el servidor a HLS. |
| [`pantalla/`](pantalla) | **Pantalla** — app de la TV que muestra lo que se envía desde el móvil: fotos (pase automático) y vídeos (incluido HEVC `.mov` del iPhone). |
| [`arrencada/`](arrencada) | **Arrencada** — app invisible que la TV abre sola al encenderse y que activa los servicios de Homebrew Channel (telnet, ssh, mando…) sin tener que abrirlo. |
| [`tvlinks/`](tvlinks) | **tvlinks** — servicio para un ordenador de casa siempre encendido (Linux) que, con yt-dlp, convierte enlaces de páginas de vídeo (RTVE, clips de Atresplayer, autonómicas, Vimeo…) en la dirección directa que la TV puede reproducir (el contenido con DRM no funciona). También enciende la TV desde el móvil. |
| [`tvtool/`](tvtool) | Herramientas para el ordenador (Python): instalador en un solo paso (`install.py`), consola root por telnet, subir archivos, depurar apps por CDP, script de limpieza (*debloat*). |
| [`build/make_ipk.py`](build/make_ipk.py) | Empaqueta una carpeta de app en un `.ipk` instalable. |

![Brillo+](docs/brillo.png)

![3Cat Lite — guía de programación](docs/3cat-guia.png)

![Jellyfin Lite — biblioteca de películas](docs/jellyfin.jpg)

<img src="docs/mobil.png" alt="Mando web en el móvil: mando con el aviso del teclado, Enviar a la TV, Estadísticas y Estado de la TV" width="830">

## Idiomas

Las apps y el mando web están en **catalán, castellano e inglés**. Empiezan en el idioma de la TV
(o del móvil), o en inglés si no es ninguno de estos, y recuerdan el que elijas:

| App | Dónde se cambia |
|---|---|
| Brillo+ | Fila **Idioma**, al final de la columna derecha (◀ ▶) |
| 3Cat Lite, SX3 Lite | Última pestaña de la barra de arriba (OK) |
| Jellyfin Lite | Pestaña **Ajustes** → **Idioma** |
| Mando web | Selector al pie de cada página; los avisos que salen en la TV siguen el idioma del móvil |
| Pantalla | Usa el idioma del móvil que envía las fotos |

## Cómo rootear la TV

Todo esto necesita root y [Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel).
Antes de nada, comprueba tu modelo y firmware en [CanI.RootMy.TV](https://cani.rootmy.tv). Métodos conocidos
según [webosbrew.org](https://www.webosbrew.org/rooting/) (consultado en octubre de 2026):

| Método | webOS | Estado |
|---|---|---|
| [DejaVuln](https://github.com/throwaway96/dejavuln-autoroot) | 3.5 y posteriores | **El que toca para esta TV.** webOS 3.5 y 4.0 no tienen parche y es muy probable que no lo reciban nunca; el firmware reciente de la mayoría de webOS 5+ y todo webOS 9 sí están parcheados. |
| [faultmanager](https://github.com/throwaway96/faultmanager-autoroot) | 4.0 y posteriores (incluido webOS 9) | Sin parche conocido. No sirve para webOS 3.x. |
| [WTA](https://www.webosbrew.org/rooting/wta) | — | Parcheado en actualizaciones recientes. |
| [crashd](https://gist.github.com/throwaway96/e811b0f7cc2a705a5a476a8dfa45e09f) | — | Parcheado en abril de 2024. |
| [RootMy.TV](https://rootmy.tv) | 3 a 6 | Parcheado en 2022; seguramente ya no funciona. |
| [GetMeNow](https://www.webosbrew.org/rooting/getmenow) | Algunos modelos de 1 a 3 | No funciona desde que se actualizó la app Developer Mode a principios de 2024. |
| [NVM](https://gist.github.com/throwaway96/827ff726981cc2cbc46a22a2ad7337a1) | Anteriores a 4.0 | Modificación de hardware: hay que abrir la TV y hay alta tensión. Solo como último recurso. |

Con DejaVuln, resumido de [sus instrucciones](https://github.com/throwaway96/dejavuln-autoroot#instructions):

1. Descarga la última versión (no el «Source code») y descomprímela en la raíz de un USB con una
   sola partición FAT32 o NTFS, sin ninguna carpeta de por medio.
2. Conéctalo a la TV (que sea el único USB), ábrelo con la app de **Música** o el reproductor
   multimedia, entra en la carpeta `lol$(sh$IFS$(find$IFS/tmp` e intenta reproducir el archivo `.mp3`
   que hay. Es normal que salga un error diciendo que no se puede reproducir.
3. Cuando los avisos digan que el root se ha completado, quita el USB. Si no ves Homebrew Channel,
   reinicia la TV con el inicio rápido desactivado.

Con la TV rooteada, **no instales la app Developer Mode de LG** (si la tienes, bórrala antes de
reiniciar) y **no actualices el firmware**: el root podría desaparecer y quizá no se podría volver a hacer.

## Requisitos

- TV LG con webOS 3.x rooteada y Homebrew Channel (telnet root en el puerto 23).
- En el ordenador: Python 3 con `websocket-client` y `Pillow`.
- Las herramientas usan la IP de la variable de entorno `TV_IP` (si no está, `192.168.1.37`):

| Consola | Orden |
|---|---|
| PowerShell | `$env:TV_IP = "192.168.1.37"` |
| CMD | `set TV_IP=192.168.1.37` |
| Bash (Linux, macOS, Git Bash) | `export TV_IP=192.168.1.37` |

## Instalar

Una sola orden empaqueta, sube e instala lo que le digas, y es igual en cualquier consola:

```bash
python tvtool/install.py brillo cat3
```

| Nombre | Qué instala |
|---|---|
| `brillo` | Brillo+ y su servicio de programación (`init.d/brillo`) |
| `cat3`, `sx3`, `jellyfin`, `pantalla` | La app correspondiente |
| `arrencada` | Arrencada; la primera vez guarda una copia de `/var/lib/eim` y la registra como entrada |
| `remote` | El mando web en `/media/developer/remote/` y su `init.d/remote` (el `config.json` de la TV no se toca); lo arranca |
| `debloat` | El script de limpieza en `init.d/debloat`; se aplica al reiniciar |

Para volver a instalar una app con cambios, sube antes el `version` de su `appinfo.json`.

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

Se instala con `python tvtool/install.py arrencada` (para quitarla, ver [Desinstalar y recuperar](#desinstalar-y-recuperar)).

| Archivo | Instalado en la TV como |
|---|---|
| [`tvtool/debloat`](tvtool/debloat) | `/var/lib/webosbrew/init.d/debloat` — bloquea dominios de anuncios/telemetría, desactiva LivePlus y apps promocionales, oculta apps del menú |
| [`tvtool/brillo-init`](tvtool/brillo-init) | `/var/lib/webosbrew/init.d/brillo` — arranca el servicio de programación de Brillo+ |
| [`remote/remote-init`](remote/remote-init) | `/var/lib/webosbrew/init.d/remote` — arranca el mando web |

Para deshacer cualquier cambio: borra el archivo correspondiente de `init.d` y reinicia la TV.

## Desinstalar y recuperar

Nada de este proyecto toca el firmware: las apps son apps de desarrollador normales y los scripts de
arranque solo hacen cambios que desaparecen al reiniciar. Todo se deshace con `--remove`:

```bash
python tvtool/install.py --remove brillo cat3 sx3 jellyfin pantalla remote debloat arrencada
```

| Qué | Qué hace `--remove` | Qué queda |
|---|---|---|
| Apps | Las desinstala; `brillo` también quita `init.d/brillo` | Nada (los perfiles de Brillo+ de `/media/developer/brillo/` se pueden borrar a mano) |
| `remote` | Para el servidor y borra `/media/developer/remote/` e `init.d/remote` | Los archivos compartidos de `/media/developer/share/` |
| `debloat` | Borra `init.d/debloat`; **hay que reiniciar** para que vuelvan las apps y los dominios bloqueados | LivePlus y la cookie de anuncios quedan apagados; se vuelven a activar en la configuración de la TV |
| `arrencada` | Desmonta `/var/lib/eim`, devuelve la copia `/var/lib/webosbrew/eim.backup` y desinstala la app; **hay que reiniciar** | Nada |

Si algo va mal:

- **La TV arranca pero no hay telnet (puerto 23).** El script de Homebrew Channel no se ha ejecutado:
  abre la app **Homebrew Channel** y vuelve a probar. Si tienes Arrencada, mira `/tmp/arrencada.log` una vez dentro.
- **Una app no se abre o se queda en negro.** Vuelve a instalarla o desinstálala; no afecta a nada más.
- **La TV hace cosas raras después de arrancar.** Entra por telnet, quita los scripts de
  `/var/lib/webosbrew/init.d/` de uno en uno y reinicia cada vez para encontrar al culpable, con
  `luna-send -n 1 luna://com.webos.service.tvpower/power/reboot '{"reason":"reset"}'` (la orden `reboot` no hace nada en esta TV).
- **Homebrew Channel ha desaparecido** (actualización de firmware, app Developer Mode de LG…).
  Las apps de este proyecto dejan de funcionar pero la TV sigue bien; vuelve a rootearla
  (ver [Cómo rootear la TV](#cómo-rootear-la-tv)).
- **Para quitar también el root y Homebrew Channel**, desinstálalo todo como arriba y sigue las
  instrucciones de [webosbrew.org](https://www.webosbrew.org/).

## Compartir desde el móvil

- **Android**: la página del mando es una PWA con `share_target`, y una vez instalada aparece como
  «Mando» en el menú Compartir (fotos, vídeos y enlaces). Como la TV no tiene HTTPS, antes hay
  que añadir su dirección en `chrome://flags/#unsafely-treat-insecure-origin-as-secure` en Chrome. Los
  pasos están en `/envia`.
- **iPhone**: un atajo «Envia a la TV» que manda cada elemento compartido a `POST /api/compartir`.
  El servidor acepta una foto, un vídeo o cualquier cosa que contenga un enlace, y las fotos que
  llegan seguidas salen juntas en el mismo pase. Los pasos también están en `/envia`.
- Todo lo enviado (archivos y los 50 últimos enlaces) aparece en `/enviats`, donde se puede volver a
  abrir en la TV o borrar. Los archivos también se borran solos a los 7 días.

## Enlaces de vídeo con yt-dlp

La TV no puede ejecutar yt-dlp (su Python es demasiado antiguo), así que lo hace otro ordenador de la
red local que esté siempre encendido (un miniPC, un NAS con Linux…) con Python 3. Cuando el enlace
enviado no es de YouTube, 3Cat ni un archivo directo, el mando pide `<servicio>/resolve?u=<enlace>` y
abre el resultado (MP4 o HLS, hasta 1080p) en Pantalla. El servicio solo responde a la red local.

Instalación en el ordenador (sin root; se arranca con el `crontab` del usuario y yt-dlp se actualiza cada día):

```bash
mkdir -p ~/tvlinks && cp tvlinks/tvlinks.py tvlinks/start.sh ~/tvlinks/
curl -sSL -o ~/tvlinks/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
chmod +x ~/tvlinks/yt-dlp ~/tvlinks/start.sh
(crontab -l; echo '@reboot $HOME/tvlinks/start.sh'; echo '*/5 * * * * $HOME/tvlinks/start.sh'
 echo '30 5 * * * python3 $HOME/tvlinks/yt-dlp -U >> $HOME/tvlinks/update.log 2>&1') | crontab -
~/tvlinks/start.sh
```

En la TV, copia [`remote/config.example.json`](remote/config.example.json) como
`/media/developer/remote/config.json` con la dirección de ese ordenador (puerto 8097).

### Encender la TV desde el móvil

Con la TV apagada no hay ningún servidor que responda, así que la enciende tvlinks con un paquete
Wake-on-LAN. Hay que tener activado en el menú de la TV *Red → Encender con el móvil* (`wolwowlOnOff`).
El mando le pasa la MAC de la TV al arrancar (`/wake/register`; tvlinks la guarda en `wake.json`, fuera
del repositorio). La página `<servicio>/tv` es la app para poner en la pantalla de inicio del móvil
(«TV», con icono propio): mientras la TV responde muestra el mando dentro, y cuando está apagada, el
botón de encender; lo comprueba cada 5 s, así que encender o apagar la TV desde donde sea la hace
cambiar. El mando abierto por sí solo va allí cuando la TV deja de responder, y en Android la app del
mando instalada va allí sola si la TV no responde. Para un atajo del iPhone basta con `GET <servicio>/wake`.

### Saltar la intro en Jellyfin Lite

Jellyfin Lite usa los segmentos del servidor (`/MediaSegments`, Jellyfin 10.10 o posterior), que rellena
un complemento como [Intro Skipper](https://github.com/intro-skipper/intro-skipper). Si no hay, mira si
los capítulos del archivo se llaman «Intro», «Opening», «Credits»… Cuando empiezan los créditos de un
capítulo (o cuando acaba), propone el siguiente con una cuenta atrás de 10 s.

## Notas técnicas (webOS 3.9)

- El navegador de las apps es Chromium 38: **solo ES5** (nada de `let`, `const`, funciones flecha…).
- `PalmSystem.platformBack()` no hace nada: para salir de una app, `window.close()`.
- Teclas desde root: `luna://com.webos.service.networkinput/sendSpecialKey {"key":"UP"}`. Los nombres
  que conoce están en `strings /usr/sbin/network-input-service` (`QMENU`, `LIST`, `TELETEXT`, `TEXTOPTION`,
  `ASPECT_RATIO`, `LIVE_ZOOM`, `RECORD`…); no hay ninguno para subtítulos, AD ni búsqueda. La lista de
  entradas es la app `com.webos.app.inputmgr`.
- Las apps de Homebrew pueden ejecutar órdenes como root con `luna://org.webosbrew.hbchannel.service/exec`.
- API pública de 3Cat: `api.3cat.cat/videos`, `api.3cat.cat/programestv`, `api.3cat.cat/v2/graellatvfutur` (programación) y
  `api-media.3cat.cat/pvideo/media.jsp` (MP4 para los vídeos, HLS para los directos, subtítulos VTT).
- Textos: cada app tiene un `i18n.js` con el mismo núcleo pequeño (`T()`, `translatePage()`) y sus
  tablas de castellano e inglés; el código conserva los textos en catalán como claves.

## Licencia

[MIT](LICENSE). Los datos y contenidos de 3Cat son propiedad de la CCMA; este proyecto solo consume su API pública.
