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
| [`remote/`](remote) | **Mando web** — servidor Node que corre en la TV (puerto 8080) con una página para el móvil: flechas, volumen, apps, entradas, escribir texto, mensajes en pantalla, apagar pantalla. |
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
Homebrew Channel. En esta TV **eso solo ocurre al abrir la app Homebrew Channel** tras un apagado
completo (con «Inicio rápido» activado, sobrevive a los apagados con el mando).

| Archivo | Instalado en la TV como |
|---|---|
| [`tvtool/debloat`](tvtool/debloat) | `/var/lib/webosbrew/init.d/debloat` — bloquea dominios de anuncios/telemetría, desactiva LivePlus y apps promocionales, oculta apps del menú |
| [`tvtool/brillo-init`](tvtool/brillo-init) | `/var/lib/webosbrew/init.d/brillo` — arranca el servicio de programación de Brillo+ |
| [`remote/remote-init`](remote/remote-init) | `/var/lib/webosbrew/init.d/remote` — arranca el mando web |

Para deshacer cualquier cambio: borra el archivo correspondiente de `init.d` y reinicia la TV.

## Notas técnicas (webOS 3.9)

- El navegador de las apps es Chromium 38: **solo ES5** (nada de `let`, `const`, funciones flecha…).
- `PalmSystem.platformBack()` no hace nada: para salir de una app, `window.close()`.
- Teclas desde root: `luna://com.webos.service.networkinput/sendSpecialKey {"key":"UP"}`.
- Las apps de Homebrew pueden ejecutar órdenes como root con `luna://org.webosbrew.hbchannel.service/exec`.
- API pública de 3Cat: `api.3cat.cat/videos`, `api.3cat.cat/programestv`, `api.3cat.cat/v2/graellatvfutur` (programación) y
  `api-media.3cat.cat/pvideo/media.jsp` (MP4 para los vídeos, HLS para los directos, subtítulos VTT).

## Licencia

[MIT](LICENSE). Los datos y contenidos de 3Cat son propiedad de la CCMA; este proyecto solo consume su API pública.
