#!/usr/bin/env bash
set -euo pipefail

TEMP_DIR=$(mktemp -d)
trap 'rm -f "$TEMP_DIR/Eva-android.apk"; rmdir "$TEMP_DIR"' EXIT
gh release download v2.2.2 -R AmanicX/eva --pattern Eva-android.apk --dir "$TEMP_DIR"
printf '%s  %s\n' \
  'c4f740d82a1a66959cd6c0917a1497b3c4f8d0b39b5af163a3d8ea355c47a7d9' \
  "$TEMP_DIR/Eva-android.apk" | sha256sum -c -

adb install "$TEMP_DIR/Eva-android.apk"
adb shell am start -W -n com.nexus.chatstudio/.MainActivity
BEFORE_UID=$(adb shell pm list packages -U com.nexus.chatstudio | tr -d '\r')
test -n "$BEFORE_UID"
adb shell am force-stop com.nexus.chatstudio

# A successful -r update validates the original-to-new certificate lineage.
adb install -r out/Eva-android.apk
AFTER_UID=$(adb shell pm list packages -U com.nexus.chatstudio | tr -d '\r')
test "$BEFORE_UID" = "$AFTER_UID"
PACKAGE_INFO=$(adb shell dumpsys package com.nexus.chatstudio | tr -d '\r')
grep -q 'versionCode=27 ' <<< "$PACKAGE_INFO"
grep -q 'versionName=2.2.3' <<< "$PACKAGE_INFO"
adb shell am start -W -n com.nexus.chatstudio/.MainActivity
adb shell pidof com.nexus.chatstudio
echo "Android 16: production 2.2.2 -> 2.2.3 installed in place with the same app UID and launched."
