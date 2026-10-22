# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Home-made apps and tools for one specific TV: an LG 49UJ620V (2017, webOS 3.9.3, firmware 06.10.75), rooted with Homebrew Channel. There is no test suite or linter; "testing" means installing on the real TV and driving it (see below). User-facing text (UI, READMEs, commit messages) is in Catalan; `README.es.md` is the Spanish mirror of `README.md` and must be kept in sync.

## Commands

All tools read the TV address from `TV_IP` (default `192.168.1.37`). On Git Bash for Windows, prefix commands that pass `/tmp/...` paths with `MSYS_NO_PATHCONV=1`, otherwise they get rewritten to Windows paths.

```bash
# Build an app folder into an .ipk (also generates icons if the folder has none)
python build/make_ipk.py brillo build/brillo.ipk

# Run a shell command on the TV as root (telnet, port 23); 2nd arg = seconds to wait for output
python tvtool/tsh.py 'luna-send -n 1 luna://com.webos.applicationManager/getForegroundAppInfo "{}"' 10

# Upload a file to the TV (base64 chunks over telnet, MD5-verified)
MSYS_NO_PATHCONV=1 python tvtool/push.py build/brillo.ipk /tmp/app.ipk

# Install an uploaded ipk
python tvtool/tsh.py 'luna-send -w 20000 -i luna://com.webos.appInstallService/dev/install "{\"id\":\"cat.brillo.plus\",\"ipkUrl\":\"/tmp/app.ipk\",\"subscribe\":true}"' 30

# Drive/inspect a running dev app via the webOS remote debugger (port 9998, Chrome DevTools Protocol).
# PAGE selects the page by URL substring (brillo | tresc).
PAGE=tresc python tvtool/cdp.py "document.querySelector('.tab.sel').textContent"   # eval JS
PAGE=tresc python tvtool/key.py 40 40 13      # send keyCodes (37-40 arrows, 13 OK, 461 BACK)
PAGE=tresc python tvtool/shot.py out.png      # screenshot (video plane is not captured)
```

Use `PYTHONIOENCODING=utf-8` when output may contain non-ASCII text (the Windows console is cp1252).

Root access over telnet only exists after Homebrew Channel's startup script has run, which on this TV is triggered after a cold boot by the `arrencada/` app (or by opening the Homebrew Channel app). If port 23 is closed, check `/tmp/arrencada.log` once in, or ask the user to open Homebrew Channel (or the TV is off). Bump `version` in `appinfo.json` before reinstalling an app.

## Architecture

Four self-contained deliverables, a boot helper and PC-side tooling:

- **`brillo/` (Brillo+, id `cat.brillo.plus`)** — web app that reads/writes picture settings via `luna://com.webos.settingsservice/{get,set}SystemSettings` (category `picture`; values keep their original JSON type, some keys are strings). If a direct call is refused it falls back to running `luna-send` through `luna://org.webosbrew.hbchannel.service/exec` (root shell). Config is written to `/media/developer/brillo/` (`config.json` for the UI, `schedule.conf` for the daemon). `daemon.sh` (started by `tvtool/brillo-init` from init.d) polls `schedule.conf` every 30 s and applies a profile only when the active time slot changes.
- **`cat3/` (3Cat Lite, id `cat.tresc.lite`)** — unofficial client for the public 3Cat APIs: `api.3cat.cat/videos` and `/programestv` (catalogue; there is no working text search, so search is local over the cached program list) `api.3cat.cat/v2/graellatvfutur?canal=CAD_TV3&data_emissio=dd/mm/yyyy` (TV guide; channel codes in the `EPG` table) and `api-media.3cat.cat/pvideo/media.jsp?idint=…` (MP4 URLs for VOD, HLS for live, VTT subtitles). Subtitles are fetched and rendered by the app itself, not with `<track>`. Navigation is a stack of "views", each a list of rows of items; the same grid/focus code serves every tab. Favourites, "continue watching" and the subtitle language live in `localStorage`.
- **`remote/`** — Node HTTP server that runs **on the TV** (`/media/developer/remote/`, port 8080, started by `remote/remote-init`) plus the phone page it serves. Every action is whitelisted and run with `execFile('luna-send', …)` (no shell). Keys go through `luna://com.webos.service.networkinput/sendSpecialKey`; on-screen messages use `com.webos.notification/createToast` (as `webosbrew`) and `createAlert` (as `com.webos.service.secondscreen.gateway`) via `luna-send -a`. Deploy by pushing the changed files to `/media/developer/remote/` and re-running `/var/lib/webosbrew/init.d/remote`. `share.js` handles uploads (raw `POST /api/upload?name=…`, stored in `/media/developer/share`, auto-deleted after 7 days or when space runs low, served with Range support) and opens them in Pantalla, YouTube (`contentTarget` param) or 3Cat Lite (`{play: id}` param); any other page link is resolved by `tvlinks/tvlinks.py` (address in the TV-only, gitignored `/media/developer/remote/config.json`, see `config.example.json`) and opened in Pantalla. Energy saving (`picture/energySaving`) and the sleep timer (`time/sleepTimer`, which `tvpowerd` acts on; it only accepts 10/20/30/60/90/120/180/240) are plain settingsservice writes; any other time (minutes or `?at=HH:MM`) is a `setTimeout` in the server that presses POWER if `getPowerState` says the TV is still on, so it is lost if the server restarts. `stats.js` counts one minute per minute for the foreground app while `getPowerState` is `Active` (`/media/developer/stats.json`) and reads the TV's own launch counters from db8 as `com.webos.statisticsManager`.
- **`pantalla/` (Pantalla, id `cat.pantalla`)** — viewer for what the phone sends: reads `PalmSystem.launchParams` `{items:[{url,type,name}]}` on launch and on `webOSRelaunch` (`handlesRelaunch: true`; 3Cat Lite uses the same pattern).
- **`arrencada/` (Arrencada, id `cat.arrencada`, invisible)** — boot trigger using the webosbrew-autostart trick: it is registered as an input app (`com.webos.service.eim/addDevice`) and is the last input saved in `/var/lib/eim`, so the TV launches it at every boot. `index.html` only starts `boot.sh` in the background through hbchannel `exec` (it must outlive `restart sam` from `debloat`); `boot.sh` bind-mounts `/var/lib/webosbrew/eim` over `/var/lib/eim` so the original is never rewritten, deletes the input entry (in the overlay), relaunches the real last input, calls `hbchannel.service/autostart` and relaunches again if SAM closed it. Backup of the pre-install state: `/var/lib/webosbrew/eim.backup`.
- **`tvlinks/`** — Python 3 stdlib HTTP service for an always-on Linux box on the LAN (no root needed). `GET :8097/resolve?u=` runs the yt-dlp zipapp in `~/tvlinks/` (`-J`, format chain preferring H.264 MP4 then HLS ≤1080p) and returns `{url,title,headers}`; LAN clients only. Started by the user's crontab (`@reboot` + every 5 min via `start.sh`), yt-dlp self-updates daily. The TV cannot run yt-dlp itself (Python 2.7, armel soft-float userspace). DRM content (most full Atresplayer episodes) cannot work. Keep host names, IPs and user names of the user's machines out of the repo (it is public).
- **`tvtool/`** — Python tooling above, plus `debloat` (init.d script: hosts-blocks LG ad/telemetry domains, bind-mounts empty dirs over unwanted system apps, hides launcher entries by bind-mounting edited `appinfo.json`, then `restart sam`).

Boot hooks live in `/var/lib/webosbrew/init.d/` on the TV (files must be executable, names without extensions, exit 0).

## Platform constraints that bite

- **Chromium 38**: app JS must be ES5 (no `let`/`const`/arrow functions/template literals), CSS needs `-webkit-` flex prefixes, no CSS variables. The on-TV server runs **Node 0.12**, so it is ES5 too. `.gitattributes` forces LF endings; scripts with CRLF break on the TV.
- `PalmSystem.platformBack()` is a no-op here; apps exit with `window.close()`.
- Newly installed apps do not appear in the home bar once the user has edited it: add `"<appid>_default"` to db8 kind `com.webos.launcher.appordering:1` (`luna-send -a com.webos.surfacemanager luna://com.palm.db/merge …`) and reboot.
- **Never create `com.palmdts.devmode.service/start-devmode.sh`**: this firmware verifies its signature and on failure disables dev mode and deletes `/media/developer` (all homebrew apps, configs and the remote server). Boot persistence via the activity manager is also refused on this firmware; `arrencada/` is the working alternative.
- Daily power on/off uses the firmware's own timers (settings category `time`, `onTimer*` / `offTimer*`), not an app — nothing can run while the TV is off.
