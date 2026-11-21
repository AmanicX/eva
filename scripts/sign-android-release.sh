#!/usr/bin/env bash
set -euo pipefail
umask 077

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:?Android SDK is required}}"
TOOLS=$(find "$SDK/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)
APKSIGNER="$TOOLS/apksigner"
LINEAGE="android/eva-signing-lineage.bin"
APK="android/app/build/outputs/apk/release/app-release.apk"
KEYSTORE="${ANDROID_KEYSTORE_PATH:?Production keystore path is required}"
TEMP_DIR=$(mktemp -d)
trap 'rm -f "$TEMP_DIR/legacy.keystore" "$TEMP_DIR/rotated.apk"; rmdir "$TEMP_DIR"' EXIT

if [ -n "${ANDROID_SIGNING_LINEAGE_BASE64:-}" ]; then
  printf '%s' "$ANDROID_SIGNING_LINEAGE_BASE64" | base64 --decode > "$LINEAGE"
elif [ "${GITHUB_EVENT_NAME:-}" = "workflow_dispatch" ] && [ -n "${ANDROID_LEGACY_KEYSTORE_BASE64:-}" ] && [ -n "${ANDROID_LEGACY_KEYSTORE_PASSWORD:-}" ]; then
  # One-time owner-approved migration. Never use this key for ordinary APK signing.
  printf '%s' "$ANDROID_LEGACY_KEYSTORE_BASE64" | base64 --decode > "$TEMP_DIR/legacy.keystore"
  LEGACY_SHA=$(keytool -exportcert -keystore "$TEMP_DIR/legacy.keystore" \
    -storepass:env ANDROID_LEGACY_KEYSTORE_PASSWORD -alias nexus | sha256sum | cut -d ' ' -f 1)
  test "$LEGACY_SHA" = "5d1c55632b6970d0997aac23f380fa20de8fe5a46bb32605c20eb3b9ecdf76ae"
  "$APKSIGNER" rotate --out "$LINEAGE" \
    --old-signer --ks "$TEMP_DIR/legacy.keystore" --ks-key-alias nexus \
    --ks-pass env:ANDROID_LEGACY_KEYSTORE_PASSWORD --key-pass env:ANDROID_LEGACY_KEYSTORE_PASSWORD \
    --new-signer --ks "$KEYSTORE" --ks-key-alias "$KEY_ALIAS" \
    --ks-pass env:KEYSTORE_PASSWORD --key-pass env:KEY_PASSWORD
  rm -f "$TEMP_DIR/legacy.keystore"
else
  echo "Missing signing lineage. Tagged production releases cannot regenerate it from the legacy key." >&2
  exit 1
fi

# Android 9+ supports v3 proof of rotation. No v1/v2 fallback signed by the exposed key.
"$APKSIGNER" sign --ks "$KEYSTORE" --ks-key-alias "$KEY_ALIAS" \
  --ks-pass env:KEYSTORE_PASSWORD --key-pass env:KEY_PASSWORD \
  --lineage "$LINEAGE" --rotation-min-sdk-version 28 \
  --v1-signing-enabled false --v2-signing-enabled false \
  --v3-signing-enabled true --v4-signing-enabled false \
  --out "$TEMP_DIR/rotated.apk" "$APK"
VERIFICATION=$("$APKSIGNER" verify --verbose --print-certs "$TEMP_DIR/rotated.apk")
printf '%s\n' "$VERIFICATION"
grep -Fq 'Verified using v3 scheme (APK Signature Scheme v3): true' <<< "$VERIFICATION"
grep -Fq '316b81f69d8ba5114b5205d5f3ab8939e8279b6d44c1717e7674cb619082e895' <<< "$VERIFICATION"
mv "$TEMP_DIR/rotated.apk" "$APK"
