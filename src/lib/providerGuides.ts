/**
 * Verified Provider Setup Guides & Troubleshooting Database for Eva
 *
 * Provides accurate, provider-specific setup instructions, official documentation links,
 * step-by-step workflows, recommended models, and common error resolution advice.
 */

export interface GuideStep {
  number: number
  title: string
  instruction: string
  actionLabel?: string
  actionUrl?: string
  copySnippet?: string
  tip?: string
}

export interface CommonError {
  code: string
  title: string
  cause: string
  resolution: string
}

export interface ProviderGuide {
  id: string
  name: string
  tagline: string
  badge?: string
  badgeVariant?: 'accent' | 'neutral' | 'success'
  isLocal: boolean
  needsKey: boolean
  defaultBaseUrl: string
  keyPlaceholder: string
  officialWebsite: string
  keyManagementUrl?: string
  steps: GuideStep[]
  recommendedModels: {
    id: string
    name: string
    description: string
    badge?: string
  }[]
  commonErrors: CommonError[]
  requirements: string[]
}

export const PROVIDER_GUIDES: Record<string, ProviderGuide> = {
  groq: {
    id: 'groq',
    name: 'Groq',
    tagline: 'Ultra-fast LPU cloud inference with a generous free tier.',
    badge: 'Recommended',
    badgeVariant: 'accent',
    isLocal: false,
    needsKey: true,
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    keyPlaceholder: 'gsk_…',
    officialWebsite: 'https://groq.com',
    keyManagementUrl: 'https://console.groq.com/keys',
    requirements: [
      'A free Groq Cloud account',
      'No credit card required for standard tier',
      'High per-minute token throughput',
    ],
    steps: [
      {
        number: 1,
        title: 'Sign in to Groq Console',
        instruction: 'Visit the official Groq Console and log in with your Google, GitHub, or email account.',
        actionLabel: 'Open Groq Console',
        actionUrl: 'https://console.groq.com/keys',
      },
      {
        number: 2,
        title: 'Generate an API Key',
        instruction: 'Navigate to "API Keys" in the left sidebar menu and click "+ Create API Key". Give it a name such as "Eva Studio".',
        tip: 'Groq displays the key only once upon creation. Copy it immediately.',
      },
      {
        number: 3,
        title: 'Paste Key into Eva',
        instruction: 'Paste the key (starts with "gsk_") into the API key field below. Eva encrypts and stores your key securely on this device.',
      },
      {
        number: 4,
        title: 'Test & Verify Connection',
        instruction: 'Click "Test Connection" to fetch live available models and verify that Groq responds.',
      },
    ],
    recommendedModels: [
      {
        id: 'openai/gpt-oss-20b',
        name: 'GPT-OSS 20B',
        description: 'Default · exceptionally fast and creative, perfect for character dialogue and interactive scenes.',
        badge: 'Default',
      },
      {
        id: 'openai/gpt-oss-120b',
        name: 'GPT-OSS 120B',
        description: 'Largest reasoning model on Groq. Outstanding depth for complex storylines and world lore.',
        badge: 'Smartest',
      },
      {
        id: 'qwen/qwen3.8-27b',
        name: 'Qwen 3 27B',
        description: 'Nuanced, multilingual, and highly responsive to personality and style directives.',
      },
      {
        id: 'allam-2-7b',
        name: 'Allam 2 7B',
        description: 'Lightweight model with lightning-quick token latency.',
      },
    ],
    commonErrors: [
      {
        code: '401',
        title: 'Invalid or missing API key',
        cause: 'The key was entered incorrectly, contains leading/trailing spaces, or has been revoked.',
        resolution: 'Check console.groq.com/keys, verify the key starts with "gsk_", and paste it again.',
      },
      {
        code: '429',
        title: 'Rate limit reached (TPM / RPM)',
        cause: 'You exceeded the free tier tokens-per-minute or requests-per-minute quota.',
        resolution: 'Wait 15 to 30 seconds before sending another message, or switch to a lighter model like Qwen 27B.',
      },
      {
        code: '404',
        title: 'Model ID not found',
        cause: 'The selected model has been retired or misspelled in settings.',
        resolution: 'Click "Test Connection" or ↻ to refresh the list of currently supported models from Groq.',
      },
    ],
  },

  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    tagline: 'Universal API gateway accessing hundreds of open-source and commercial models.',
    badge: 'Wide Catalog',
    badgeVariant: 'neutral',
    isLocal: false,
    needsKey: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    keyPlaceholder: 'sk-or-v1-…',
    officialWebsite: 'https://openrouter.ai',
    keyManagementUrl: 'https://openrouter.ai/keys',
    requirements: [
      'OpenRouter account',
      'Free models available (suffixed with :free)',
      'Prepaid balance needed for premium models',
    ],
    steps: [
      {
        number: 1,
        title: 'Create an OpenRouter Account',
        instruction: 'Sign in to OpenRouter using your Google, GitHub, or Web3 wallet.',
        actionLabel: 'Open OpenRouter Keys',
        actionUrl: 'https://openrouter.ai/keys',
      },
      {
        number: 2,
        title: 'Create a New Key',
        instruction: 'Go to the Keys page, click "Create Key", name it "Eva", and leave credit limit blank or set a cap.',
      },
      {
        number: 3,
        title: 'Paste Key into Eva',
        instruction: 'Paste the key (begins with "sk-or-v1-") into the API key field below.',
        tip: 'If you do not wish to add credits, select models with the ":free" suffix.',
      },
      {
        number: 4,
        title: 'Test Connection',
        instruction: 'Click "Test Connection" to query the OpenRouter endpoint and list available models.',
      },
    ],
    recommendedModels: [
      {
        id: 'cognitivecomputations/dolphin-mixtral-8x22b',
        name: 'Dolphin Mixtral 8x22B',
        description: 'Uncensored, expressive, top choice for authentic and unconstrained character roleplay.',
        badge: 'Roleplay',
      },
      {
        id: 'sao10k/l3.1-euryale-70b',
        name: 'Euryale 70B v2.2',
        description: 'Specialized creative writing model with rich character nuance and emotional depth.',
      },
      {
        id: 'mistralai/mistral-nemo',
        name: 'Mistral Nemo',
        description: '12B parameter model with huge 128k context window and crisp dialogue tone.',
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        name: 'Llama 3.3 70B (Free)',
        description: 'High intelligence and knowledge with 0 credit cost on OpenRouter.',
        badge: 'Free',
      },
    ],
    commonErrors: [
      {
        code: '401',
        title: 'Unauthorized / Invalid Key',
        cause: 'The OpenRouter key is invalid or truncated.',
        resolution: 'Ensure the key starts with "sk-or-v1-" and is copied completely from openrouter.ai/keys.',
      },
      {
        code: '402',
        title: 'Payment Required / Insufficient Balance',
        cause: 'Your OpenRouter credit balance is zero or exhausted for this paid model.',
        resolution: 'Add credits at openrouter.ai/credits or select a model marked ":free".',
      },
      {
        code: '429',
        title: 'Upstream Provider Rate Limit',
        cause: 'The underlying provider for the selected model is busy.',
        resolution: 'Retry in a few seconds or switch to an alternate provider routing on OpenRouter.',
      },
    ],
  },

  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    tagline: 'Run powerful models completely offline on your own machine with 100% data privacy.',
    badge: 'Private & Offline',
    badgeVariant: 'success',
    isLocal: true,
    needsKey: false,
    defaultBaseUrl: 'http://localhost:11434/v1',
    keyPlaceholder: 'Not needed for local servers',
    officialWebsite: 'https://ollama.com',
    requirements: [
      'Ollama installed and running locally on your PC/Mac',
      'No API key required',
      'Sufficient RAM or VRAM for your chosen model',
    ],
    steps: [
      {
        number: 1,
        title: 'Download and Install Ollama',
        instruction: 'Download Ollama for your operating system (macOS, Windows, or Linux) and run the installer.',
        actionLabel: 'Download Ollama',
        actionUrl: 'https://ollama.com/download',
      },
      {
        number: 2,
        title: 'Pull a Model in Terminal',
        instruction: 'Open your terminal or command prompt and run the command to download your first model (e.g. Llama 3.2 3B).',
        copySnippet: 'ollama run llama3.2:3b',
        tip: 'Once downloaded, Ollama is ready to receive requests.',
      },
      {
        number: 3,
        title: 'Configure CORS (Web & Android only)',
        instruction: 'On desktop Electron, no extra config is needed. If using Eva in a web browser, start Ollama with OLLAMA_ORIGINS="*" to allow web requests. On Android phones, replace "localhost" with your computer’s Wi-Fi IP.',
        copySnippet: 'OLLAMA_ORIGINS="*" ollama serve',
      },
      {
        number: 4,
        title: 'Test Connection',
        instruction: 'Make sure Ollama is running in the background, then click "Test Connection" to fetch your installed models.',
      },
    ],
    recommendedModels: [
      {
        id: 'llama3.2:3b',
        name: 'Llama 3.2 3B',
        description: 'Fast, lightweight, runs smoothly on CPU and laptops with 8GB RAM.',
        badge: 'Lightweight',
      },
      {
        id: 'mistral:7b',
        name: 'Mistral 7B',
        description: 'Balanced speed and narrative roleplay depth; recommended for 16GB+ machines.',
      },
      {
        id: 'qwen2.5:7b',
        name: 'Qwen 2.5 7B',
        description: 'Superb writing comprehension, character adherence, and multi-language support.',
      },
      {
        id: 'gemma4:e4b',
        name: 'Gemma 4B',
        description: 'Modern compact weights from Google, quick inference.',
      },
    ],
    commonErrors: [
      {
        code: 'ECONNREFUSED',
        title: 'Connection Refused / Failed to Fetch',
        cause: 'Ollama is not currently running on http://localhost:11434.',
        resolution: 'Launch the Ollama app or run "ollama serve" in your terminal, then click Test again.',
      },
      {
        code: 'CORS',
        title: 'Cross-Origin Request Blocked (Browser)',
        cause: 'Browser security prevented connecting to localhost without CORS headers.',
        resolution: 'Start Ollama with OLLAMA_ORIGINS="*" environment variable, or use the Eva desktop app.',
      },
      {
        code: 'MOBILE_IP',
        title: 'Cannot reach localhost on Android',
        cause: 'On Android phones, "localhost" refers to the phone itself, not your PC.',
        resolution: 'Replace "localhost" with your PC\'s local network IP address (e.g. http://192.168.1.150:11434/v1).',
      },
    ],
  },

  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio',
    tagline: 'Visual desktop application for finding, downloading, and serving GGUF models.',
    badge: 'Visual Local GUI',
    badgeVariant: 'neutral',
    isLocal: true,
    needsKey: false,
    defaultBaseUrl: 'http://localhost:1234/v1',
    keyPlaceholder: 'Not needed for local servers',
    officialWebsite: 'https://lmstudio.ai',
    requirements: [
      'LM Studio installed on your computer',
      'A downloaded GGUF model loaded in memory',
      'Local server started in LM Studio',
    ],
    steps: [
      {
        number: 1,
        title: 'Install LM Studio',
        instruction: 'Download and install LM Studio from lmstudio.ai on your Mac, Windows, or Linux system.',
        actionLabel: 'Download LM Studio',
        actionUrl: 'https://lmstudio.ai',
      },
      {
        number: 2,
        title: 'Download a Model',
        instruction: 'Inside LM Studio, use the search tab (magnifying glass) to search and download any GGUF model (e.g., Llama 3.2, Qwen 2.5, Gemma).',
      },
      {
        number: 3,
        title: 'Start the Local Server & Enable CORS',
        instruction: 'Click the "<->" (Developer / Local Server) tab on the left sidebar. Select your model at the top, toggle "Start Server" ON, and ensure "Cross-Origin-Resource-Sharing (CORS)" is enabled.',
        tip: 'The default server address is http://localhost:1234/v1.',
      },
      {
        number: 4,
        title: 'Verify Connection in Eva',
        instruction: 'Click "Test Connection" in Eva to connect to your active LM Studio server session.',
      },
    ],
    recommendedModels: [
      {
        id: 'loaded-model',
        name: 'Currently Loaded Model',
        description: 'LM Studio automatically processes prompts using whichever model is currently loaded in its memory.',
        badge: 'Dynamic',
      },
    ],
    commonErrors: [
      {
        code: 'SERVER_OFF',
        title: 'Local Server Stopped',
        cause: 'The server in LM Studio is not active.',
        resolution: 'Open LM Studio, navigate to the Developer tab (<->), and click "Start Server".',
      },
      {
        code: 'NO_MODEL',
        title: 'No Model Loaded',
        cause: 'The server is running but no model is loaded in memory.',
        resolution: 'Select and load a model from the top dropdown in LM Studio\'s Developer tab.',
      },
      {
        code: 'CORS',
        title: 'CORS Blocked',
        cause: 'LM Studio refused the browser connection origin.',
        resolution: 'In LM Studio server settings, ensure "Enable CORS" is checked.',
      },
    ],
  },

  ollamacloud: {
    id: 'ollamacloud',
    name: 'Ollama Cloud',
    tagline: 'Hosted Ollama cloud service for high-parameter models without local hardware.',
    badge: 'Cloud Hosted',
    badgeVariant: 'neutral',
    isLocal: false,
    needsKey: true,
    defaultBaseUrl: 'https://ollama.com/v1',
    keyPlaceholder: 'ollama_…',
    officialWebsite: 'https://ollama.com',
    keyManagementUrl: 'https://ollama.com/settings/keys',
    requirements: [
      'Ollama.com account',
      'Personal API token',
    ],
    steps: [
      {
        number: 1,
        title: 'Log in to Ollama.com',
        instruction: 'Sign in to your account at ollama.com.',
        actionLabel: 'Ollama Cloud Settings',
        actionUrl: 'https://ollama.com/settings/keys',
      },
      {
        number: 2,
        title: 'Generate an API Key',
        instruction: 'Go to Settings -> Keys and create a personal API key for cloud access.',
      },
      {
        number: 3,
        title: 'Paste Key into Eva',
        instruction: 'Paste your token into the API key field below.',
      },
      {
        number: 4,
        title: 'Test Connection',
        instruction: 'Click "Test Connection" to query available hosted models.',
      },
    ],
    recommendedModels: [
      {
        id: 'llama3.3:70b',
        name: 'Llama 3.3 70B',
        description: 'Flagship 70B parameter open weights with deep conversational reasoning.',
      },
      {
        id: 'deepseek-r1:70b',
        name: 'DeepSeek R1 70B',
        description: 'Advanced logical reasoning and immersive world state understanding.',
      },
      {
        id: 'qwen2.5:72b',
        name: 'Qwen 2.5 72B',
        description: 'Multilingual and literary excellence for character roleplay.',
      },
    ],
    commonErrors: [
      {
        code: '401',
        title: 'Unauthorized',
        cause: 'The Ollama Cloud key is invalid or expired.',
        resolution: 'Generate a new key at ollama.com/settings/keys and paste it into Eva.',
      },
    ],
  },

  openai: {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'Official OpenAI developer platform for GPT-4o and reasoning models.',
    badge: 'Official API',
    badgeVariant: 'neutral',
    isLocal: false,
    needsKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyPlaceholder: 'sk-proj-…',
    officialWebsite: 'https://openai.com',
    keyManagementUrl: 'https://platform.openai.com/api-keys',
    requirements: [
      'OpenAI developer account',
      'Prepaid credit balance on OpenAI platform (ChatGPT Plus does not include API credits)',
    ],
    steps: [
      {
        number: 1,
        title: 'Sign in to OpenAI Developer Platform',
        instruction: 'Visit platform.openai.com and log in with your OpenAI account.',
        actionLabel: 'Open OpenAI Keys',
        actionUrl: 'https://platform.openai.com/api-keys',
      },
      {
        number: 2,
        title: 'Create a Secret Key',
        instruction: 'Navigate to Dashboard -> API Keys. Click "+ Create new secret key", name it "Eva", and copy the generated key.',
      },
      {
        number: 3,
        title: 'Verify API Credit Balance',
        instruction: 'Note: A ChatGPT Plus subscription does NOT fund the API. Go to Settings -> Billing and ensure you have prepaid credits.',
        actionLabel: 'OpenAI Billing',
        actionUrl: 'https://platform.openai.com/settings/organization/billing',
        tip: 'Without API credits, OpenAI returns a 429 Insufficient Quota error.',
      },
      {
        number: 4,
        title: 'Paste Key & Test Connection',
        instruction: 'Paste your "sk-..." key into Eva and click "Test Connection".',
      },
    ],
    recommendedModels: [
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Cost-effective, highly intelligent, and very fast. Recommended OpenAI model.',
        badge: 'Recommended',
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Flagship omni model with highest conversational fidelity and character adherence.',
      },
      {
        id: 'gpt-4.1-mini',
        name: 'GPT-4.1 Mini',
        description: 'Enhanced context handling and updated world knowledge.',
      },
    ],
    commonErrors: [
      {
        code: '401',
        title: 'Invalid Authentication',
        cause: 'The API key is incorrect or truncated.',
        resolution: 'Check platform.openai.com/api-keys and ensure the full key starting with "sk-" is pasted.',
      },
      {
        code: '429',
        title: 'Insufficient Quota',
        cause: 'Your OpenAI account has 0.00 credit balance.',
        resolution: 'Add prepaid credits at platform.openai.com/settings/organization/billing.',
      },
    ],
  },

  custom: {
    id: 'custom',
    name: 'Custom Endpoint',
    tagline: 'Connect any OpenAI-compatible server (DeepSeek, Mistral, vLLM, Aphrodite, text-generation-webui).',
    badge: 'Any Provider',
    badgeVariant: 'neutral',
    isLocal: false,
    needsKey: true,
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    keyPlaceholder: 'API key if required by your server',
    officialWebsite: '',
    requirements: [
      'Endpoint must support standard OpenAI /chat/completions format',
      'Base URL must end with /v1',
    ],
    steps: [
      {
        number: 1,
        title: 'Specify Base URL',
        instruction: 'Enter your provider’s root API URL ending with "/v1" (e.g. "https://api.deepseek.com/v1" or "http://192.168.1.10:8000/v1").',
      },
      {
        number: 2,
        title: 'Enter API Key (if required)',
        instruction: 'If your custom server requires an Authorization header, paste the API key. Otherwise leave it blank.',
      },
      {
        number: 3,
        title: 'Set Model Identifier',
        instruction: 'Type the exact model ID that your custom endpoint serves, or click ↻ to query the /models endpoint.',
      },
      {
        number: 4,
        title: 'Test Connection',
        instruction: 'Click "Test Connection" to confirm Eva can send and receive completions from your endpoint.',
      },
    ],
    recommendedModels: [],
    commonErrors: [
      {
        code: 'NETWORK',
        title: 'Endpoint Unreachable',
        cause: 'The server is offline, the URL is misspelled, or CORS is blocking the request.',
        resolution: 'Verify the URL begins with http:// or https:// and ends with /v1.',
      },
      {
        code: '401',
        title: 'Unauthorized',
        cause: 'The server rejected the API key.',
        resolution: 'Check your server authentication settings.',
      },
    ],
  },
}

/**
 * Finds the appropriate provider guide matching the current Base URL.
 */
export function getGuideForBaseUrl(baseUrl: string): ProviderGuide {
  const clean = baseUrl.trim().toLowerCase().replace(/\/+$/, '')
  if (clean.includes('api.groq.com')) return PROVIDER_GUIDES.groq
  if (clean.includes('openrouter.ai')) return PROVIDER_GUIDES.openrouter
  if (clean.includes('11434')) return PROVIDER_GUIDES.ollama
  if (clean.includes('1234')) return PROVIDER_GUIDES.lmstudio
  if (clean.includes('ollama.com')) return PROVIDER_GUIDES.ollamacloud
  if (clean.includes('api.openai.com')) return PROVIDER_GUIDES.openai
  return PROVIDER_GUIDES.custom
}
