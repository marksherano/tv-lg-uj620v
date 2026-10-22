#!/bin/sh
# Runs as root at boot (started by index.html through hbchannel exec).
# 1) Keeps /var/lib/eim as it is now (with this app as last input, so the TV launches it at
#    every boot) and from here on lets the TV write input changes to a copy mounted on top.
# 2) Hides this app from the input list and goes back to the real last input.
# 3) Runs the Homebrew Channel startup (telnet, ssh, init.d hooks) like opening the HBC app does.
APP=cat.arrencada
OV=/var/lib/webosbrew/eim
DEF=com.webos.app.livetv

echo "boot: $(cat /var/lib/eim/lastinput 2>/dev/null)"
if ! grep -q ' /var/lib/eim ' /proc/mounts; then
    [ -d $OV ] || cp -a /var/lib/eim $OV
    mount --bind $OV /var/lib/eim
fi
luna-send -n 1 luna://com.webos.service.eim/deleteDevice "{\"appId\":\"$APP\"}"; echo

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
