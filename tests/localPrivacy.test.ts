import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildFallbackChain,
  judgeReplyRefusal,
  executeChatWithFallback,
} from '@/lib/fallbackEngine'
import { checkImageExplicitContent } from '@/lib/imageGuard'
import { DEFAULT_SETTINGS } from '@/store/useStore'
import type { Settings } from '@/types'

describe('Local-Only Privacy Guarantees (Zero Cloud Leakage)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('excludes all cloud providers from fallback chain when local model is primary and cloud fallback is disabled', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      chatDefault: { providerId: 'ollama', model: 'llama3:8b' },
      keyedProviders: ['groq', 'google', 'openai'], // Has cloud keys saved
      allowCloudFallback: false,
      chatProviderOrder: ['ollama', 'groq', 'google', 'pollinations'],
      fallbackModel: { providerId: 'groq', model: 'openai/gpt-oss-20b' },
    }

    const chain = buildFallbackChain('chat', null, settings)

    // Should only contain local candidates
    expect(chain.length).toBe(1)
    expect(chain[0].providerId).toBe('ollama')
    expect(chain.some((c) => c.providerId === 'groq')).toBe(false)
    expect(chain.some((c) => c.providerId === 'google')).toBe(false)
    expect(chain.some((c) => c.providerId === 'pollinations')).toBe(false)
  })

  it('permits authorized cloud providers only when allowCloudFallback is explicitly enabled', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      chatDefault: { providerId: 'ollama', model: 'llama3:8b' },
      keyedProviders: ['groq', 'google'],
      allowCloudFallback: true, // Explicit opt-in
      chatProviderOrder: ['ollama', 'groq', 'google', 'pollinations'],
    }

    const chain = buildFallbackChain('chat', null, settings)

    expect(chain.some((c) => c.providerId === 'ollama')).toBe(true)
    expect(chain.some((c) => c.providerId === 'groq')).toBe(true)
    expect(chain.some((c) => c.providerId === 'google')).toBe(true)
  })

  it('does NOT invoke external cloud judge for refusal classification when primary is local', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      chatDefault: { providerId: 'ollama', model: 'llama3:8b' },
      fallbackModel: { providerId: 'groq', model: 'llama-3.1-8b-instant' },
      keyedProviders: ['groq'],
      allowCloudFallback: false,
    }

    // A non-obvious refusal that regex would not catch
    const result = await judgeReplyRefusal(
      'How do I make chocolate cake?',
      'Here is a wonderful recipe for chocolate cake with flour and cocoa.',
      settings.fallbackModel,
      undefined,
      settings,
      true, // isPrimaryLocal
    )

    // Fetch MUST NOT be called! Zero cloud requests
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.refusal).toBe(false)
    expect(result.reason).toContain('privacy')
  })

  it('does NOT invoke external cloud judge for image content check when running locally without cloud consent', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      imageDefault: { providerId: 'ollama', model: 'flux' },
      fallbackModel: { providerId: 'groq', model: 'llama-3.1-8b-instant' },
      keyedProviders: ['groq'],
      allowCloudFallback: false,
    }

    const res = await checkImageExplicitContent('A beautiful mountain landscape at sunset', settings)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(res.explicit).toBe(false)
  })

  it('makes zero cloud calls when executing chat with a local provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hello from local Ollama model!' } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      chatDefault: { providerId: 'ollama', model: 'llama3:8b' },
      fallbackModel: { providerId: 'groq', model: 'llama-3.1-8b-instant' },
      keyedProviders: ['groq'],
      allowCloudFallback: false,
    }

    const result = await executeChatWithFallback({
      messages: [{ role: 'user', content: 'Hello' }],
      settings,
    })

    expect(result.content).toBe('Hello from local Ollama model!')
    expect(result.usedCandidate.providerId).toBe('ollama')

    // Only one call was made, and it was to Ollama's localhost endpoint, not Groq
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const calledUrl = fetchMock.mock.calls[0][0]
    expect(calledUrl).toContain('localhost:11434')
    expect(calledUrl).not.toContain('api.groq.com')
  })
})
