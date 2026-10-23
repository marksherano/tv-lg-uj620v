# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Home-made apps and tools for one specific TV: an LG 49UJ620V (2017, webOS 3.9.3, firmware 06.10.75), rooted with Homebrew Channel. There is no test suite or linter; "testing" means installing on the real TV and driving it (see below). User-facing text (UI, READMEs, commit messages) is in Catalan; `README.es.md` is the Spanish mirror of `README.md` and must be kept in sync.

## Commands

PC-side tools need Python 3 with `websocket-client` and `Pillow`. All tools read the TV address from `TV_IP` (default `192.168.1.37`). On Git Bash for Windows, prefix commands that pass `/tmp/...` paths with `MSYS_NO_PATHCONV=1`, otherwise they get rewritten to Windows paths.

```bash
# Build + upload + install in one step (apps: brillo cat3 jellyfin pantalla arrencada; also remote, debloat).
# Also installs the app's init.d script (brillo), registers arrencada as an input, restarts the remote server.
# --remove undoes it. Waits for the final appInstallService state and exits non-zero on failure.
python tvtool/install.py cat3 remote
python tvtool/install.py --remove pantalla

# Build an app folder into an .ipk (also generates icons if the folder has none)
python build/make_ipk.py brillo build/brillo.ipk

# Run a shell command on the TV as root (telnet, port 23); 2nd arg = seconds to wait for output.
# tsh.Shell() keeps one connection for many commands (used by push.py and install.py).
python tvtool/tsh.py 'luna-send -n 1 luna://com.webos.applicationManager/getForegroundAppInfo "{}"' 10

# Upload a file to the TV (base64 heredoc over one telnet connection, MD5-verified; ~3 KB/s)
MSYS_NO_PATHCONV=1 python tvtool/push.py build/brillo.ipk /tmp/app.ipk

# Drive/inspect a running dev app via the webOS remote debugger (port 9998, Chrome DevTools Protocol).
# PAGE selects the page by URL substring (default brillo; tresc, pantalla, jellyfin).
PAGE=tresc python tvtool/cdp.py "document.querySelector('.tab.sel').textContent"   # eval JS
PAGE=tresc python tvtool/key.py 40 40 13      # send keyCodes (37-40 arrows, 13 OK, 461 BACK)
PAGE=tresc python tvtool/shot.py out.png      # screenshot (video plane is not captured)

# Call the LG SSAP API (WebSocket, port 3000) without root; first run asks for pairing on the TV
# and stores the key in tvtool/clientkey.txt (gitignored)
python tvtool/lgtv.py ssap://com.webos.applicationManager/getForegroundAppInfo
```

Use `PYTHONIOENCODING=utf-8` when output may contain non-ASCII text (the Windows console is cp1252). Built `.ipk` files are gitignored; `build/` keeps old ones named `<app>_<version>.ipk`. Gitignored local folders: `apidump/` (saved 3Cat API responses and VTT samples, handy as reference for `cat3/`), `testmedia/` (photos/videos for testing Pantalla uploads), `pkg/`.

Root access over telnet only exists after Homebrew Channel's startup script has run, which on this TV is triggered after a cold boot by the `arrencada/` app (or by opening the Homebrew Channel app). If port 23 is closed, check `/tmp/arrencada.log` once in, or ask the user to open Homebrew Channel (or the TV is off). Bump `version` in `appinfo.json` before reinstalling an app.

## Architecture

Five self-contained TV deliverables, a boot helper, a LAN-side link resolver and PC-side tooling:

- **`brillo/` (Brillo+, id `cat.brillo.plus`)** — web app that reads/writes picture settings via `luna://com.webos.settingsservice/{get,set}SystemSettings` (category `picture`; values keep their original JSON type, some keys are strings). If a direct call is refused it falls back to running `luna-send` through `luna://org.webosbrew.hbchannel.service/exec` (root shell). Config is written to `/media/developer/brillo/` (`config.json` for the UI, `schedule.conf` for the daemon). `daemon.sh` (started by `tvtool/brillo-init` from init.d) polls `schedule.conf` every 30 s and applies a profile only when the active time slot changes.
- **`cat3/` (3Cat Lite, id `cat.tresc.lite`)** — unofficial client for the public 3Cat APIs: `api.3cat.cat/videos` and `/programestv` (catalogue; there is no working text search, so search is local over the cached program list), `api.3cat.cat/v2/graellatvfutur?canal=CAD_TV3&data_emissio=dd/mm/yyyy` (TV guide; channel codes in the `EPG` table) and `api-media.3cat.cat/pvideo/media.jsp?idint=…` (MP4 URLs for VOD, HLS for live, VTT subtitles). Subtitles are fetched and rendered by the app itself, not with `<track>`. Navigation is a stack of "views", each a list of rows of items; the same grid/focus code serves every tab. Favourites, "continue watching" and the subtitle language live in `localStorage`.
- **`remote/`** — Node HTTP server that runs **on the TV** (`/media/developer/remote/`, port 8080, started by `remote/remote-init`) plus the phone page it serves. Every action is whitelisted and run with `execFile('luna-send', …)` (no shell). Reads are GET; every other `/api/` path must be POST, and any `/api/` request whose `Origin`/`Referer` is another host gets 403 (`apiGuard`, against CSRF from pages open on LAN devices); clients sending neither (iPhone shortcut, curl) pass. Keys go through `luna://com.webos.service.networkinput/sendSpecialKey`; on-screen messages use `com.webos.notification/createToast` (as `webosbrew`) and `createAlert` (as `com.webos.service.secondscreen.gateway`) via `luna-send -a`. Deploy with `tvtool/install.py remote` (pushes every file except `config*.json`, re-runs `/var/lib/webosbrew/init.d/remote`). Requests whose `Host` is not an IP, a dotless name or `*.local/.lan/.home/.internal/.home.arpa` get 403 (`lanHost`, against DNS rebinding). `share.js` handles uploads (raw `POST /api/upload?name=…`, stored in `/media/developer/share`, auto-deleted after 7 days or when space runs low, served with Range support) and opens them in Pantalla, YouTube (`contentTarget` param) or 3Cat Lite (`{play: id}` param); any other page link is resolved by `tvlinks/tvlinks.py` (address in the TV-only, gitignored `/media/developer/remote/config.json`, see `config.example.json`) and opened in Pantalla. Energy saving (`picture/energySaving`) and the sleep timer (`time/sleepTimer`, which `tvpowerd` acts on; it only accepts 10/20/30/60/90/120/180/240) are plain settingsservice writes; any other time (minutes or `?at=HH:MM`) is a `setTimeout` in the server that presses POWER if `getPowerState` says the TV is still on, so it is lost if the server restarts. `stats.js` counts one minute per minute for the foreground app while `getPowerState` is `Active` (`/media/developer/stats.json`) and reads the TV's own launch counters from db8 as `com.webos.statisticsManager`. `kbd.js` keeps a `luna-send -i` subscription to `com.webos.service.ime/registerRemoteKeyboard` (as `com.webos.service.secondscreen.gateway`) to know when a TV text field has focus (`/api/kb` long-poll); the phone mirrors its input box with `insertText` + `replace:true` (works in web apps and system fields, not in YouTube/Netflix, which draw their own keyboard). Sharing: `manifest.json` has a `share_target` handled by `sw.js` (files parked in Cache Storage, then uploaded by `/envia`; Android Chrome only installs it after the user adds the TV origin to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, since there is no HTTPS); `POST /api/compartir` is for the iPhone shortcut and takes a photo/video or any body containing a link (photos within 2 min join one slideshow). `status.js` (`/api/status`, page `/estat`) reads `/proc`, `/sys/class/thermal`, `df`, `/proc/net/tcp*` and the boot/server logs.
- **`jellyfin/` (Jellyfin Lite, id `cat.jellyfin.lite`)** — Jellyfin client on the same view/grid model as `cat3/` (rows can mix 4 wide cards and 6 posters; up/down picks the nearest card by x). Login by Quick Connect or user/password; session in `localStorage` (`jf`, device id in `jfdev`, max bitrate in `jfbr`). Uses the 10.9+ endpoints (`/UserViews`, `/UserItems/Resume`, `/UserPlayedItems`). Playback goes through `POST /Items/{id}/PlaybackInfo` with a device profile measured with `canPlayType` on this TV: direct play for MP4/MOV (H.264/HEVC, AAC/MP3/AC3/E-AC3) and WebM, everything else HLS/TS from the server (stripping `StartTimeTicks` and seeking client-side); a failed direct play retries with direct play disabled. Non-default audio tracks also disable direct play. Text subtitles are fetched as `Stream.vtt` and drawn by the app; progress is reported to `/Sessions/Playing*`.
- **`pantalla/` (Pantalla, id `cat.pantalla`)** — viewer for what the phone sends: reads `PalmSystem.launchParams` `{items:[{url,type,name}]}` on launch and on `webOSRelaunch` (`handlesRelaunch: true`; 3Cat Lite uses the same pattern).
- **`arrencada/` (Arrencada, id `cat.arrencada`, invisible)** — boot trigger using the webosbrew-autostart trick: it is registered as an input app (`com.webos.service.eim/addDevice`) and is the last input saved in `/var/lib/eim`, so the TV launches it at every boot. `index.html` only starts `boot.sh` in the background through hbchannel `exec` (it must outlive `restart sam` from `debloat`); `boot.sh` bind-mounts `/var/lib/webosbrew/eim` over `/var/lib/eim` so the original is never rewritten, deletes the input entry (in the overlay), relaunches the real last input, calls `hbchannel.service/autostart` and relaunches again if SAM closed it. Backup of the pre-install state: `/var/lib/webosbrew/eim.backup`.
- **`tvlinks/`** — Python 3 stdlib HTTP service for an always-on Linux box on the LAN (no root needed). `GET :8097/resolve?u=` runs the yt-dlp zipapp in `~/tvlinks/` (`-J`, format chain preferring H.264 MP4 then HLS ≤1080p) and returns `{url,title,headers}`; LAN clients only. Started by the user's crontab (`@reboot` + every 5 min via `start.sh`), yt-dlp self-updates daily. The TV cannot run yt-dlp itself (Python 2.7, armel soft-float userspace). DRM content (most full Atresplayer episodes) cannot work. It also turns the TV on: `remote/server.js` registers the TV's MAC with `GET /wake/register` (stored in `~/tvlinks/wake.json`), and `/wake` sends Wake-on-LAN (TV setting `network/wolwowlOnOff`); `/tv` is the phone page with the power button, and `remote/sw.js` redirects the installed Android app there when the TV does not answer. Keep host names, IPs and user names of the user's machines out of the repo (it is public).
- **`tvtool/`** — Python tooling above, plus `debloat` (init.d script: hosts-blocks LG ad/telemetry domains, bind-mounts empty dirs over unwanted system apps, hides launcher entries by bind-mounting edited `appinfo.json`, then `restart sam`).

Boot hooks live in `/var/lib/webosbrew/init.d/` on the TV (files must be executable, names without extensions, exit 0).

## Platform constraints that bite

- **Chromium 38**: app JS must be ES5 (no `let`/`const`/arrow functions/template literals), CSS needs `-webkit-` flex prefixes, no CSS variables. The on-TV server runs **Node 0.12**, so it is ES5 too. `.gitattributes` forces LF endings; scripts with CRLF break on the TV.
- `PalmSystem.platformBack()` is a no-op here; apps exit with `window.close()`.
- Newly installed apps do not appear in the home bar once the user has edited it: add `"<appid>_default"` to db8 kind `com.webos.launcher.appordering:1` (`luna-send -a com.webos.surfacemanager luna://com.palm.db/merge …` with the whole `apps` array; easiest from a script pushed with `push.py`, the JSON does not survive `tsh.py` quoting) and reboot.
- Rebooting: `reboot` from the telnet shell does nothing (not even with `nohup`); use `luna-send -n 1 luna://com.webos.service.tvpower/power/reboot '{"reason":"reset"}'`. Check `/proc/uptime` afterwards: the remote server answering is not proof that the TV restarted.
- **Never create `com.palmdts.devmode.service/start-devmode.sh`**: this firmware verifies its signature and on failure disables dev mode and deletes `/media/developer` (all homebrew apps, configs and the remote server). Boot persistence via the activity manager is also refused on this firmware; `arrencada/` is the working alternative.
- Daily power on/off uses the firmware's own timers (settings category `time`, `onTimer*` / `offTimer*`), not an app — nothing can run while the TV is off.
