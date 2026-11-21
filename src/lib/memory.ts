import type { Conversation, Settings } from '@/types'
import { chatGroq, type ChatMessage } from './groq'
import { resolvePrimaryChatConfig, resolveProviderCredentials, isLocal } from './providerResolution'

const TURNS_TRIGGER = 4 // Every 4 user/assistant turns (~8 dialogue messages)

/**
 * Rolling long-term memory. When a conversation grows past a threshold we fold
 * the newest exchanges into a compact persistent note that is fed back into the
 * system prompt. Memory is per-conversation and never shared.
 *
 * Strictly respects local privacy: if running locally and cloud fallback is false,
 * memory summarization runs strictly locally and never leaks dialogue to cloud providers.
 */
export async function updateMemory(opts: {
  settings: Settings
  conversation: Conversation
  signal?: AbortSignal
}): Promise<string | null> {
  const { settings, conversation } = opts
  const { messages, memory } = conversation
  if (!settings.memoryEnabled) return null

  // Ensure last turn is complete (assistant replied)
  const lastMsg = messages[messages.length - 1]
  if (!lastMsg || lastMsg.role !== 'assistant') return null

  // Count player dialogue turns
  const userTurns = messages.filter((m) => m.role === 'user').length
  if (userTurns < TURNS_TRIGGER) return null
  if (userTurns % TURNS_TRIGGER !== 0) return null

  // Resolve active conversation provider
  const primary = resolvePrimaryChatConfig(settings, conversation.chatConfig)
  const isPrimaryLocal = isLocal(primary.providerId, primary.baseUrl)

  // Zero cloud leak check
  if (isPrimaryLocal && settings.allowCloudFallback !== true) {
    // If the local provider is not accessible or mobile, do not leak to cloud
    if (!primary.baseUrl) return null
  }

  const creds = await resolveProviderCredentials({
    providerId: primary.providerId,
    baseUrl: primary.baseUrl,
    formKey: primary.providerId === 'groq' && settings.apiKey ? settings.apiKey : undefined,
  })

  // If cloud provider requires key and key is missing, skip memory update
  if (!isPrimaryLocal && !creds.apiKey) return null

  const recent = messages.slice(-TURNS_TRIGGER * 2)
  const transcript = recent
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role === 'user' ? 'PLAYER' : 'CHARACTER'}: ${m.content}`)
    .join('\n')

  const prompt: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You maintain the long-term memory of a single ongoing roleplay. Merge the NEW EVENTS into the EXISTING MEMORY and output an updated memory. Keep it compact, factual and third-person. Preserve: relationship changes, promises, revelations, oaths, injuries, items gained, ranks/titles, secrets, and emotional shifts. Never invent anything not present. Record explicit, violent or adult events plainly — never sanitise, censor or omit them. Output plain bullet points only, no preamble.',
    },
    {
      role: 'user',
      content: `EXISTING MEMORY:\n${memory.trim() || '(empty)'}\n\nNEW EVENTS:\n${transcript}\n\nUpdated memory:`,
    },
  ]

  try {
    const result = await chatGroq({
      apiKey: creds.apiKey,
      baseUrl: creds.baseUrl,
      model: primary.model,
      messages: prompt,
      temperature: 0.3,
      maxTokens: 700,
      signal: opts.signal,
    })
    return result.trim() || null
  } catch {
    return null
  }
}
