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
| [`cat3/`](cat3) | **3Cat Lite** — client no oficial de 3Cat per a TVs on l'app nova no és compatible: directes, últims vídeos, programes A–Z, cerca, subtítols, preferits i «Continuar veient». |
| [`remote/`](remote) | **Comandament web** — servidor Node que corre a la TV (port 8080) amb una pàgina per al mòbil: fletxes, volum, apps, entrades, escriure text, pantalla off. |
| [`tvtool/`](tvtool) | Eines per a l'ordinador (Python): consola root per telnet, pujar fitxers, depurar apps per CDP, script de neteja (*debloat*). |
| [`build/make_ipk.py`](build/make_ipk.py) | Empaqueta una carpeta d'app en un `.ipk` instal·lable. |

![Brillo+](docs/brillo.png)

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
En aquesta TV **això només passa en obrir l'app Homebrew Channel** després d'una aturada completa
(amb «Encesa ràpida» activada, sobreviu a les apagades amb el comandament).

| Fitxer | Instal·lat a la TV com a |
|---|---|
| [`tvtool/debloat`](tvtool/debloat) | `/var/lib/webosbrew/init.d/debloat` — bloqueja dominis d'anuncis/telemetria, desactiva LivePlus i apps promocionals, amaga apps del menú |
| [`tvtool/brillo-init`](tvtool/brillo-init) | `/var/lib/webosbrew/init.d/brillo` — arrenca el servei de programació de Brillo+ |
| [`remote/remote-init`](remote/remote-init) | `/var/lib/webosbrew/init.d/remote` — arrenca el comandament web |

Per desfer qualsevol canvi: esborra el fitxer corresponent de `init.d` i reinicia la TV.

## Notes tècniques (webOS 3.9)

- El navegador de les apps és Chromium 38: **només ES5** (res de `let`, `const`, fletxes…).
- `PalmSystem.platformBack()` no fa res: per sortir d'una app, `window.close()`.
- Tecles des de root: `luna://com.webos.service.networkinput/sendSpecialKey {"key":"UP"}`.
- Les apps de Homebrew poden executar ordres com a root amb `luna://org.webosbrew.hbchannel.service/exec`.
- API pública de 3Cat: `api.3cat.cat/videos`, `api.3cat.cat/programestv` i
  `api-media.3cat.cat/pvideo/media.jsp` (MP4 per als vídeos, HLS per als directes, subtítols VTT).

## Llicència

[MIT](LICENSE). Les dades i els continguts de 3Cat són propietat de la CCMA; aquest projecte només en consumeix l'API pública.
