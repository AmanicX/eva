/**
 * Canonical Provider Resolution & Credential Isolation Engine for Eva
 *
 * Implements strict precedence, privacy isolation, credential resolution,
 * and zero-cloud-request enforcement for local inference.
 */

import type { PerChatConfig, Settings } from '@/types'
import { PROVIDER_PRESETS, resolveBaseUrl, type ProviderPreset } from './groq'
import { getProviderKey, getCloudflareCredentials } from './credentials'
import { isMobilePlatform, isLocalUrl, isLocalProvider } from './platform'

export interface ResolvedProviderConfig {
  providerId: string
  model: string
  baseUrl: string
  isLocal: boolean
}

export interface ResolvedCredentials {
  apiKey: string
  baseUrl: string
  accountId?: string
}

export interface FallbackCandidate {
  providerId: string
  model: string
  baseUrl?: string
}

/**
 * Returns whether a provider or URL runs locally on device / localhost.
 */
export function isLocal(providerId?: string, baseUrl?: string): boolean {
  if (providerId && isLocalProvider(providerId)) return true
  if (baseUrl && isLocalUrl(baseUrl)) return true
  return false
}

/**
 * Resolves a ProviderPreset by ID.
 */
export function getPresetForId(providerId?: string): ProviderPreset | undefined {
  if (!providerId) return undefined
  return PROVIDER_PRESETS.find((p) => p.id === providerId)
}

/**
 * Resolves a ProviderPreset by base URL.
 */
export function getPresetForUrl(baseUrl?: string): ProviderPreset | undefined {
  if (!baseUrl) return undefined
  const clean = resolveBaseUrl(baseUrl)
  return PROVIDER_PRESETS.find((p) => resolveBaseUrl(p.baseUrl) === clean)
}

/**
 * Determines the canonical provider ID from a base URL or fallback identifier.
 * NEVER defaults unrecognized endpoints to 'groq'.
 */
export function resolveProviderIdFromUrl(baseUrl?: string): string {
  if (!baseUrl || !baseUrl.trim()) return 'groq'
  const preset = getPresetForUrl(baseUrl)
  if (preset) return preset.id
  if (isLocalUrl(baseUrl)) return 'local-custom'
  return 'custom'
}

/**
 * Resolves the credentials for a specific provider and endpoint.
 * Ensures strict credential isolation:
 * - OpenAI only receives OpenAI keys.
 * - Groq only receives Groq keys.
 * - Cloudflare receives only Cloudflare tokens + account ID.
 * - Custom endpoints use explicit custom credentials, never silently reusing Groq keys.
 * - Local endpoints receive empty credentials by default.
 */
export async function resolveProviderCredentials(opts: {
  providerId: string
  baseUrl?: string
  formKey?: string
  formAccountId?: string
  formApiToken?: string
}): Promise<ResolvedCredentials> {
  const { providerId, baseUrl, formKey, formAccountId, formApiToken } = opts
  const preset = getPresetForId(providerId)
  const effectiveBaseUrl = baseUrl || preset?.baseUrl || ''

  // 1. Cloudflare resolution
  if (providerId === 'cloudflare') {
    const saved = await getCloudflareCredentials()
    const accountId = (formAccountId !== undefined ? formAccountId : saved.accountId).trim()
    const apiToken = (formApiToken !== undefined ? formApiToken : saved.apiToken).trim()
    const resolvedUrl = resolveBaseUrl(effectiveBaseUrl, accountId)
    return {
      apiKey: apiToken,
      baseUrl: resolvedUrl,
      accountId,
    }
  }

  // 2. Local endpoints (Ollama, LM Studio, local custom)
  if (isLocal(providerId, effectiveBaseUrl)) {
    const key = (formKey !== undefined ? formKey : await getProviderKey(providerId)).trim()
    return {
      apiKey: key, // Can be empty string, local servers ignore it
      baseUrl: resolveBaseUrl(effectiveBaseUrl),
    }
  }

  // 3. Cloud / Custom endpoints
  let apiKey = ''
  if (formKey !== undefined) {
    apiKey = formKey.trim()
  } else {
    apiKey = (await getProviderKey(providerId)).trim()
  }

  return {
    apiKey,
    baseUrl: resolveBaseUrl(effectiveBaseUrl),
  }
}

/**
 * Resolves the canonical primary model and endpoint for chat execution following strict precedence:
 * 1. Per-chat override (if validly configured on the conversation).
 * 2. Explicit global active model and endpoint from settings.
 * 3. Default fallback.
 */
export function resolvePrimaryChatConfig(
  settings: Settings,
  perChatConfig?: PerChatConfig | null,
): ResolvedProviderConfig {
  // 1. Per-chat override
  if (perChatConfig?.providerId && perChatConfig?.model) {
    const preset = getPresetForId(perChatConfig.providerId)
    const baseUrl = preset?.baseUrl || settings.baseUrl || ''
    return {
      providerId: perChatConfig.providerId,
      model: perChatConfig.model,
      baseUrl,
      isLocal: isLocal(perChatConfig.providerId, baseUrl),
    }
  }

  // 2. Global active settings
  const chatDef = settings.chatDefault
  const activeUrl = (settings.baseUrl || '').trim()
  const activePreset = getPresetForUrl(activeUrl)

  const providerId = chatDef?.providerId || activePreset?.id || resolveProviderIdFromUrl(activeUrl)
  const preset = getPresetForId(providerId)
  const baseUrl = (activePreset?.id === providerId ? activeUrl : preset?.baseUrl) || activeUrl
  const model = chatDef?.model || settings.model || 'llama-3.1-8b-instant'

  return {
    providerId,
    model,
    baseUrl,
    isLocal: isLocal(providerId, baseUrl),
  }
}

/**
 * Builds the capability-aware fallback chain with strict privacy and local-only enforcement.
 *
 * PRIVACY GUARANTEE:
 * If the primary chat configuration is a local model, ZERO cloud provider requests are permitted
 * unless settings.allowCloudFallback is explicitly enabled by the user.
 */
export function buildResolvedFallbackChain(
  capability: 'chat' | 'image' | 'tts',
  preferred: { providerId?: string; model?: string } | null | undefined,
  settings: Settings,
): FallbackCandidate[] {
  const candidates: FallbackCandidate[] = []
  const seen = new Set<string>()
  const isMobile = isMobilePlatform()

  // Determine primary candidate
  let primaryProvId = preferred?.providerId
  let primaryModel = preferred?.model
  let primaryBaseUrl = ''

  if (!primaryProvId || !primaryModel) {
    if (capability === 'chat') {
      const primary = resolvePrimaryChatConfig(settings, preferred)
      primaryProvId = primary.providerId
      primaryModel = primary.model
      primaryBaseUrl = primary.baseUrl
    } else if (capability === 'image') {
      primaryProvId = settings.imageDefault?.providerId
      primaryModel = settings.imageDefault?.model
      primaryBaseUrl = getPresetForId(primaryProvId)?.baseUrl || ''
    } else {
      primaryProvId = settings.ttsDefault?.providerId
      primaryModel = settings.ttsDefault?.voice
      primaryBaseUrl = getPresetForId(primaryProvId)?.baseUrl || ''
    }
  } else {
    primaryBaseUrl = getPresetForId(primaryProvId)?.baseUrl || (primaryProvId === 'groq' ? settings.baseUrl : '')
  }

  // On mobile, local models cannot run so fallback to cloud is permitted for cloud providers
  const isPrimaryLocal = !isMobile && isLocal(primaryProvId, primaryBaseUrl)
  const cloudAllowed = !isPrimaryLocal || settings.allowCloudFallback === true

  const addCandidate = (providerId: string, model: string, explicitBaseUrl?: string) => {
    if (!providerId || !model) return
    const preset = getPresetForId(providerId)
    const baseUrl = explicitBaseUrl || preset?.baseUrl || (providerId === 'groq' ? settings.baseUrl : '')

    // Mobile check
    if (isMobile && isLocal(providerId, baseUrl)) {
      return
    }

    // PRIVACY CHECK: If local-only is enforced, reject any cloud provider
    if (!cloudAllowed && !isLocal(providerId, baseUrl)) {
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

  // 1. Primary candidate
  if (primaryProvId && primaryModel) {
    const isLocalCand = isLocal(primaryProvId, primaryBaseUrl)
    const isKeyed =
      isLocalCand ||
      settings.keyedProviders.includes(primaryProvId) ||
      (cloudAllowed && primaryProvId === 'pollinations')
    const isEnabled = settings.providerCapabilities[primaryProvId]?.[capability] !== false

    if (isKeyed && isEnabled) {
      addCandidate(primaryProvId, primaryModel, primaryBaseUrl)
    }
  }

  // 2. Capability default (if distinct from primary)
  const capDefault =
    capability === 'chat'
      ? settings.chatDefault
      : capability === 'image'
        ? settings.imageDefault
        : settings.ttsDefault

  if (capDefault?.providerId) {
    const capBaseUrl = getPresetForId(capDefault.providerId)?.baseUrl || ''
    const isLocalCand = isLocal(capDefault.providerId, capBaseUrl)
    const isKeyed =
      isLocalCand ||
      settings.keyedProviders.includes(capDefault.providerId) ||
      (cloudAllowed && capDefault.providerId === 'pollinations')
    const isEnabled = settings.providerCapabilities[capDefault.providerId]?.[capability] !== false

    const defaultModel = 'model' in capDefault ? capDefault.model : capDefault.voice
    if (defaultModel && isKeyed && isEnabled) {
      addCandidate(capDefault.providerId, defaultModel, capBaseUrl)
    }
  }

  // 3. User configured fallback order
  const orderList =
    capability === 'chat'
      ? settings.chatProviderOrder
      : capability === 'image'
        ? settings.imageProviderOrder
        : settings.ttsProviderOrder

  for (const provId of orderList) {
    const preset = getPresetForId(provId)
    const provBaseUrl = preset?.baseUrl || ''
    const isLocalCand = isLocal(provId, provBaseUrl)

    // Privacy rule: do not fall back to cloud if primary is local and cloud fallback is false
    if (!cloudAllowed && !isLocalCand) continue

    const isKeyed =
      isLocalCand ||
      settings.keyedProviders.includes(provId) ||
      (cloudAllowed && provId === 'pollinations')
    const isEnabled = settings.providerCapabilities[provId]?.[capability] !== false
    if (!isKeyed || !isEnabled) continue

    const provModel =
      capability === 'chat'
        ? settings.providerModels[provId]?.chatModel || (provId === 'groq' ? settings.model : '')
        : capability === 'image'
          ? settings.providerModels[provId]?.imageModel || 'flux'
          : settings.providerModels[provId]?.ttsVoice || 'alloy'

    if (provModel) {
      addCandidate(provId, provModel, provBaseUrl)
    }
  }

  // 4. Last resort: fallbackModel (only if cloud allowed or fallbackModel is local)
  if (capability === 'chat' && settings.fallbackModel?.providerId && settings.fallbackModel?.model) {
    const fbPreset = getPresetForId(settings.fallbackModel.providerId)
    const fbBaseUrl = fbPreset?.baseUrl || ''
    const isLocalCand = isLocal(settings.fallbackModel.providerId, fbBaseUrl)

    if (cloudAllowed || isLocalCand) {
      const isKeyed =
        isLocalCand ||
        settings.keyedProviders.includes(settings.fallbackModel.providerId) ||
        settings.fallbackModel.providerId === 'pollinations'
      const isEnabled = settings.providerCapabilities[settings.fallbackModel.providerId]?.[capability] !== false

      if (isKeyed && isEnabled) {
        addCandidate(settings.fallbackModel.providerId, settings.fallbackModel.model, fbBaseUrl)
      }
    }
  }

  return candidates
}

/**
 * Checks whether an external cloud judge (for refusal or image safety) is permitted to run.
 * Returns false if:
 * - The primary execution is local-only and cloud fallback is not explicitly permitted.
 * - The judge provider is not keyed.
 * - The judge provider is disabled.
 */
export function isCloudJudgePermitted(opts: {
  isPrimaryLocal: boolean
  judgeProviderId: string
  settings: Settings
}): boolean {
  const { isPrimaryLocal, judgeProviderId, settings } = opts
  const judgePreset = getPresetForId(judgeProviderId)
  const isJudgeLocal = isLocal(judgeProviderId, judgePreset?.baseUrl)

  // Local judges are always permitted if local models are supported
  if (isJudgeLocal) return true

  // Cloud judge for local chat requires explicit opt-in
  if (isPrimaryLocal && settings.allowCloudFallback !== true) {
    return false
  }

  // Judge provider must be keyed (or keyless pollinations if explicitly allowed)
  const isKeyed =
    settings.keyedProviders.includes(judgeProviderId) ||
    (judgeProviderId === 'pollinations' && settings.allowCloudFallback === true)
  if (!isKeyed) return false

  // Judge provider capability check
  if (settings.providerCapabilities[judgeProviderId]?.chat === false) {
    return false
  }

  return true
}
