# Privacy Policy

**Effective Date:** January 1, 2026  
**Application:** Eva - AI Character & Conversation Studio  
**Repository:** [https://github.com/AmanicX/eva](https://github.com/AmanicX/eva)

---

## Our Privacy Commitment

**Eva is designed with a privacy-first, zero-knowledge client-side architecture.** We believe your thoughts, creative writing, and conversations belong solely to you.

### 1. No Telemetry, No Analytics, No Tracking
- Eva does **NOT** contain any analytics SDKs (e.g., Google Analytics, PostHog, Mixpanel).
- Eva does **NOT** track user identities, device fingerprints, IP addresses, or session durations.
- Eva does **NOT** use tracking cookies or advertising pixels.

### 2. Client-Side Local Storage & Zero-Knowledge Architecture
- All characters, custom world states, conversations, message histories, memory banks, and UI preferences are stored **strictly on your local device**:
  - In web environments: stored via browser `IndexedDB` and `localStorage`.
  - In desktop environments (Electron): protected by operating system credentials / safeStorage and local user data directory.
  - In Android environments (Capacitor): protected within the sandboxed application container and Android Keystore.
- None of this data is ever transmitted to a central Eva server because **no central Eva server exists**.

### 3. Local Model Privacy Guarantee (Zero External Traffic)
- When you use local AI providers (such as Ollama, LM Studio, or local endpoints on localhost / 127.0.0.1):
  - **Zero external network requests** are made.
  - Excerpts of your prompt and response are **never** sent to cloud models for refusal classification, content moderation, or image safety checks. Refusal and content evaluation are performed entirely on-device via local regular expression heuristics.
  - Merely having a saved cloud API key does not imply consent to route local conversations through cloud providers.
  - Cloud fallback is strictly opt-in via **Settings → Allow Cloud Fallback**. When disabled (the default), failed local inference will fail locally rather than silently leaking data to Pollinations, Groq, or other cloud providers.

### 4. API Key & Credential Isolation
- Your API keys are stored securely using hardware-backed isolation where available:
  - Electron: Backed by OS Keychain / Secret Service / DPAPI via `safeStorage`.
  - Android: Backed by hardware Keystore AES-256-GCM.
  - Web: Stored in memory by default, or browser storage only with explicit user opt-in.
- Every API key is strictly isolated to its designated provider:
  - Groq keys are only sent to Groq endpoints.
  - OpenAI keys are only sent to OpenAI endpoints.
  - Cloudflare tokens and account IDs are only sent to Cloudflare endpoints.
  - Custom endpoints require explicit credential configuration and will never silently reuse other provider keys.

### 5. Direct Third-Party Communications
- When you send a message using a cloud provider, your client application communicates directly via HTTPS to that provider's API endpoint.
- Please review your chosen AI provider's privacy policy (e.g. [Groq Privacy Policy](https://groq.com/privacy/), [OpenRouter Privacy Policy](https://openrouter.ai/privacy), [OpenAI Privacy Policy](https://openai.com/privacy), [Google AI Privacy](https://ai.google.dev/terms)) to understand how they process prompt data.

### 6. Data Deletion & Cryptographic Erasure
- You have 100% control over your data.
- **Export Data**: You can export your full character, world, and conversation data at any time via **Settings → Data → Export Data**. Backups strip API keys to prevent accidental leaks.
- **Erase Everything**: You can permanently erase all local application state, conversation history, cached image binaries in IndexedDB, and hardware-stored credentials at any time via **Settings → Data → Erase everything**.

### 7. Children's Privacy
- Eva is intended for adult users (age 18 and older). Eva does not knowingly collect any data from minors. All character ages are strictly constrained to 18+.

### 8. Questions & Verification
Eva is open source. You can inspect the source code, verify network traffic, and audit privacy controls at:  
**[https://github.com/AmanicX/eva](https://github.com/AmanicX/eva)**
