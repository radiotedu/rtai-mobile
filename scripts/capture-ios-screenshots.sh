#!/usr/bin/env bash
set -euo pipefail

app="$1"
output_dir="$2"
mkdir -p "$output_dir"

device_id() {
  xcrun simctl list devices available | sed -nE "/$1/{s/.*\(([0-9A-F-]{36})\).*/\1/p;q;}"
}

capture() {
  local udid="$1"
  local output="$2"
  test -n "$udid"
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b
  xcrun simctl install "$udid" "$app"
  xcrun simctl launch "$udid" com.radiotedumobile
  sleep 15
  xcrun simctl io "$udid" screenshot "$output"
  xcrun simctl shutdown "$udid"
}

capture "$(device_id 'iPhone')" "$output_dir/ios-iphone.png"
capture "$(device_id 'iPad')" "$output_dir/ios-ipad.png"
