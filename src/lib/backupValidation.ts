/**
 * Schema Validation and Normalization for Backups and Persisted State
 *
 * Protects Eva from corrupted JSON, invalid theme identifiers, out-of-bounds numbers,
 * and malformed data that could otherwise brick the application.
 */

import type {
  AppearanceMode,
  Character,
  Conversation,
  Message,
  Settings,
  ThemeId,
  World,
} from '@/types'
import { DEFAULT_SETTINGS, normalizeAge } from '@/store/useStore'
import { DEFAULT_BASE_URL } from './groq'
import { isValidHex } from '@/data/palettes'

export const VALID_THEMES: ReadonlySet<string> = new Set(['chatbot', 'anime', 'world'])
export const VALID_APPEARANCE_MODES: ReadonlySet<string> = new Set(['dark', 'light', 'system'])

export function normalizeTheme(theme: unknown): ThemeId {
  if (typeof theme === 'string' && VALID_THEMES.has(theme)) {
    return theme as ThemeId
  }
  return 'chatbot'
}

export function normalizeAppearanceMode(mode: unknown): AppearanceMode {
  if (typeof mode === 'string' && VALID_APPEARANCE_MODES.has(mode)) {
    return mode as AppearanceMode
  }
  return 'dark'
}

export function normalizeBoundedNumber(
  val: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
    return Math.max(min, Math.min(max, val))
  }
  return fallback
}

export function sanitizeUrl(url: unknown, fallback: string): string {
  if (typeof url !== 'string' || !url.trim()) return fallback
  const clean = url.trim()
  if (/^(javascript|data|file):/i.test(clean)) {
    return fallback
  }
  return clean
}

/**
 * Normalizes any partial settings object into a valid, safe Settings structure.
 * Guarantees no undefined theme or invalid structure can crash components.
 */
export function normalizeSettings(raw: any): Settings {
  const s = raw && typeof raw === 'object' ? raw : {}

  const theme = normalizeTheme(s.theme)
  const appearanceMode = normalizeAppearanceMode(s.appearanceMode)
  const temperature = normalizeBoundedNumber(s.temperature, 0, 2, DEFAULT_SETTINGS.temperature)
  const maxTokens = Math.round(normalizeBoundedNumber(s.maxTokens, 16, 32768, DEFAULT_SETTINGS.maxTokens))
  const topP = normalizeBoundedNumber(s.topP, 0, 1, DEFAULT_SETTINGS.topP ?? 1)
  const baseUrl = sanitizeUrl(s.baseUrl, DEFAULT_BASE_URL)
  const model = typeof s.model === 'string' && s.model.trim() ? s.model.trim() : DEFAULT_SETTINGS.model

  // Theme accents validation
  const themeAccents = { ...DEFAULT_SETTINGS.themeAccents }
  if (s.themeAccents && typeof s.themeAccents === 'object') {
    for (const tid of ['chatbot', 'anime', 'world'] as ThemeId[]) {
      const acc = s.themeAccents[tid]
      if (acc && typeof acc === 'object') {
        const primary = isValidHex(acc.primary) ? acc.primary : themeAccents[tid].primary
        const contrast = isValidHex(acc.contrast) ? acc.contrast : themeAccents[tid].contrast
        themeAccents[tid] = {
          paletteId: typeof acc.paletteId === 'string' ? acc.paletteId : themeAccents[tid].paletteId,
          primary,
          contrast,
        }
      }
    }
  }

  // Keyed providers
  const keyedProviders = Array.isArray(s.keyedProviders)
    ? s.keyedProviders.filter((p: unknown) => typeof p === 'string')
    : []

  // Provider capabilities
  const providerCapabilities = {
    ...DEFAULT_SETTINGS.providerCapabilities,
    ...(s.providerCapabilities && typeof s.providerCapabilities === 'object'
      ? s.providerCapabilities
      : {}),
  }

  // Provider models
  const providerModels = {
    ...DEFAULT_SETTINGS.providerModels,
    ...(s.providerModels && typeof s.providerModels === 'object' ? s.providerModels : {}),
  }

  // Capability defaults
  const chatDefault =
    s.chatDefault && typeof s.chatDefault === 'object' && typeof s.chatDefault.providerId === 'string'
      ? {
          providerId: s.chatDefault.providerId,
          model: typeof s.chatDefault.model === 'string' ? s.chatDefault.model : model,
        }
      : { ...DEFAULT_SETTINGS.chatDefault, model }

  const imageDefault =
    s.imageDefault && typeof s.imageDefault === 'object' && typeof s.imageDefault.providerId === 'string'
      ? {
          providerId: s.imageDefault.providerId,
          model: typeof s.imageDefault.model === 'string' ? s.imageDefault.model : 'flux',
        }
      : { ...DEFAULT_SETTINGS.imageDefault }

  const ttsDefault =
    s.ttsDefault && typeof s.ttsDefault === 'object' && typeof s.ttsDefault.providerId === 'string'
      ? {
          providerId: s.ttsDefault.providerId,
          voice: typeof s.ttsDefault.voice === 'string' ? s.ttsDefault.voice : 'alloy',
        }
      : { ...DEFAULT_SETTINGS.ttsDefault }

  const fallbackModel =
    s.fallbackModel && typeof s.fallbackModel === 'object' && typeof s.fallbackModel.providerId === 'string'
      ? {
          providerId: s.fallbackModel.providerId,
          model: typeof s.fallbackModel.model === 'string' ? s.fallbackModel.model : DEFAULT_SETTINGS.fallbackModel.model,
        }
      : { ...DEFAULT_SETTINGS.fallbackModel }

  return {
    ...DEFAULT_SETTINGS,
    ...s,
    apiKey: '', // Always strip from direct settings object
    theme,
    appearanceMode,
    temperature,
    maxTokens,
    topP,
    baseUrl,
    model,
    themeAccents,
    keyedProviders,
    providerCapabilities,
    providerModels,
    chatDefault,
    imageDefault,
    ttsDefault,
    fallbackModel,
    allowCloudFallback: s.allowCloudFallback === true,
  }
}

export function sanitizeMessage(raw: any): Message | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null
  const role = raw.role === 'user' || raw.role === 'assistant' || raw.role === 'system' ? raw.role : 'user'
  return {
    id: raw.id,
    role,
    content: typeof raw.content === 'string' ? raw.content : '',
    raw: typeof raw.raw === 'string' ? raw.raw : undefined,
    commands: Array.isArray(raw.commands) ? raw.commands : undefined,
    timestamp: typeof raw.timestamp === 'number' && !isNaN(raw.timestamp) ? raw.timestamp : Date.now(),
    error: raw.error === true,
    type: raw.type === 'image' ? 'image' : 'text',
    image:
      raw.image && typeof raw.image === 'object'
        ? {
            id: typeof raw.image.id === 'string' ? raw.image.id : undefined,
            prompt: typeof raw.image.prompt === 'string' ? raw.image.prompt : '',
            url: typeof raw.image.url === 'string' ? raw.image.url : '',
            model: typeof raw.image.model === 'string' ? raw.image.model : undefined,
          }
        : undefined,
    audioUrl: typeof raw.audioUrl === 'string' ? raw.audioUrl : undefined,
  }
}

export function sanitizeConversation(raw: any): Conversation | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null
  const theme = normalizeTheme(raw.theme)
  const messages: Message[] = []
  if (Array.isArray(raw.messages)) {
    for (const m of raw.messages) {
      const sanitized = sanitizeMessage(m)
      if (sanitized) messages.push(sanitized)
    }
  }

  return {
    id: raw.id,
    theme,
    characterId: typeof raw.characterId === 'string' ? raw.characterId : '',
    worldId: typeof raw.worldId === 'string' ? raw.worldId : undefined,
    title: typeof raw.title === 'string' ? raw.title : 'Conversation',
    messages,
    memory: typeof raw.memory === 'string' ? raw.memory : '',
    worldState: raw.worldState && typeof raw.worldState === 'object' ? raw.worldState : undefined,
    createdAt: typeof raw.createdAt === 'number' && !isNaN(raw.createdAt) ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' && !isNaN(raw.updatedAt) ? raw.updatedAt : Date.now(),
    pinned: raw.pinned === true,
    chatConfig: raw.chatConfig && typeof raw.chatConfig === 'object' ? raw.chatConfig : null,
    imageConfig: raw.imageConfig && typeof raw.imageConfig === 'object' ? raw.imageConfig : null,
    ttsConfig: raw.ttsConfig && typeof raw.ttsConfig === 'object' ? raw.ttsConfig : null,
  }
}

export function sanitizeCharacter(raw: any): Character | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null
  return {
    id: raw.id,
    theme: normalizeTheme(raw.theme),
    name: typeof raw.name === 'string' ? raw.name : 'Unknown',
    avatar: typeof raw.avatar === 'string' ? raw.avatar : '',
    avatarColor: typeof raw.avatarColor === 'string' ? raw.avatarColor : '#7c5cff',
    tagline: typeof raw.tagline === 'string' ? raw.tagline : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    gender: typeof raw.gender === 'string' ? raw.gender : '',
    age: normalizeAge(raw.age),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t: unknown) => typeof t === 'string') : [],
    greeting: typeof raw.greeting === 'string' ? raw.greeting : '',
    canon: raw.canon === 'canon' ? 'canon' : 'custom',
    source: typeof raw.source === 'string' ? raw.source : '',
    overrides: typeof raw.overrides === 'string' ? raw.overrides : '',
    worldId: typeof raw.worldId === 'string' ? raw.worldId : undefined,
    metadata: Array.isArray(raw.metadata) ? raw.metadata : [],
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : undefined,
  }
}

export function sanitizeWorld(raw: any): World | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : 'Untitled World',
    genre: typeof raw.genre === 'string' ? raw.genre : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    rules: typeof raw.rules === 'string' ? raw.rules : '',
    playerName: typeof raw.playerName === 'string' ? raw.playerName : 'Player',
    playerRole: typeof raw.playerRole === 'string' ? raw.playerRole : '',
    playerAppearance: typeof raw.playerAppearance === 'string' ? raw.playerAppearance : '',
    avatar: typeof raw.avatar === 'string' ? raw.avatar : '',
    avatarColor: typeof raw.avatarColor === 'string' ? raw.avatarColor : '#7c5cff',
    locations: typeof raw.locations === 'string' ? raw.locations : '',
    factions: typeof raw.factions === 'string' ? raw.factions : '',
    lore: typeof raw.lore === 'string' ? raw.lore : '',
    color: typeof raw.color === 'string' ? raw.color : '#7c5cff',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : undefined,
  }
}

export interface ValidatedBackup {
  settings: Settings
  characters: Character[]
  worlds: World[]
  conversations: Conversation[]
}

/**
 * Validates and sanitizes a complete backup structure before importing.
 */
export function validateAndSanitizeBackup(raw: unknown): {
  valid: boolean
  data?: ValidatedBackup
  error?: string
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Backup file must contain a valid JSON object.' }
  }

  const obj = raw as Record<string, any>

  const settings = normalizeSettings(obj.settings)

  const characters: Character[] = []
  if (Array.isArray(obj.characters)) {
    for (const c of obj.characters) {
      const sanitized = sanitizeCharacter(c)
      if (sanitized) characters.push(sanitized)
    }
  }

  const worlds: World[] = []
  if (Array.isArray(obj.worlds)) {
    for (const w of obj.worlds) {
      const sanitized = sanitizeWorld(w)
      if (sanitized) worlds.push(sanitized)
    }
  }

  const conversations: Conversation[] = []
  if (Array.isArray(obj.conversations)) {
    for (const cv of obj.conversations) {
      const sanitized = sanitizeConversation(cv)
      if (sanitized) conversations.push(sanitized)
    }
  }

  return {
    valid: true,
    data: {
      settings,
      characters,
      worlds,
      conversations,
    },
  }
}
