# Eva 2.2.3

Production update from **2.2.2**. Download **Eva-android.apk**.

## Android update and signing

- Keeps the original `com.nexus.chatstudio` application ID and launcher name
  **Eva**, so this is an update to the original app, not Eva Testing.
- Uses a new securely stored production signing key and APK Signature Scheme
  v3 proof of rotation from the original certificate.
- Internal Android version code is **27**, higher than previous production
  and testing builds despite the public version being 2.2.3.
- **Android 9 or newer is now required.** Android 7/8 users must stay on 2.2.2.
  This avoids signing new APKs with the exposed legacy key.
- CI verifies signatures and package identity and tests an actual 2.2.2 to
  2.2.3 in-place installation on Android 16 before publication.

## Fixes since production 2.2.2

- Correct provider/model precedence and provider-specific credential selection,
  including connection tests and character generation.
- Stronger local-model privacy: cloud fallback and auxiliary cloud requests
  are avoided when local-only behavior is selected.
- Improved streaming, cancellation handling, refusal-check timeouts, and `top_p`
  forwarding.
- Backup validation and settings normalization, plus a crash-recovery screen.
- Broader data erasure covering saved credentials and cached images.
- Memory summarization based on conversation turns rather than raw positions.
- More reliable saved-image restoration and corrected image downloading.
- Dialog focus handling, keyboard navigation, chat-menu labeling and layering.
- Removed embedded signing credentials; release signing is fail-closed.
- Prevents desktop build jobs from independently creating duplicate releases.

API-key format-check removal and cloud-sync removal already shipped in 2.2.2
and are **not new** in this release.

## Important

Install over the **original Eva**. The separate **Eva Testing** app has a different
package ID and will not be replaced or automatically migrated. Do not uninstall
the original app or clear its data to perform this update.

The website, website assets, and hosted web-app files were not changed.
