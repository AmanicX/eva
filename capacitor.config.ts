import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.nexus.chatstudio',
  appName: 'Eva',
  webDir: 'dist',
  android: {
    // Mixed content is permitted strictly to allow the WebView (served over https://localhost)
    // to connect to local-network LLM inference servers (Ollama, LM Studio, LocalAI).
    // Remote endpoints (Groq, OpenAI, Google Drive, GitHub) are strictly enforced to use HTTPS
    // via network_security_config.xml.
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
