/**
 * Fallback & Judge Engine for Eva
 *
 * Implements capability-aware fallback chains, attempt tracking, per-attempt timeouts,
 * refusal classification (regex pre-check + judge model), streaming support, and graceful degradation.
 */

import type { ChatMessage } from './groq'
import { chatGroq, streamGroq, PROVIDER_PRESETS, resolveBaseUrl } from './groq'
import { getProviderKey, getCloudflareCredentials } from './credentials'
import { isMobilePlatform, isLocalProvider } from './platform'
import { buildResolvedFallbackChain, isCloudJudgePermitted, isLocal } from './providerResolution'
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
 * Strictly respects local-only privacy: if primary inference is local and cloud fallback
 * is not explicitly enabled, zero external requests are made.
 */
export async function judgeReplyRefusal(
  userPrompt: string,
  replyText: string,
  judge: { providerId: string; model: string },
  signal?: AbortSignal,
  settings?: Settings,
  isPrimaryLocal?: boolean,
): Promise<{ refusal: boolean; reason: string }> {
  // 1. Fast local regex pre-check
  if (isObviousRefusal(replyText)) {
    return { refusal: true, reason: 'Obvious refusal phrase detected by local heuristics.' }
  }

  // 2. Enforce privacy policy
  if (settings) {
    const permitted = isCloudJudgePermitted({
      isPrimaryLocal: !!isPrimaryLocal,
      judgeProviderId: judge.providerId,
      settings,
    })
    if (!permitted) {
      return {
        refusal: false,
        reason: 'Refusal judge bypassed to preserve local-only privacy.',
      }
    }
  }

  // 3. Query judge model with strict short prompt and JSON output
  const timeoutCtrl = new AbortController()
  const timer = setTimeout(() => timeoutCtrl.abort(), 10000)
  const judgeSignal = signal ? anySignal([signal, timeoutCtrl.signal]) : timeoutCtrl.signal

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
      signal: judgeSignal,
    })

    clearTimeout(timer)
    const parsed = JSON.parse(response.replace(/```json|```/g, '').trim())
    return {
      refusal: !!parsed.refusal,
      reason: parsed.reason || (parsed.refusal ? 'Classified as refusal by judge model.' : ''),
    }
  } catch {
    clearTimeout(timer)
    if (signal?.aborted) {
      throw new DOMException('Chat generation stopped by user.', 'AbortError')
    }
    // If the judge call timed out or failed, fall back to regex heuristics only
    return {
      refusal: isObviousRefusal(replyText),
      reason: 'Judge call failed; evaluated via regex fallback.',
    }
  }
}

/**
 * Builds the ordered sequence of fallback candidates for a given capability.
 * Never includes duplicate (providerId, model) pairs.
 * Strictly respects local-only zero-leak privacy policy.
 */
export function buildFallbackChain(
  capability: 'chat' | 'image' | 'tts',
  preferred: { providerId?: string; model?: string } | null | undefined,
  settings: Settings,
): FallbackCandidate[] {
  return buildResolvedFallbackChain(capability, preferred, settings)
}

export interface ExecuteChatOptions {
  messages: ChatMessage[]
  preferredCandidate?: { providerId?: string; model?: string } | null
  settings: Settings
  temperature?: number
  maxTokens?: number
  topP?: number
  signal?: AbortSignal
  onStatusUpdate?: (status: string) => void
  onDelta?: (delta: string) => void
}

export interface ExecuteChatResult {
  content: string
  usedCandidate: FallbackCandidate
  attempts: FallbackAttemptLog[]
  switched: boolean
}

/**
 * Executes chat generation with robust fallback, refusal handling, and streaming.
 */
export async function executeChatWithFallback(
  opts: ExecuteChatOptions,
): Promise<ExecuteChatResult> {
  const isMobile = isMobilePlatform()
  const candidates = buildFallbackChain('chat', opts.preferredCandidate, opts.settings)

  if (candidates.length === 0) {
    const candidateProvId =
      opts.preferredCandidate?.providerId ||
      opts.settings.chatDefault?.providerId ||
      opts.settings.fallbackModel?.providerId
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
      let reply = ''
      const isCandidateLocal = isLocal(candidate.providerId, candidate.baseUrl)

      if (opts.settings.streaming && opts.onDelta) {
        try {
          for await (const chunk of streamGroq({
            apiKey,
            baseUrl,
            model: candidate.model,
            messages: opts.messages,
            temperature: opts.temperature ?? opts.settings.temperature ?? 0.85,
            maxTokens: opts.maxTokens ?? opts.settings.maxTokens ?? 2048,
            topP: opts.topP ?? opts.settings.topP ?? 1,
            signal: attemptSignal,
          })) {
            reply += chunk
            opts.onDelta(chunk)
          }
        } catch (streamErr: any) {
          if (opts.signal?.aborted) {
            throw new DOMException('Chat generation stopped by user.', 'AbortError')
          }
          // If stream failed before any chunks were received, fall back to atomic chatGroq
          if (!reply.trim()) {
            reply = await chatGroq({
              apiKey,
              baseUrl,
              model: candidate.model,
              messages: opts.messages,
              temperature: opts.temperature ?? opts.settings.temperature ?? 0.85,
              maxTokens: opts.maxTokens ?? opts.settings.maxTokens ?? 2048,
              topP: opts.topP ?? opts.settings.topP ?? 1,
              signal: attemptSignal,
            })
            if (opts.onDelta) opts.onDelta(reply)
          } else {
            throw streamErr
          }
        }
      } else {
        reply = await chatGroq({
          apiKey,
          baseUrl,
          model: candidate.model,
          messages: opts.messages,
          temperature: opts.temperature ?? opts.settings.temperature ?? 0.85,
          maxTokens: opts.maxTokens ?? opts.settings.maxTokens ?? 2048,
          topP: opts.topP ?? opts.settings.topP ?? 1,
          signal: attemptSignal,
        })
      }

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

      // Check refusal via judge / regex with local privacy awareness
      const refusalCheck = await judgeReplyRefusal(
        userMessage,
        cleanReply,
        opts.settings.fallbackModel,
        opts.signal,
        opts.settings,
        isCandidateLocal,
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
