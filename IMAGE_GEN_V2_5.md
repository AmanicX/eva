# Image Gen v2.5

## Approved scope

- Start from v2.2.4 and retain its motion improvements.
- Rename the image feature to Image Gen. Enlarge the existing animated dialog,
  support narrow screens, keyboard resizing, cancellation and accessible controls.
- Chat ideas use only the active conversation's latest three messages, never
  memory, biography, world lore or older history.
- Return exactly four distinct concepts; validate output and reject duplicates.
- Offer a configurable prompt writer, styles (including anime), standalone AI
  ideas, short-idea expansion and manual prompts sent exactly as edited.
- Use supported Google image models and the correct native image API; distinguish
  credentials, permissions, billing, quota, unsupported models and safety blocks.
- Publish installers only to `AmanicX/nexus-testing`. Do not modify the website,
  website assets or `docs/app/`. Preserve Android production identity/signing.
- Verify the downloaded Linux installer before replacing local application
  binaries; retain chats, credentials, configuration and launchers.

## Audit (2026-11-22)

- Baseline: v2.2.4, 20 test files / 95 tests passing.
- Image suggestions currently send six messages, character biography and world
  descriptions; accept arbitrary counts and weakly validated strings.
- Modal initialization can reset edited settings; requests lack cancellation and
  stale-result checks.
- Google uses retired Imagen models, `:predict`, and hardcoded JPEG response
  handling. The keyed-provider cache can incorrectly hide an existing credential.
- Image errors silently fall through to other providers. Pollinations uses an
  obsolete endpoint and several obsolete style-as-model identifiers.
- Preserve existing image guard and IndexedDB storage. Returned image payloads
  need type/size validation; credentials must remain isolated by provider and
  must not appear in URLs, logs or user-facing API errors.
- Testing Android debug certificates are ephemeral between CI runs. A testing
  signing identity must stay separate from production; never copy production
  signing secrets to testing.

## Sources

- https://ai.google.dev/gemini-api/docs/imagen — Imagen shutdown and migration.
- https://ai.google.dev/gemini-api/docs/image-generation — native image models.
- https://ai.google.dev/api/generate-content — request and inline image response.
- https://gen.pollinations.ai/openapi.json — authenticated POST image generation.
- https://gen.pollinations.ai/image/models — current canonical IDs and aliases.

## Verification record

Provider tests use mocked HTTP/credentials, not a claim of live paid API success.
Record runtime, release and installation evidence below as completed.

- 125 unit/integration tests passing across 23 files.
- `npm run test:image-gen:ui`: production-bundle Electron/Chromium checks cover
  chat context isolation, four concepts, independent expansion, manual text
  preservation, explicit styles, billing errors, IndexedDB restoration after
  reload, close/reopen cancellation, 320/390/768/1440px, simulated visual-viewport
  keyboard resizing and reduced motion. No real credentials or provider requests.
- Screenshots reviewed at all four widths and in keyboard/reduced-motion states.
  Kept EVA's existing typography, gold accent and animated dialog rather than
  replacing the app's design system. Mobile controls stack; the footer stays
  visible while the editor body scrolls.
- No physical Android device attached. OnePlus 7T / Android 16 / 90 Hz behavior
  requires on-device verification; desktop emulation is not a substitute.
- PC application archive reports v2.2.4; no installed binaries changed yet.
- Dependency audit: zero high/critical; six existing moderate build-only findings
  stem from electron-builder's minimatch dependency (GHSA-g3hv-75wg-m249). Build
  globs come from this trusted repository, not remote/user content. No forced
  builder downgrade; review the upstream fix by 2026-12-06.

Run UI checks with a graphical session available (or Xvfb on Linux).
Playwright is a dev-only test dependency; tests reuse Electron's Chromium and
never open the user's EVA profile. Production website files remain untouched.

Release gate: v2.5.0 production-bundle UI checks pass; production dependency
audit reports zero vulnerabilities. Two pre-existing lint warnings remain in
DoneButton/ChatConfigModal; the existing large-bundle warning remains. No checks
or thresholds were suppressed. Inverting the exact-four validation caused five
writer tests to fail; the condition was restored and the suite passed.

Testing repository authentication restored using the checksum-verified official
GitHub CLI package. No signing secrets are configured in testing; the APK's
separate identity and debug-certificate update limitation are documented in the
release notes. Production signing configuration is unchanged.
