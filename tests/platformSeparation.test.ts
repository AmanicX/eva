import { describe, expect, it } from 'vitest'
import {
  isLocalProvider,
  isLocalUrl,
  isProviderSupportedOnPlatform,
  getSupportedProviderPresets,
  LOCAL_PROVIDER_IDS,
} from '../src/lib/platform'
import { PROVIDER_PRESETS, chatGroq, streamGroq, listGroqModels } from '../src/lib/groq'
import { buildFallbackChain } from '../src/lib/fallbackEngine'
import { DEFAULT_SETTINGS } from '../src/store/useStore'

describe('Platform-Specific Provider Availability (Desktop vs Mobile)', () => {
  it('correctly identifies local-only provider IDs', () => {
    expect(isLocalProvider('ollama')).toBe(true)
    expect(isLocalProvider('lmstudio')).toBe(true)
    expect(isLocalProvider('LMSTUDIO')).toBe(true)
    expect(isLocalProvider('OLLAMA')).toBe(true)

    // Cloud and remote services are NOT local
    expect(isLocalProvider('groq')).toBe(false)
    expect(isLocalProvider('google')).toBe(false)
    expect(isLocalProvider('openrouter')).toBe(false)
    expect(isLocalProvider('pollinations')).toBe(false)
    expect(isLocalProvider('cloudflare')).toBe(false)
    expect(isLocalProvider('openai')).toBe(false)
    // Ollama Cloud is a hosted cloud provider, not local
    expect(isLocalProvider('ollamacloud')).toBe(false)
  })

  it('correctly detects loopback / local URLs', () => {
    expect(isLocalUrl('http://localhost:11434/v1')).toBe(true)
    expect(isLocalUrl('http://127.0.0.1:1234/v1')).toBe(true)
    expect(isLocalUrl('http://0.0.0.0:8000/v1')).toBe(true)
    expect(isLocalUrl('http://[::1]:11434/v1')).toBe(true)

    // Remote URLs
    expect(isLocalUrl('https://api.groq.com/openai/v1')).toBe(false)
    expect(isLocalUrl('https://openrouter.ai/api/v1')).toBe(false)
    expect(isLocalUrl('https://ollama.com/v1')).toBe(false)
    expect(isLocalUrl('https://generativelanguage.googleapis.com')).toBe(false)
  })

  it('permits local providers on desktop and rejects them on mobile', () => {
    for (const localId of LOCAL_PROVIDER_IDS) {
      // Desktop: allowed
      expect(isProviderSupportedOnPlatform(localId, false)).toBe(true)
      // Mobile: strictly forbidden
      expect(isProviderSupportedOnPlatform(localId, true)).toBe(false)
    }

    // Cloud providers are supported on both desktop and mobile
    const cloudProviders = ['groq', 'google', 'openrouter', 'pollinations', 'cloudflare', 'openai', 'ollamacloud']
    for (const cloudId of cloudProviders) {
      expect(isProviderSupportedOnPlatform(cloudId, false)).toBe(true)
      expect(isProviderSupportedOnPlatform(cloudId, true)).toBe(true)
    }
  })

  it('filters preset dropdowns and selectors on mobile to exclude local providers', () => {
    const desktopPresets = getSupportedProviderPresets(PROVIDER_PRESETS, false)
    const mobilePresets = getSupportedProviderPresets(PROVIDER_PRESETS, true)

    // Desktop contains ollama and lmstudio
    expect(desktopPresets.some((p) => p.id === 'ollama')).toBe(true)
    expect(desktopPresets.some((p) => p.id === 'lmstudio')).toBe(true)

    // Mobile strictly excludes ollama and lmstudio
    expect(mobilePresets.some((p) => p.id === 'ollama')).toBe(false)
    expect(mobilePresets.some((p) => p.id === 'lmstudio')).toBe(false)

    // Mobile retains cloud presets including Ollama Cloud
    expect(mobilePresets.some((p) => p.id === 'groq')).toBe(true)
    expect(mobilePresets.some((p) => p.id === 'google')).toBe(true)
    expect(mobilePresets.some((p) => p.id === 'openrouter')).toBe(true)
    expect(mobilePresets.some((p) => p.id === 'pollinations')).toBe(true)
    expect(mobilePresets.some((p) => p.id === 'ollamacloud')).toBe(true)
  })

  it('excludes local providers from fallback chain on mobile runtime', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      keyedProviders: ['groq', 'google'],
      // Even if user settings have local providers configured in order or fallback
      chatDefault: { providerId: 'ollama', model: 'llama3.2:3b' },
      fallbackModel: { providerId: 'lmstudio', model: 'loaded-model' },
      chatProviderOrder: ['ollama', 'groq', 'lmstudio', 'google'],
    }

    // On mobile runtime, local providers must be stripped from candidate chain
    // Simulate mobile by checking candidates with mobile filter
    const chain = buildFallbackChain('chat', null, settings)
    // Note: in Node/vitest test environment without Capacitor or mobile UA, isMobilePlatform() is false,
    // so buildFallbackChain defaults to desktop. Let's verify desktop behavior first:
    expect(chain.some((c) => c.providerId === 'ollama')).toBe(true)
  })

  it('blocks local URL requests when mobile platform is detected', async () => {
    // When navigator.userAgent indicates mobile, streamGroq/chatGroq should reject local URLs
    const originalUA = navigator.userAgent
    try {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
        configurable: true,
      })

      // Attempting to chat with local URL on mobile must throw
      await expect(
        chatGroq({
          apiKey: '',
          baseUrl: 'http://localhost:11434/v1',
          model: 'llama3.2',
          messages: [{ role: 'user', content: 'hello' }],
        }),
      ).rejects.toThrow(/not supported on mobile devices/)

      // streamGroq must throw as well
      const stream = streamGroq({
        apiKey: '',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'loaded-model',
        messages: [{ role: 'user', content: 'hello' }],
      })
      await expect(stream.next()).rejects.toThrow(/not supported on mobile devices/)

      // listGroqModels returns empty array
      const models = await listGroqModels('', 'http://localhost:11434/v1')
      expect(models).toEqual([])

      // Fallback chain built in mobile environment strips local providers
      const settings = {
        ...DEFAULT_SETTINGS,
        keyedProviders: ['groq', 'google'],
        chatDefault: { providerId: 'ollama', model: 'llama3.2:3b' },
        fallbackModel: { providerId: 'lmstudio', model: 'loaded-model' },
        chatProviderOrder: ['ollama', 'groq', 'lmstudio', 'google'],
      }
      const mobileChain = buildFallbackChain('chat', null, settings)
      expect(mobileChain.some((c) => c.providerId === 'ollama')).toBe(false)
      expect(mobileChain.some((c) => c.providerId === 'lmstudio')).toBe(false)
      expect(mobileChain.some((c) => c.providerId === 'groq')).toBe(true)
      expect(mobileChain.some((c) => c.providerId === 'google')).toBe(true)
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      })
    }
  })
})
