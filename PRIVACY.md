# Privacy Policy

**Effective Date:** January 1, 2026  
**Application:** Eva - Advanced AI Chatbot  
**Repository:** [https://github.com/AmanicX/eva](https://github.com/AmanicX/eva)

---

## Our Privacy Commitment

**Eva is designed with a privacy-first, zero-knowledge architecture.** We believe your thoughts, creative writing, and conversations belong solely to you.

### 1. No Telemetry, No Analytics, No Tracking
- Eva does **NOT** contain any analytics SDKs (e.g., Google Analytics, PostHog, Mixpanel).
- Eva does **NOT** track user identities, device fingerprints, IP addresses, or session durations.
- Eva does **NOT** use tracking cookies or advertising pixels.

### 2. Client-Side Local Storage & Zero-Knowledge Architecture
- All characters, custom world states, conversations, message histories, memory banks, and UI preferences are stored **strictly on your local device**:
  - In web environments: stored via browser `IndexedDB` and `localStorage`.
  - In desktop environments (Electron): stored in your local user data directory.
  - In Android environments (Capacitor): stored within the sandboxed application container.
- None of this data is ever synced to a central Eva server because **no central Eva server exists**.

### 3. Optional Cloud Backup & Cross-Device Synchronization (End-to-End Encrypted)
- Cross-device sync and cloud backup are **strictly optional**. You can use Eva entirely offline or locally without connecting any third-party account.
- If you choose to enable cloud backup via Google Drive or GitHub:
  - **Zero-Knowledge Client-Side Encryption:** All application data is encrypted on your local device with **AES-256-GCM** using keys derived via **PBKDF2 with 600,000 iterations** before transmission.
  - **No Plaintext in the Cloud:** Cloud providers (Google and GitHub) only ever receive encrypted ciphertext. They cannot inspect, decrypt, or access your characters, conversations, or worlds.
  - **Isolated Storage Scopes:**
    - Google Drive uses the isolated `appDataFolder` (`drive.appdata` scope), which is completely invisible to other applications and separate from your personal files.
    - GitHub uses private, authenticated Gists (`gist` scope) owned exclusively by your account.
  - **Zero Credential Transmission:** Your AI provider API keys, encryption passphrases, and OAuth access tokens are **never included** in cloud backup payloads. They remain stored locally in your operating system's secure credential storage.

### 4. API Key & Credential Security
- Your API keys (Groq, OpenRouter, OpenAI, etc.) are stored strictly on your local machine.
- Your keys are transmitted **only** to the specific provider endpoint URL that you configure in Settings.
- When using local models (Ollama, LM Studio), network traffic never leaves your local area network (LAN).

### 4. Direct Third-Party Communications
- When you send a message, your client application communicates directly via HTTPS to the API provider you specified.
- The provider receives the message payload and returns streaming tokens. Please review your AI provider's privacy policy (e.g. [Groq Privacy Policy](https://groq.com/privacy/), [OpenRouter Privacy Policy](https://openrouter.ai/privacy), [OpenAI Privacy Policy](https://openai.com/privacy)) to understand how they process prompt data.

### 5. Data Deletion & Export
- You have 100% control over your data.
- You can export your full character and conversation data at any time via **Settings → Data → Export Data**.
- You can permanently wipe all local application data at any time via **Settings → Data → Clear All Data**.

### 6. Children's Privacy
- Eva is intended for adult users (age 18 and older). Eva does not knowingly collect any data from minors.

### 7. Questions
For any questions regarding privacy or to inspect the source code, visit:  
**[https://github.com/AmanicX/eva](https://github.com/AmanicX/eva)**
