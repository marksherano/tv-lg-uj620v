#!/bin/sh
# Runs as root at boot (started by index.html through hbchannel exec).
# 1) arm.sh: keeps this app as the last input in the real /var/lib/eim (so the TV launches it at
#    every boot), mounts a copy on top for the TV's own input changes and hides the app from the list.
# 2) Goes back to the real last input.
# 3) Runs the Homebrew Channel startup (telnet, ssh, init.d hooks) like opening the HBC app does.
APP=cat.arrencada
OV=/var/lib/webosbrew/eim
DEF=com.webos.app.livetv

echo "boot: $(cat /var/lib/eim/lastinput 2>/dev/null)"
sh "$(dirname "$0")/arm.sh"

last=$(sed -n 's/.*"appId" *: *"\([^"]*\)".*/\1/p' $OV/lastinput)
[ -z "$last" -o "$last" = "$APP" ] && last=$DEF
echo "last input: $last"
luna-send -n 1 luna://com.webos.applicationManager/launch "{\"id\":\"$last\"}"; echo

luna-send -n 1 luna://org.webosbrew.hbchannel.service/autostart '{}'; echo
# wait for the startup hooks; debloat restarts SAM, which closes the app we just launched
i=0
while [ $i -lt 60 ] && { [ ! -f /tmp/webosbrew_startup ] || pgrep -f 'run-parts /var/lib/webosbrew/init.d' >/dev/null; }; do
    sleep 1; i=$((i + 1))
done
sleep 3
fg=$(luna-send -n 1 luna://com.webos.applicationManager/getForegroundAppInfo '{}' | sed -n 's/.*"appId": *"\([^"]*\)".*/\1/p')
echo "after startup (${i}s): foreground '$fg'"
[ "$fg" = "$last" ] || luna-send -n 1 luna://com.webos.applicationManager/launch "{\"id\":\"$last\"}"
luna-send -n 1 luna://com.webos.applicationManager/closeByAppId "{\"id\":\"$APP\"}" >/dev/null
exit 0
