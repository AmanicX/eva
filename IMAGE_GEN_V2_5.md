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
