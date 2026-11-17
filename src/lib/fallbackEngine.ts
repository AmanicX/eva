/**
 * Fallback & Judge Engine for Eva
 *
 * Implements capability-aware fallback chains, attempt tracking, per-attempt timeouts,
 * refusal classification (regex pre-check + judge model), and graceful degradation.
 */

import type { ChatMessage } from './groq'
import { chatGroq, PROVIDER_PRESETS, resolveBaseUrl } from './groq'
import { getProviderKey, getCloudflareCredentials } from './credentials'
import { isMobilePlatform, isProviderSupportedOnPlatform, isLocalProvider, isLocalUrl } from './platform'
import type { Settings } from '@/types'

export interface FallbackCandidate {
  providerId: string
  model: string
  baseUrl?: string
}

export interface FallbackAttemptLog {
  providerId: string
  model: string
  durationMs: number
  error?: string
  refusal?: boolean
  refusalReason?: string
  snippet?: string
  timestamp: number
}

// In-memory debug logs (not persisted with keys)
export const lastExecutionAttempts: FallbackAttemptLog[] = []

export const REFUSAL_PATTERNS = [
  /^(as an ai|i am an ai|i cannot|i can't|i'm unable to|i am unable to|i apologize|i'm sorry|i must decline|my safety guidelines)/i,
  /(i cannot assist with|i am unable to assist with|i can't generate|i cannot generate|i am programmed to be a helpful and harmless)/i,
  /(violates our safety guidelines|against my ethical guidelines|content policy violation)/i,
  /(i cannot fulfill this request|i am unable to comply with this request)/i,
]

/**
 * Fast local regex pre-check for obvious refusal phrases so clear cases don't need a judge call.
 */
export function isObviousRefusal(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true // Empty is treated as non-answer
  return REFUSAL_PATTERNS.some((pattern) => pattern.test(trimmed))
}

/**
 * Sends reply and user prompt to judge model to classify refusals.
 */
export async function judgeReplyRefusal(
  userPrompt: string,
  replyText: string,
  judge: { providerId: string; model: string },
  signal?: AbortSignal,
): Promise<{ refusal: boolean; reason: string }> {
  // 1. Fast local regex pre-check
  if (isObviousRefusal(replyText)) {
    return { refusal: true, reason: 'Obvious refusal phrase detected by local heuristics.' }
  }

  // 2. Query judge model with strict short prompt and JSON output
  try {
    const preset = PROVIDER_PRESETS.find((p) => p.id === judge.providerId)
    let apiKey = await getProviderKey(judge.providerId)
    let baseUrl = preset?.baseUrl || ''

    if (judge.providerId === 'cloudflare') {
      const creds = await getCloudflareCredentials()
      apiKey = creds.apiToken
      baseUrl = resolveBaseUrl(baseUrl, creds.accountId)
    }

    const judgeMessages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'You are a strict refusal classifier. Determine if the assistant reply is a refusal, non-answer, or deflection. Respond ONLY in valid JSON: {"refusal": boolean, "reason": string}.',
      },
      {
        role: 'user',
        content: `User prompt: "${userPrompt.slice(0, 200)}"\nAssistant reply: "${replyText.slice(0, 400)}"`,
      },
    ]

    const response = await chatGroq({
      apiKey,
      baseUrl,
      model: judge.model,
      messages: judgeMessages,
      temperature: 0.1,
      maxTokens: 80,
      signal,
    })

    const parsed = JSON.parse(response.replace(/```json|```/g, '').trim())
    return {
      refusal: !!parsed.refusal,
      reason: parsed.reason || (parsed.refusal ? 'Classified as refusal by judge model.' : ''),
    }
  } catch {
    // If the judge itself fails, fall back to regex heuristics only
    return {
      refusal: isObviousRefusal(replyText),
      reason: 'Judge call failed; evaluated via regex fallback.',
    }
  }
}

/**
 * Builds the ordered sequence of fallback candidates for a given capability.
 * Never includes duplicate (providerId, model) pairs.
 */
export function buildFallbackChain(
  capability: 'chat' | 'image' | 'tts',
  preferred: { providerId?: string; model?: string } | null | undefined,
  settings: Settings,
): FallbackCandidate[] {
  const candidates: FallbackCandidate[] = []
  const seen = new Set<string>()
  const isMobile = isMobilePlatform()

  const addCandidate = (providerId: string, model: string) => {
    if (!providerId || !model) return
    const preset = PROVIDER_PRESETS.find((p) => p.id === providerId)
    const baseUrl = preset?.baseUrl || ''
    // On mobile, local providers (Ollama, LM Studio) or loopback URLs are strictly unsupported
    if (isMobile && (!isProviderSupportedOnPlatform(providerId, isMobile) || isLocalUrl(baseUrl))) {
      return
    }

    const key = `${providerId}::${model}`
    if (seen.has(key)) return
    seen.add(key)

    candidates.push({
      providerId,
      model,
      baseUrl,
    })
  }

  // 1. Preferred candidate if keyed and enabled
  if (preferred?.providerId && preferred?.model) {
    const isKeyed =
      settings.keyedProviders.includes(preferred.providerId) ||
      preferred.providerId === 'ollama' ||
      preferred.providerId === 'lmstudio' ||
      preferred.providerId === 'pollinations'
    const isEnabled = settings.providerCapabilities[preferred.providerId]?.[capability] !== false

    if (isKeyed && isEnabled) {
      addCandidate(preferred.providerId, preferred.model)
    }
  }

  // 2. Default for this capability
  const capDefault =
    capability === 'chat'
      ? settings.chatDefault
      : capability === 'image'
        ? settings.imageDefault
        : settings.ttsDefault

  if (capDefault?.providerId) {
    const isKeyed =
      settings.keyedProviders.includes(capDefault.providerId) ||
      capDefault.providerId === 'ollama' ||
      capDefault.providerId === 'lmstudio' ||
      capDefault.providerId === 'pollinations'
    const isEnabled = settings.providerCapabilities[capDefault.providerId]?.[capability] !== false

    const defaultModel = 'model' in capDefault ? capDefault.model : capDefault.voice
    if (defaultModel && isKeyed && isEnabled) {
      addCandidate(capDefault.providerId, defaultModel)
    }
  }

  // 3. Fallback order configured by user
  const orderList =
    capability === 'chat'
      ? settings.chatProviderOrder
      : capability === 'image'
        ? settings.imageProviderOrder
        : settings.ttsProviderOrder

  for (const provId of orderList) {
    const isKeyed =
      settings.keyedProviders.includes(provId) ||
      provId === 'ollama' ||
      provId === 'lmstudio' ||
      provId === 'pollinations'
    const isEnabled = settings.providerCapabilities[provId]?.[capability] !== false
    if (!isKeyed || !isEnabled) continue

    const provModel =
      capability === 'chat'
        ? settings.providerModels[provId]?.chatModel || (provId === 'groq' ? settings.model : '')
        : capability === 'image'
          ? settings.providerModels[provId]?.imageModel || 'flux'
          : settings.providerModels[provId]?.ttsVoice || 'alloy'

    if (provModel) {
      addCandidate(provId, provModel)
    }
  }

  // 4. Last resort: Fallback model
  if (capability === 'chat' && settings.fallbackModel?.providerId && settings.fallbackModel?.model) {
    const isKeyed =
      settings.keyedProviders.includes(settings.fallbackModel.providerId) ||
      settings.fallbackModel.providerId === 'ollama' ||
      settings.fallbackModel.providerId === 'lmstudio' ||
      settings.fallbackModel.providerId === 'pollinations'
    const isEnabled = settings.providerCapabilities[settings.fallbackModel.providerId]?.[capability] !== false

    if (isKeyed && isEnabled) {
      addCandidate(settings.fallbackModel.providerId, settings.fallbackModel.model)
    }
  }

  return candidates
}

export interface ExecuteChatOptions {
  messages: ChatMessage[]
  preferredCandidate?: { providerId?: string; model?: string } | null
  settings: Settings
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  onStatusUpdate?: (status: string) => void
}

export interface ExecuteChatResult {
  content: string
  usedCandidate: FallbackCandidate
  attempts: FallbackAttemptLog[]
  switched: boolean
}

/**
 * Executes chat generation with robust fallback and refusal handling.
 * Atomically returns complete response without streaming text chunks to UI.
 */
export async function executeChatWithFallback(
  opts: ExecuteChatOptions,
): Promise<ExecuteChatResult> {
  const isMobile = isMobilePlatform()
  const candidates = buildFallbackChain('chat', opts.preferredCandidate, opts.settings)

  if (candidates.length === 0) {
    const candidateProvId = opts.preferredCandidate?.providerId || opts.settings.chatDefault?.providerId || opts.settings.fallbackModel?.providerId
    if (isMobile && candidateProvId && isLocalProvider(candidateProvId)) {
      const preset = PROVIDER_PRESETS.find((p) => p.id === candidateProvId)
      throw new Error(
        `The selected AI provider (${preset?.label || 'Local model'}) runs locally on your computer and is only available in the Eva Desktop application. On mobile, please select or configure a cloud provider (such as Groq, Google AI, OpenRouter, or Pollinations).`,
      )
    }
    throw new Error('No AI providers configured or enabled for chat.')
  }

  const attempts: FallbackAttemptLog[] = []
  lastExecutionAttempts.length = 0 // Clear prior debug attempts
  let bestNonEmptyCandidate: { content: string; candidate: FallbackCandidate } | null = null

  const userMessage = opts.messages.findLast((m) => m.role === 'user')?.content || ''

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    if (opts.signal?.aborted) {
      throw new DOMException('Chat generation stopped by user.', 'AbortError')
    }

    if (i > 0) {
      const preset = PROVIDER_PRESETS.find((p) => p.id === candidate.providerId)
      opts.onStatusUpdate?.(`Switched to ${preset?.label || candidate.providerId} (${candidate.model})`)
    }

    const start = Date.now()
    let apiKey = await getProviderKey(candidate.providerId)
    let baseUrl = candidate.baseUrl || ''

    if (candidate.providerId === 'cloudflare') {
      const creds = await getCloudflareCredentials()
      apiKey = creds.apiToken
      baseUrl = resolveBaseUrl(baseUrl, creds.accountId)
    }

    // Per-attempt timeout controller (25 seconds)
    const timeoutCtrl = new AbortController()
    const attemptTimeout = setTimeout(() => timeoutCtrl.abort(), 25000)

    const attemptSignal = opts.signal
      ? anySignal([opts.signal, timeoutCtrl.signal])
      : timeoutCtrl.signal

    try {
      const reply = await chatGroq({
        apiKey,
        baseUrl,
        model: candidate.model,
        messages: opts.messages,
        temperature: opts.temperature ?? opts.settings.temperature ?? 0.85,
        maxTokens: opts.maxTokens ?? opts.settings.maxTokens ?? 2048,
        signal: attemptSignal,
      })

      clearTimeout(attemptTimeout)
      const durationMs = Date.now() - start
      const cleanReply = reply.trim()

      if (!cleanReply) {
        attempts.push({
          providerId: candidate.providerId,
          model: candidate.model,
          durationMs,
          error: 'Empty response returned by provider.',
          timestamp: Date.now(),
        })
        continue
      }

      // Track non-empty candidate as backup
      if (!bestNonEmptyCandidate) {
        bestNonEmptyCandidate = { content: cleanReply, candidate }
      }

      // Check refusal via judge / regex
      const refusalCheck = await judgeReplyRefusal(
        userMessage,
        cleanReply,
        opts.settings.fallbackModel,
        opts.signal,
      )

      if (refusalCheck.refusal) {
        attempts.push({
          providerId: candidate.providerId,
          model: candidate.model,
          durationMs,
          refusal: true,
          refusalReason: refusalCheck.reason,
          snippet: cleanReply.slice(0, 80),
          timestamp: Date.now(),
        })
        opts.onStatusUpdate?.(`Refusal detected · Retrying next provider…`)
        continue
      }

      // Successful non-refusal answer!
      const logEntry: FallbackAttemptLog = {
        providerId: candidate.providerId,
        model: candidate.model,
        durationMs,
        snippet: cleanReply.slice(0, 80),
        timestamp: Date.now(),
      }
      attempts.push(logEntry)
      lastExecutionAttempts.push(...attempts)

      return {
        content: cleanReply,
        usedCandidate: candidate,
        attempts,
        switched: i > 0,
      }
    } catch (err: any) {
      clearTimeout(attemptTimeout)
      const durationMs = Date.now() - start

      if (opts.signal?.aborted) {
        throw new DOMException('Chat generation stopped by user.', 'AbortError')
      }

      const errMsg =
        err?.name === 'AbortError'
          ? 'Attempt timed out after 25s.'
          : err?.message || 'Request failed.'

      attempts.push({
        providerId: candidate.providerId,
        model: candidate.model,
        durationMs,
        error: errMsg,
        timestamp: Date.now(),
      })
    }
  }

  lastExecutionAttempts.push(...attempts)

  // If all failed, return best non-empty candidate if one exists
  if (bestNonEmptyCandidate) {
    return {
      content: bestNonEmptyCandidate.content,
      usedCandidate: bestNonEmptyCandidate.candidate,
      attempts,
      switched: true,
    }
  }

  // Otherwise throw clean, friendly error
  throw new Error(
    'All available AI providers failed to respond. Please check your network connection, API keys, or provider status and try again.',
  )
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const s of signals) {
    if (s.aborted) {
      controller.abort()
      return controller.signal
    }
    s.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return controller.signal
}
