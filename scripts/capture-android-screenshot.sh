#!/usr/bin/env bash
set -euo pipefail

apk="$1"
component="$2"
output="$3"

mkdir -p "$(dirname "$output")"
adb install -r "$apk"
adb shell am force-stop com.radiotedumobile
adb shell am start -W -n "$component"
sleep 12
adb exec-out screencap -p > "$output"
test -s "$output"
