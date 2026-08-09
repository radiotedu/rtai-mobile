#!/usr/bin/env bash
set -euo pipefail

apk="$1"
output="$2"

mkdir -p "$(dirname "$output")"
adb install -r "$apk"
adb shell am force-stop com.android.car.media || true
adb shell am start -W -a android.car.intent.action.MEDIA_TEMPLATE --es media_package com.radiotedumobile
sleep 25
adb exec-out screencap -p > "$output"
test -s "$output"
