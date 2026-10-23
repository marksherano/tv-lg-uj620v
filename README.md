# tv-lg-uj620v

**English** · [Català](README.ca.md) · [Castellano](README.es.md)

Home-made apps and tools for an **LG 49UJ620V** (2017, webOS 3.9) rooted with
[Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel).

> ⚠️ Personal project, not affiliated with LG or CCMA/3Cat. Use it at your own risk: modifying a
> rooted TV can leave it in a bad state.
> **Never create `start-devmode.sh`** on recent firmware: the system checks its signature and, if
> that fails, disables developer mode and wipes `/media/developer` (all Homebrew apps).

> 🔒 **For a trusted local network only.** With Homebrew Channel the TV opens a root telnet with
> **no password** on port 23, and the web remote (port 8080) asks for no key: any device on the
> network can control the TV. Never expose ports 23, 8080 or 3000 to the Internet (no port forwarding
> on the router, no DMZ) and don't connect the TV to shared or public Wi-Fi networks.
> The remote only accepts actions over `POST` and from its own pages, so a random website open on a
> phone at home can't press keys or turn the TV off.

## Contents

| Folder | What it is |
|---|---|
| [`brillo/`](brillo) | **Brillo+** — backlight, brightness, contrast, colour, energy saving… with profiles (Day, Evening, Night, Cinema, 3 custom ones) and a schedule. |
| [`cat3/`](cat3) | **3Cat Lite** — unofficial 3Cat client for TVs the new app doesn't support: live channels, TV guide, latest videos, A–Z shows, search, subtitles, favourites, "Continue watching" and automatic next episode (10 s countdown at the end). |
| [`remote/`](remote) | **Web remote** — Node server running on the TV (port 8080) with a page for the phone: arrows, volume, apps, inputs, on-screen messages, screen off, energy saving, sleep timer and **turning the TV on** (Wake-on-LAN through tvlinks). **Keyboard**: when the TV opens a text field (browser, Wi-Fi, Jellyfin Lite…) the phone tells you and what you type shows up on the TV live. Includes **Send to TV** (`/envia`: photos, videos and YouTube, 3Cat, RTVE, Atresplayer… links, also from the Android and iPhone **Share** menu), **Statistics** (`/estadistiques`: usage time per day and per app) and **TV status** (`/estat`: temperature, memory, disk, network, running services, installed apps and boot logs). |
| [`jellyfin/`](jellyfin) | **Jellyfin Lite** — lightweight [Jellyfin](https://jellyfin.org) client: home with "Continue watching", "Next up" and recently added, one tab per library (A–Z, recently added, unwatched…), shows by season, details with synopsis, search, subtitles, audio track switching, skip intro and credits button and automatic next episode. Sign in with Quick Connect (a code on screen) or user and password; playback position is saved on the server. Plays MP4/MOV (H.264, HEVC) and WebM directly; the server converts everything else (MKV…) to HLS. |
| [`pantalla/`](pantalla) | **Pantalla** — TV app that shows what the phone sends: photos (slideshow) and videos (including iPhone HEVC `.mov`). |
| [`arrencada/`](arrencada) | **Arrencada** — invisible app the TV opens by itself at power-on, which starts the Homebrew Channel services (telnet, ssh, remote…) without opening it. |
| [`tvlinks/`](tvlinks) | **tvlinks** — service for an always-on Linux computer at home that uses yt-dlp to turn video page links (RTVE, Atresplayer clips, regional broadcasters, Vimeo…) into a direct address the TV can play (DRM content doesn't work). It also turns the TV on from the phone. |
| [`tvtool/`](tvtool) | Computer-side tools (Python): one-step installer (`install.py`), root telnet console, file upload, app debugging over CDP, clean-up script (*debloat*). |
| [`build/make_ipk.py`](build/make_ipk.py) | Packs an app folder into an installable `.ipk`. |

![Brillo+](docs/brillo.png)

![3Cat Lite — TV guide](docs/3cat-guia.png)

![Jellyfin Lite — movie library](docs/jellyfin.jpg)

<img src="docs/mobil.png" alt="Web remote on the phone: remote with the keyboard notice, Send to TV, Statistics and TV status" width="830">

## Languages

The apps and the web remote are in **English, Catalan and Spanish**. They start in the TV's (or the
phone's) language, falling back to English, and remember the one you pick:

| App | Where to change it |
|---|---|
| Brillo+ | **Language** row, at the bottom of the right column (◀ ▶) |
| 3Cat Lite | Last tab of the top bar (OK) |
| Jellyfin Lite | **Settings** tab → **Language** |
| Web remote | Selector at the bottom of each page; on-screen messages on the TV follow the phone's language |
| Pantalla | Follows the language of the phone that sends the photos |

## How to root the TV

All of this needs root and [Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel).
First, check your model and firmware on [CanI.RootMy.TV](https://cani.rootmy.tv). Known methods
according to [webosbrew.org](https://www.webosbrew.org/rooting/) (checked October 2026):

| Method | webOS | Status |
|---|---|---|
| [DejaVuln](https://github.com/throwaway96/dejavuln-autoroot) | 3.5 and later | **The one for this TV.** webOS 3.5 and 4.0 are unpatched and very likely to stay that way; recent firmware for most webOS 5+ and all of webOS 9 is patched. |
| [faultmanager](https://github.com/throwaway96/faultmanager-autoroot) | 4.0 and later (including webOS 9) | No known patch. Doesn't work on webOS 3.x. |
| [WTA](https://www.webosbrew.org/rooting/wta) | — | Patched in recent updates. |
| [crashd](https://gist.github.com/throwaway96/e811b0f7cc2a705a5a476a8dfa45e09f) | — | Patched in April 2024. |
| [RootMy.TV](https://rootmy.tv) | 3 to 6 | Patched in 2022; probably doesn't work any more. |
| [GetMeNow](https://www.webosbrew.org/rooting/getmenow) | Some models from 1 to 3 | Broken since the Developer Mode app was updated in early 2024. |
| [NVM](https://gist.github.com/throwaway96/827ff726981cc2cbc46a22a2ad7337a1) | Before 4.0 | Hardware mod: you have to open the TV and there is high voltage inside. Last resort only. |

With DejaVuln, summarised from [its instructions](https://github.com/throwaway96/dejavuln-autoroot#instructions):

1. Download the latest release (not the "Source code") and unzip it to the root of a USB stick with a
   single FAT32 or NTFS partition, with no folder in between.
2. Plug it into the TV (the only USB stick), open it with the **Music** app or the media player, go
   into the `lol$(sh$IFS$(find$IFS/tmp` folder and try to play the `.mp3` file in it. An error saying
   it can't be played is normal.
3. When the notifications say rooting is complete, remove the stick. If you don't see Homebrew
   Channel, restart the TV with quick start turned off.

Once the TV is rooted, **don't install LG's Developer Mode app** (if you have it, delete it before
restarting) and **don't update the firmware**: root could go away and might not be possible again.

## Requirements

- An LG TV with webOS 3.x, rooted, with Homebrew Channel (root telnet on port 23).
- On the computer: Python 3 with `websocket-client` and `Pillow`.
- The tools use the IP in the `TV_IP` environment variable (`192.168.1.37` if unset):

| Console | Command |
|---|---|
| PowerShell | `$env:TV_IP = "192.168.1.37"` |
| CMD | `set TV_IP=192.168.1.37` |
| Bash (Linux, macOS, Git Bash) | `export TV_IP=192.168.1.37` |

## Installing

A single command builds, uploads and installs whatever you name, and it is the same in any console:

```bash
python tvtool/install.py brillo cat3
```

| Name | What it installs |
|---|---|
| `brillo` | Brillo+ and its schedule service (`init.d/brillo`) |
| `cat3`, `jellyfin`, `pantalla` | The matching app |
| `arrencada` | Arrencada; the first time it keeps a copy of `/var/lib/eim` and registers the app as an input |
| `remote` | The web remote in `/media/developer/remote/` and its `init.d/remote` (the TV's `config.json` is left alone); starts it |
| `debloat` | The clean-up script in `init.d/debloat`; applied at the next restart |

To reinstall an app with changes, bump the `version` in its `appinfo.json` first.

New apps don't show up in the home bar by themselves once you have edited it: add `<appid>_default`
to the db8 list `com.webos.launcher.appordering:1` (as `com.webos.surfacemanager`) and restart.

## Boot scripts

The scripts in `/var/lib/webosbrew/init.d/` run when Homebrew Channel's startup script runs. On this
TV that script doesn't run by itself at power-on: the **Arrencada** app does it (or opening Homebrew
Channel by hand). With "Quick Start" on, everything survives turning the TV off with the remote.

**Arrencada** (`cat.arrencada`) uses the same trick as
[webosbrew-autostart](https://github.com/webosbrew/webosbrew-autostart), without touching the system:

- It is registered as an "input app" (`com.webos.service.eim/addDevice`) and is the last input saved
  in `/var/lib/eim`, so the TV opens it at power-on.
- When it opens it starts `boot.sh` as root: it mounts a copy of `/var/lib/eim` on top (the original
  never changes again), hides itself from the input list, goes back to the last real input (or TV) and
  calls `org.webosbrew.hbchannel.service/autostart`, which is what the Homebrew Channel app does.
- If `restart sam` (from `debloat`) closes the app that had been opened, it opens it again. The log is
  in `/tmp/arrencada.log`.

Install it with `python tvtool/install.py arrencada` (to remove it, see
[Uninstalling and recovery](#uninstalling-and-recovery)).

| File | Installed on the TV as |
|---|---|
| [`tvtool/debloat`](tvtool/debloat) | `/var/lib/webosbrew/init.d/debloat` — blocks ad/telemetry domains, disables LivePlus and promotional apps, hides apps from the menu |
| [`tvtool/brillo-init`](tvtool/brillo-init) | `/var/lib/webosbrew/init.d/brillo` — starts the Brillo+ schedule service |
| [`remote/remote-init`](remote/remote-init) | `/var/lib/webosbrew/init.d/remote` — starts the web remote |

To undo any of them: delete the file from `init.d` and restart the TV.

## Uninstalling and recovery

Nothing in this project touches the firmware: the apps are ordinary developer apps and the boot
scripts only make changes that go away on restart. Everything is undone with `--remove`:

```bash
python tvtool/install.py --remove brillo cat3 jellyfin pantalla remote debloat arrencada
```

| What | What `--remove` does | What is left |
|---|---|---|
| Apps | Uninstalls them; `brillo` also removes `init.d/brillo` | Nothing (Brillo+ profiles in `/media/developer/brillo/` can be deleted by hand) |
| `remote` | Stops the server and deletes `/media/developer/remote/` and `init.d/remote` | Shared files in `/media/developer/share/` |
| `debloat` | Deletes `init.d/debloat`; **restart needed** to bring back the apps and blocked domains | LivePlus and the ad cookie stay off; turn them back on in the TV settings |
| `arrencada` | Unmounts `/var/lib/eim`, restores the `/var/lib/webosbrew/eim.backup` copy and uninstalls the app; **restart needed** | Nothing |

If something goes wrong:

- **The TV starts but there is no telnet (port 23).** Homebrew Channel's startup script hasn't run:
  open the **Homebrew Channel** app and try again. If you have Arrencada, check `/tmp/arrencada.log` once in.
- **An app doesn't open or stays black.** Reinstall or uninstall it; nothing else is affected.
- **The TV behaves oddly after starting.** Log in over telnet, remove the scripts in
  `/var/lib/webosbrew/init.d/` one at a time and restart each time to find the culprit, with
  `luna-send -n 1 luna://com.webos.service.tvpower/power/reboot '{"reason":"reset"}'` (the `reboot` command does nothing on this TV).
- **Homebrew Channel is gone** (firmware update, LG's Developer Mode app…). This project's apps stop
  working but the TV is fine; root it again (see [How to root the TV](#how-to-root-the-tv)).
- **To also remove root and Homebrew Channel**, uninstall everything as above and follow the
  instructions on [webosbrew.org](https://www.webosbrew.org/).

## Sharing from the phone

- **Android**: the remote page is a PWA with `share_target`; once installed it shows up as
  "TV Remote" in the Share menu (photos, videos and links). Since the TV has no HTTPS, you first need
  to add its address to `chrome://flags/#unsafely-treat-insecure-origin-as-secure` in Chrome. The
  steps are on `/envia`.
- **iPhone**: a "Send to TV" shortcut that sends each shared item to `POST /api/compartir`. The server
  accepts a photo, a video or anything containing a link, and photos that arrive one after another go
  into the same slideshow. The steps are on `/envia` too.

## Video links with yt-dlp

The TV can't run yt-dlp (its Python is too old), so another always-on computer on the local network
(a mini PC, a Linux NAS…) with Python 3 does it. When the link you send isn't YouTube, 3Cat or a
direct file, the remote asks `<service>/resolve?u=<link>` and opens the result (MP4 or HLS, up to
1080p) in Pantalla. The service only answers on the local network.

Installing it on the computer (no root; started from the user's `crontab`, yt-dlp updates itself daily):

```bash
mkdir -p ~/tvlinks && cp tvlinks/tvlinks.py tvlinks/start.sh ~/tvlinks/
curl -sSL -o ~/tvlinks/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
chmod +x ~/tvlinks/yt-dlp ~/tvlinks/start.sh
(crontab -l; echo '@reboot $HOME/tvlinks/start.sh'; echo '*/5 * * * * $HOME/tvlinks/start.sh'
 echo '30 5 * * * python3 $HOME/tvlinks/yt-dlp -U >> $HOME/tvlinks/update.log 2>&1') | crontab -
~/tvlinks/start.sh
```

On the TV, copy [`remote/config.example.json`](remote/config.example.json) to
`/media/developer/remote/config.json` with this computer's address (port 8097).

### Turning the TV on from the phone

With the TV off there is no server to answer, so tvlinks turns it on with a Wake-on-LAN packet. The
TV menu option *Network → Turn on via Mobile* (`wolwowlOnOff`) must be on. The remote tells tvlinks
the TV's MAC address when it starts (`/wake/register`; tvlinks keeps it in `wake.json`, outside the
repository) and the `<service>/tv` page has the power button: once the TV answers, it opens the
remote. On Android, the installed remote app goes there by itself when the TV doesn't answer. For an
iPhone shortcut, `GET <service>/wake` is enough.

### Skipping the intro in Jellyfin Lite

Jellyfin Lite uses the server's segments (`/MediaSegments`, Jellyfin 10.10 or later), filled by a
plugin such as [Intro Skipper](https://github.com/intro-skipper/intro-skipper). If there are none, it
looks for file chapters named "Intro", "Opening", "Credits"… When an episode's credits start (or when
it ends), it offers the next one with a 10 s countdown.

## Technical notes (webOS 3.9)

- The apps' browser is Chromium 38: **ES5 only** (no `let`, `const`, arrow functions…).
- `PalmSystem.platformBack()` does nothing: to exit an app, use `window.close()`.
- Keys from root: `luna://com.webos.service.networkinput/sendSpecialKey {"key":"UP"}`.
- Homebrew apps can run commands as root with `luna://org.webosbrew.hbchannel.service/exec`.
- 3Cat public API: `api.3cat.cat/videos`, `api.3cat.cat/programestv`, `api.3cat.cat/v2/graellatvfutur` (schedule) and
  `api-media.3cat.cat/pvideo/media.jsp` (MP4 for videos, HLS for live channels, VTT subtitles).
- UI text: each app has an `i18n.js` with the same small core (`T()`, `translatePage()`) and its own
  Spanish and English tables; the code keeps the Catalan strings as keys.

## License

[MIT](LICENSE). 3Cat data and content belong to CCMA; this project only uses its public API.
