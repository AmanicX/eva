# EVA v2.5.0 — Image Gen

Testing release for `AmanicX/nexus-testing` only.

## Added
- A larger Image Gen editor with Recent chat, AI ideas and Manual modes.
- Four distinct contextual concepts from only the active chat's latest three
  messages, without memory, character biography, world lore or older history.
- Independent AI concepts, one-click short-idea expansion, and a selectable
  prompt writer that prefers stronger configured models.
- Anime, photographic, cinematic, watercolor, digital painting, 3D and pixel-art
  styles. Manual prompts are sent exactly as edited; style application is explicit.
- Stop/cancel controls, stale-result protection, responsive controls and
  keyboard-aware dialog sizing.

## Fixed
- Google native image generation uses image-capable Nano Banana models and
  `generateContent`, instead of retired Imagen `predict` calls.
- Pollinations image generation uses the current authenticated POST API.
  **A Pollinations API key is now required.** Account balance/model access apply.
- Permission, billing, quota, invalid-key, unsupported-model and safety errors
  are explained without leaking provider error payloads.
- Failed image requests never silently switch providers.
- Image response validation preserves the actual PNG/JPEG/WebP format.

## Compatibility and verification
- Existing v2.2.4 animations, chats, settings, credentials and image storage remain.
- Android production package identity, minimum Android version and signing
  rotation remain unchanged. Version code increases to 29.
- **The APK in this testing repository is Eva Testing**
  (`com.nexus.chatstudio.testing`), not an update to production EVA.
  This repository has no production signing secrets. Its debug certificate can
  change between CI runners, so an older Eva Testing install may not accept an
  in-place update. Export testing data before any manual reinstall; do not
  uninstall production EVA. No production signing keys were copied here.
- Provider HTTP was mocked during automated tests; live paid Google/Pollinations
  generation and physical Android/OnePlus 7T behavior have not been verified.
- Unit/integration and production Electron/Chromium UI checks cover context
  isolation, four concepts, expansion, manual/style behavior, billing errors,
  persistence, cancellation, narrow layouts and simulated keyboard resizing.
- Website, shared website assets and hosted `docs/app/` files are unchanged.

Installers are supplied for Windows, macOS, Linux and Android.
`SHA256SUMS.txt` contains download checksums.
