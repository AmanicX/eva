#!/usr/bin/env bash
set -euo pipefail

# Generates a new Android release keystore securely without committing it to git.
OUTPUT_KEYSTORE="${1:-android/nexus-release.keystore}"
KEY_ALIAS="${2:-nexus}"

echo "Generating new secure Android Keystore at: $OUTPUT_KEYSTORE"
echo "Make sure this keystore is NEVER committed to git or public repositories."

keytool -genkeypair -v \
  -keystore "$OUTPUT_KEYSTORE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

echo ""
echo "Keystore created successfully at: $OUTPUT_KEYSTORE"
echo "To use in GitHub Actions:"
echo "1. Encode keystore to base64: base64 -w 0 $OUTPUT_KEYSTORE"
echo "2. Add secret ANDROID_KEYSTORE_BASE64 to GitHub repository secrets."
echo "3. Add secret KEYSTORE_PASSWORD, KEY_ALIAS, and KEY_PASSWORD to GitHub repository secrets."
