#!/bin/sh
# Brillo+ schedule daemon. Reads $CONF (written by the app):
#   line 1: "on" or "off"
#   next lines: "HHMM <picture-settings-json-without-spaces>"
# Every 30 s applies the entry whose time is the latest <= now (wrapping to the
# previous day's last entry), but only when the active entry changes, so manual
# tweaks are kept until the next scheduled change.
CONF=/media/developer/brillo/schedule.conf
STATE=/tmp/brillo.applied

while true; do
    if [ -f "$CONF" ] && [ "$(head -n 1 "$CONF")" = "on" ]; then
        now=$(date +%H%M)
        best=""; last=""
        for line in $(tail -n +2 "$CONF" | sort | tr ' ' '|'); do
            t=${line%%|*}
            last=$line
            [ "$t" -le "$now" ] 2>/dev/null && best=$line
        done
        [ -z "$best" ] && best=$last
        if [ -n "$best" ] && [ "$best" != "$(cat $STATE 2>/dev/null)" ]; then
            json=${best#*|}
            luna-send -n 1 luna://com.webos.settingsservice/setSystemSettings \
                "{\"category\":\"picture\",\"settings\":$json}" >/dev/null 2>&1 &&
                echo "$best" > $STATE
        fi
    else
        rm -f $STATE
    fi
    sleep 30
done
