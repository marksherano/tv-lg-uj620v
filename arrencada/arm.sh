#!/bin/sh
# Makes the TV open this app at the next power-on, and keeps it that way. Run as root by boot.sh,
# by the init.d hook (also when Homebrew Channel is opened by hand) and by tvtool/install.py.
# At power-on bootd opens the last input saved in the real /var/lib/eim/lastinput, so that file
# must name this app. Selecting the input does not write it; eim's setLastInput does. After that a
# copy is mounted on top, so the TV's own input changes never reach the real file.
APP=cat.arrencada
OV=/var/lib/webosbrew/eim
WANT="{\"type\":\"MVPD_IP\",\"appId\":\"$APP\"}"

if grep -q ' /var/lib/eim ' /proc/mounts; then
    # the copy is on top: reach the real file through a bind mount of /var (it skips submounts)
    R=/tmp/arrencada-var
    mkdir -p $R && mount --bind /var $R || exit 0
    if [ "$(cat $R/lib/eim/lastinput 2>/dev/null)" != "$WANT" ]; then
        printf '%s' "$WANT" > $R/lib/eim/lastinput
        echo "arm: real lastinput fixed"
    fi
    [ "$(cat $R/lib/eim/lastinput 2>/dev/null)" = "$WANT" ] && echo "arm: ok"
    umount $R; rmdir $R
    exit 0
fi

# Not mounted: the TV started without this app (or it is the first run). Keep the TV's current
# state in the copy, unless the real file already names this app (then the copy has the real last input).
if [ ! -d $OV ]; then
    cp -a /var/lib/eim $OV
elif [ "$(cat /var/lib/eim/lastinput 2>/dev/null)" != "$WANT" ]; then
    cp -a /var/lib/eim/. $OV/
fi
luna-send -n 1 luna://com.webos.service.eim/addDevice "{\"appId\":\"$APP\",\"pigImage\":\"\",\"mvpdIcon\":\"\"}"; echo
luna-send -n 1 luna://com.webos.service.eim/setLastInput "{\"type\":\"MVPD_IP\",\"appId\":\"$APP\"}"; echo
[ "$(cat /var/lib/eim/lastinput 2>/dev/null)" = "$WANT" ] || printf '%s' "$WANT" > /var/lib/eim/lastinput
[ "$(cat /var/lib/eim/lastinput 2>/dev/null)" = "$WANT" ] && echo "arm: ok"
mount --bind $OV /var/lib/eim
# hide this app from the input list (only in the copy)
luna-send -n 1 luna://com.webos.service.eim/deleteDevice "{\"appId\":\"$APP\"}"; echo
exit 0
