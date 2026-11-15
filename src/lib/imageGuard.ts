/**
 * Image Explicit Content Guard
 *
 * Enforces strict safety checks for image generation prompts.
 * TEXT CHAT REMAINS COMPLETELY UNCENSORED AND UNFILTERED.
 * Only image prompts are checked here.
 */

import { chatGroq, PROVIDER_PRESETS, resolveBaseUrl } from './groq'
import { getProviderKey, getCloudflareCredentials } from './credentials'
import type { Settings } from '@/types'

export const EXPLICIT_KEYWORDS = [
  /\b(nsfw|nude|nudity|naked|genitals|penis|vagina|breasts?|nipples?|porn|porno|pornography)\b/i,
  /\b(sex|sexual|intercourse|erotic|bdsm|hentai|fetish|ejaculat(e|ion)|orgasm)\b/i,
  /\b(gore|dismember(ed|ment)|decapitat(ed|ion)|mutilat(ed|ion))\b/i,
]

export function isObviousExplicit(prompt: string): boolean {
  const clean = prompt.trim()
  if (!clean) return false
  return EXPLICIT_KEYWORDS.some((regex) => regex.test(clean))
}

export async function checkImageExplicitContent(
  prompt: string,
  settings: Settings,
  signal?: AbortSignal,
): Promise<{ explicit: boolean; reason?: string }> {
  // 1. Fast local regex pre-check
  if (isObviousExplicit(prompt)) {
    return {
      explicit: true,
      reason: 'Prompt contains explicit keywords or sexual content, which is not supported for image generation.',
    }
  }

  // 2. Judge model evaluation
  try {
    const judge = settings.fallbackModel || settings.chatDefault
    const preset = PROVIDER_PRESETS.find((p) => p.id === judge.providerId)
    let apiKey = await getProviderKey(judge.providerId)
    let baseUrl = preset?.baseUrl || ''

    if (judge.providerId === 'cloudflare') {
      const creds = await getCloudflareCredentials()
      apiKey = creds.apiToken
      baseUrl = resolveBaseUrl(baseUrl, creds.accountId)
    }

    const messages = [
      {
        role: 'system' as const,
        content:
          'You are a strict safety classifier for image generation. Determine whether the prompt describes explicit sexual content, nudity, or graphic gore. Respond ONLY with valid JSON: {"explicit": boolean, "reason": string}.',
      },
      {
        role: 'user' as const,
        content: `Image prompt: "${prompt.slice(0, 400)}"`,
      },
    ]

    const response = await chatGroq({
      apiKey,
      baseUrl,
      model: judge.model,
      messages,
      temperature: 0.1,
      maxTokens: 60,
      signal,
    })

    const parsed = JSON.parse(response.replace(/```json|```/g, '').trim())
    return {
      explicit: !!parsed.explicit,
      reason: parsed.reason || (parsed.explicit ? 'Prompt classified as explicit content.' : undefined),
    }
  } catch {
    // If judge fails, rely strictly on local keywords
    return { explicit: false }
  }
}
