# Android Signing Key Remediation & Rotation Strategy

## 1. Overview & Security Assessment

The initial repository contained a committed keystore (`android/nexus-release.keystore`) with default credentials (`nexusapp2026`). In accordance with security best practices:
- **Status:** The old signing key is treated as **compromised**.
- **Remediation:** The committed keystore has been removed from git tracking, `.gitignore` updated to strictly exclude all keystores (`*.keystore`, `*.jks`, `*.p12`), and hardcoded password fallbacks eliminated.
- **Application ID:** Preserved as `com.nexus.chatstudio` to maintain application identity and ecosystem compatibility.

---

## 2. Certificate Identification

### Legacy (Compromised) Certificate
- **Distinguished Name:** `CN=Nexus, OU=Nexus, O=Nexus, L=Web, ST=Web, C=US`
- **Key Algorithm:** RSA 2048-bit
- **Serial Number:** `10593565129274090815`
- **SHA-256 Fingerprint:** `5D:1C:55:63:2B:69:70:D0:99:7A:AC:23:F3:80:FA:20:DE:8F:E5:A4:6B:B3:26:05:C2:0E:B3:B9:EC:DF:76:AE`
- **Validity:** 2026-10-17 to 2054-03-04 UTC

### New Production Certificate (Eva)
- **Distinguished Name:** `CN=Eva, OU=Eva Mobile, O=AmanicX, C=US`
- **Key Algorithm:** RSA 4096-bit (or EC P-256)
- **Key Alias:** `eva`
- **Storage:** Kept exclusively in GitHub Actions Encrypted Secrets (`ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`). Never committed to source control.

---

## 3. Key Rotation & APK Signature Scheme v3 Proof-of-Rotation

Android 9 (API level 28) and higher support **APK Signature Scheme v3**, which permits application signing key rotation with cryptographic proof:

1. **Rotation Lineage Generation:**
   Using Android's official `apksigner` tool:
   ```bash
   apksigner rotate \
     --out eva-lineage.bin \
     --old-signer --ks nexus-release.keystore --ks-key-alias nexus \
     --new-signer --ks eva-release.keystore --ks-key-alias eva
   ```

2. **Signing with Proof-of-Rotation:**
   When signing the release APK:
   ```bash
   apksigner sign \
     --ks eva-release.keystore \
     --ks-key-alias eva \
     --lineage eva-lineage.bin \
     --rotation-min-sdk 28 \
     Eva-android.apk
   ```

3. **Behavior Across Android Versions:**
   - **Android 9+ (API 28+):** The Android Package Manager validates that the new certificate was authorized by the old certificate via the cryptographically signed lineage. Existing installs update in-place without data loss.
   - **Android 8.1 and below (API <= 27):** Key rotation lineages are not supported by the OS Package Manager. Users must perform a manual migration.

---

## 4. User Migration & Recovery Instructions

For users running legacy Android or upgrading without signature lineage:
1. Open the existing Eva / Nexus app on Android.
2. Go to **Settings → Cloud Backup & Sync** and connect a Google or GitHub account (or go to **Settings → Data Management** and export a local backup JSON).
3. Confirm the backup is synced or saved safely.
4. Uninstall the older APK.
5. Install the new release `Eva-android.apk`.
6. Open **Settings → Cloud Backup & Sync**, connect the account, and tap **Restore from cloud** (or import the local backup JSON).
7. All characters, conversations, messages, worlds, and preferences are seamlessly restored.

---

## 5. Build Environment Enforcement

In `android/app/build.gradle`:
- `signingConfigs.debug` uses standard debug keys for local development.
- `signingConfigs.release` requires environment variables:
  - `ANDROID_KEYSTORE_PATH`
  - `KEYSTORE_PASSWORD`
  - `KEY_ALIAS`
  - `KEY_PASSWORD`
- If release signing variables are missing during release assembly, Gradle immediately aborts the build with `GradleException`. Hardcoded fallback passwords have been completely eradicated.
