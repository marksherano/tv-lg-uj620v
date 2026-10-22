#!/bin/sh
# Starts tvlinks.py unless it is already running (cron: @reboot and every 5 minutes)
D=$(dirname "$(readlink -f "$0")")
pgrep -f "$D/tvlinks.py" >/dev/null && exit 0
cd "$D" && nohup python3 "$D/tvlinks.py" >> "$D/tvlinks.log" 2>&1 &
