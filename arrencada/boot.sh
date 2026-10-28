#!/bin/sh
# Runs as root at boot (started by index.html through hbchannel exec).
# 1) arm.sh: keeps this app as the last input in the real /var/lib/eim (so the TV launches it at
#    every boot), mounts a copy on top for the TV's own input changes and hides the app from the list.
# 2) Goes back to the real last input.
# 3) Runs the Homebrew Channel startup (telnet, ssh, init.d hooks) like opening the HBC app does.
# $1: app to go back to instead of the last input (tvlinks opens this app when the TV is on but the
# remote is not, e.g. after a Quick Start reboot that came up with Live TV).
APP=cat.arrencada
OV=/var/lib/webosbrew/eim
DEF=com.webos.app.livetv

echo "boot $(date '+%F %T') ${1:+(back to $1) }: $(cat /var/lib/eim/lastinput 2>/dev/null)"
sh "$(dirname "$0")/arm.sh"

last=$(sed -n 's/.*"appId" *: *"\([^"]*\)".*/\1/p' $OV/lastinput)
[ -n "$1" ] && last=$1
[ -z "$last" -o "$last" = "$APP" ] && last=$DEF
echo "last input: $last"
luna-send -n 1 luna://com.webos.applicationManager/launch "{\"id\":\"$last\"}"; echo

luna-send -n 1 luna://org.webosbrew.hbchannel.service/autostart '{}'; echo
# wait for the startup hooks; debloat restarts SAM, which closes the app we just launched.
# autostart returns before startup.sh is done: it creates /tmp/webosbrew_startup as it starts and
# removes its failsafe flag as the very last step (10 s after the init.d hooks)
FS=/var/luna/preferences/webosbrew_failsafe
sleep 2
i=2
while [ $i -lt 90 ] && { [ ! -f /tmp/webosbrew_startup ] || [ -e $FS ]; }; do
    sleep 1; i=$((i + 1))
done
sleep 2
fg=$(luna-send -n 1 luna://com.webos.applicationManager/getForegroundAppInfo '{}' | sed -n 's/.*"appId": *"\([^"]*\)".*/\1/p')
echo "after startup (${i}s): foreground '$fg'"
# the startup runs once per boot: if it ran earlier and the remote has died since, start it again
R=/var/lib/webosbrew/init.d/remote
if [ -x $R ] && ! grep -q '^ *[0-9]*: [0-9A-F]*:1F90 [0-9A-F:]* 0A' /proc/net/tcp /proc/net/tcp6 2>/dev/null; then
    echo "remote not listening: starting it"; $R
fi
[ "$fg" = "$last" ] || luna-send -n 1 luna://com.webos.applicationManager/launch "{\"id\":\"$last\"}"
luna-send -n 1 luna://com.webos.applicationManager/closeByAppId "{\"id\":\"$APP\"}" >/dev/null
exit 0
