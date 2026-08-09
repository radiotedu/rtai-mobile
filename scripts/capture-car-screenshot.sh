#!/usr/bin/env bash
set -euo pipefail

apk="$1"
output="$2"

mkdir -p "$(dirname "$output")"
adb install -r "$apk"
adb shell am force-stop com.android.car.media || true
adb shell monkey -p com.android.car.media -c android.intent.category.LAUNCHER 1
sleep 12
adb exec-out screencap -p > "$output"
test -s "$output"
