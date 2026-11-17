import type { GroqModel } from '@/types'

export const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1'

import { isMobilePlatform, isLocalUrl } from './platform'

export interface ProviderPreset {
  id: string
  label: string
  baseUrl: string
  keyHint: string
  keyUrl?: string
}

/**
 * Any OpenAI-compatible endpoint works. The presets are just shortcuts —
 * the user can always type their own Base URL and model id.
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyHint: 'gsk_…',
    keyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'ollamacloud',
    label: 'Ollama Cloud',
    baseUrl: 'https://ollama.com/v1',
    keyHint: 'ollama_…',
    keyUrl: 'https://ollama.com/settings/keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyHint: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    keyHint: 'not needed',
  },
  {
    id: 'ollama',
    label: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    keyHint: 'not needed',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'google',
    label: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyHint: 'AIza…',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'pollinations',
    label: 'Pollinations.ai',
    baseUrl: 'https://text.pollinations.ai/openai',
    keyHint: 'optional token',
    keyUrl: 'https://pollinations.ai',
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1',
    keyHint: 'Account ID & API Token',
    keyUrl: 'https://dash.cloudflare.com/',
  },
]

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GroqChatOptions {
  apiKey: string
  model: string
  messages: ChatMessage[]
  baseUrl?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  signal?: AbortSignal
}

export const GROQ_MODELS: GroqModel[] = [
  {
    id: 'openai/gpt-oss-20b',
    label: 'GPT-OSS 20B',
    note: 'Default · free on Groq, fast and capable',
  },
  {
    id: 'openai/gpt-oss-120b',
    label: 'GPT-OSS 120B',
    note: 'Smartest overall, but stricter about mature content',
  },
  {
    id: 'qwen/qwen3.8-27b',
    label: 'Qwen3 27B',
    note: 'Nuanced, multilingual, expressive',
  },
  {
    id: 'allam-2-7b',
    label: 'Allam 2 7B',
    note: 'Lightweight and quick',
  },
]

/**
 * Suggested model ids per provider. These are just starting points — "fetch
 * models" pulls the provider's real, live list at runtime.
 */
export const MODEL_SUGGESTIONS: Record<string, string[]> = {
  groq: GROQ_MODELS.map((m) => m.id),
  ollamacloud: [
    'gemma4:31b',
    'gemma4:31b-cloud',
    'llama3.3:70b',
    'deepseek-r1:70b',
    'qwen2.5:72b',
    'mistral-large',
  ],
  openrouter: [
    'cognitivecomputations/dolphin-mixtral-8x22b',
    'sao10k/l3.1-euryale-70b',
    'mistralai/mistral-nemo',
    'anthropic/claude-3.5-sonnet',
  ],
  ollama: [
    'gemma4:e2b',
    'gemma4:e4b',
    'gemma4:12b',
    'llama3.2:3b',
    'mistral:7b',
    'qwen2.5:7b',
  ],
  lmstudio: [],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'],
  google: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ],
  pollinations: [
    'openai',
    'qwen',
    'mistral',
    'deepseek',
    'llama',
  ],
  cloudflare: [
    '@cf/meta/llama-3.3-70b-instruct',
    '@cf/meta/llama-3.1-8b-instruct',
    '@cf/mistral/mistral-7b-instruct-v0.2',
    '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    '@cf/qwen/qwen1.5-14b-chat-awq',
  ],
}

export function presetIdFor(baseUrl?: string): string | null {
  const base = resolveBaseUrl(baseUrl)
  return PROVIDER_PRESETS.find((p) => p.baseUrl === base)?.id ?? null
}

export function suggestionsFor(baseUrl?: string): string[] {
  const id = presetIdFor(baseUrl)
  return id ? (MODEL_SUGGESTIONS[id] ?? []) : []
}

const NON_CHAT = /whisper|tts|orpheus|prompt-guard|guard|embed|rerank|vision/i

export function resolveBaseUrl(baseUrl?: string, accountId?: string): string {
  let base = (baseUrl ?? '').trim() || DEFAULT_BASE_URL
  if (accountId && base.includes('{account_id}')) {
    base = base.replace('{account_id}', accountId.trim())
  }
  return base.replace(/\/+$/, '')
}

/** Local servers (Ollama, LM Studio…) ignore auth, so a key is optional for them. */
export function providerNeedsKey(baseUrl?: string): boolean {
  return !/localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(resolveBaseUrl(baseUrl))
}

function headers(apiKey: string, baseUrl?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const cleanKey = apiKey.trim()
  if (cleanKey) {
    h.Authorization = `Bearer ${cleanKey}`
    // Google AI Studio requires x-goog-api-key header
    if (baseUrl && /googleapis\.com/i.test(baseUrl)) {
      h['x-goog-api-key'] = cleanKey
    }
  }
  return h
}

function errorFrom(body: string, status: number) {
  let msg = ''
  try {
    const parsed = JSON.parse(body)
    msg = parsed?.error?.message ?? parsed?.message ?? ''
  } catch {
    /* not json */
  }
  if (status === 429) {
    return new Error(
      `Rate limit reached — ${msg || 'The provider caps tokens per minute. Wait a few seconds, then send again.'}`,
    )
  }
  if (status === 413) {
    return new Error('This conversation is too large for the model. Clear the chat or trim memory, then retry.')
  }
  if (status === 401 || status === 403) {
    return new Error(`Not authorised (${status}) — check your API key. ${msg}`.trim())
  }
  if (msg) return new Error(`${status}: ${msg}`)
  return new Error(`${status}: ${body.slice(0, 300) || 'Request failed'}`)
}

export async function* streamGroq(opts: GroqChatOptions): AsyncGenerator<string> {
  const resolved = resolveBaseUrl(opts.baseUrl)
  if (isMobilePlatform() && isLocalUrl(resolved)) {
    throw new Error(
      'Local AI inference (localhost / 127.0.0.1) is not supported on mobile devices. Use Eva Desktop to connect to local servers or configure a cloud provider.',
    )
  }
  const res = await fetch(`${resolved}/chat/completions`, {
    method: 'POST',
    headers: headers(opts.apiKey, resolved),
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.85,
      max_tokens: opts.maxTokens ?? 2048,
      top_p: opts.topP ?? 1,
      stream: true,
    }),
    signal: opts.signal,
  })

  if (!res.ok || !res.body) {
    throw errorFrom(await res.text().catch(() => ''), res.status)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        const delta: string | undefined = json?.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {
        /* partial chunk */
      }
    }
  }
}

export async function chatGroq(opts: GroqChatOptions): Promise<string> {
  const resolved = resolveBaseUrl(opts.baseUrl)
  if (isMobilePlatform() && isLocalUrl(resolved)) {
    throw new Error(
      'Local AI inference (localhost / 127.0.0.1) is not supported on mobile devices. Use Eva Desktop to connect to local servers or configure a cloud provider.',
    )
  }
  const res = await fetch(`${resolved}/chat/completions`, {
    method: 'POST',
    headers: headers(opts.apiKey, resolved),
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1024,
      stream: false,
    }),
    signal: opts.signal,
  })
  if (!res.ok) throw errorFrom(await res.text().catch(() => ''), res.status)
  const json = await res.json()
  return json?.choices?.[0]?.message?.content?.trim() ?? ''
}

export async function listGroqModels(
  apiKey: string,
  baseUrl?: string,
  accountId?: string,
): Promise<string[]> {
  const resolved = resolveBaseUrl(baseUrl, accountId)
  if (isMobilePlatform() && isLocalUrl(resolved)) {
    return []
  }

  // 1. Direct Pollinations text models endpoint
  if (resolved.includes('text.pollinations.ai')) {
    try {
      const pRes = await fetch('https://text.pollinations.ai/models')
      if (pRes.ok) {
        const json = await pRes.json()
        if (Array.isArray(json)) {
          return json.map((m: any) => m.name || m.id || m).filter(Boolean).sort()
        }
      }
    } catch {
      // Fall through to standard endpoint
    }
  }

  // 2. Cloudflare endpoint
  const url = resolved.includes('api.cloudflare.com')
    ? `${resolved.replace(/\/v1$/, '')}/models/search`
    : `${resolved}/models`

  const res = await fetch(url, {
    headers: headers(apiKey, resolved),
  })
  if (!res.ok) throw errorFrom(await res.text().catch(() => ''), res.status)
  const json = await res.json()
  const rawList = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.models)
        ? json.models
        : Array.isArray(json?.result)
          ? json.result
          : []
  return rawList
    .map((m: { id?: string; name?: string } | string) =>
      typeof m === 'string' ? m : m.id || m.name || '',
    )
    .filter((id: string) => id && !NON_CHAT.test(id))
    .sort()
}
