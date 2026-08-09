#!/usr/bin/env bash
set -euo pipefail

apk="$1"
component="$2"
output="$3"

mkdir -p "$(dirname "$output")"
adb install -r "$apk"
adb shell input keyevent 82 || true
adb shell wm dismiss-keyguard || true
adb shell am force-stop com.radiotedumobile
adb shell am start -W -n "$component"
for attempt in $(seq 1 30); do
  focus="$(adb shell dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp' || true)"
  if [[ "$focus" == *"com.radiotedumobile"* ]]; then
    sleep 25
    adb exec-out screencap -p > "$output"
    test -s "$output"
    exit 0
  fi
  if (( attempt % 5 == 0 )); then
    adb shell am start -n "$component" >/dev/null
  fi
  sleep 2
done

adb shell dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp' || true
adb logcat -d -t 300 | grep -E 'AndroidRuntime|FATAL EXCEPTION|radiotedumobile' || true
exit 1
