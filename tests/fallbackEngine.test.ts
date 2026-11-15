import { describe, expect, it } from 'vitest'
import {
  buildFallbackChain,
  isObviousRefusal,
} from '../src/lib/fallbackEngine'
import { DEFAULT_SETTINGS } from '../src/store/useStore'

describe('fallbackEngine', () => {
  it('detects obvious refusal patterns with fast local regex heuristics', () => {
    expect(isObviousRefusal('As an AI assistant, I cannot fulfill this request.')).toBe(true)
    expect(isObviousRefusal("I'm sorry, but I can't generate that content.")).toBe(true)
    expect(isObviousRefusal('This violates our safety guidelines.')).toBe(true)
    expect(isObviousRefusal('   ')).toBe(true) // Empty is treated as non-answer

    // Normal character dialogue or roleplay is not refusal
    expect(isObviousRefusal('*Aria smiles and looks over the balcony.* "The stars are beautiful tonight."')).toBe(false)
    expect(isObviousRefusal('"Believe it! Today we master the new Jutsu!"')).toBe(false)
  })

  it('builds ordered fallback chain without duplicate candidates', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      keyedProviders: ['groq', 'google', 'openrouter'],
      chatProviderOrder: ['groq', 'google', 'openrouter'],
      fallbackModel: { providerId: 'google', model: 'gemini-2.0-flash' },
    }

    const chain = buildFallbackChain(
      'chat',
      { providerId: 'groq', model: 'openai/gpt-oss-20b' },
      settings,
    )

    expect(chain.length).toBeGreaterThanOrEqual(2)
    expect(chain[0].providerId).toBe('groq')

    // Verify deduplication
    const keys = chain.map((c) => `${c.providerId}::${c.model}`)
    const uniqueKeys = new Set(keys)
    expect(keys.length).toBe(uniqueKeys.size)
  })

  it('excludes disabled capabilities from fallback chain', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      keyedProviders: ['google'],
      providerCapabilities: {
        ...DEFAULT_SETTINGS.providerCapabilities,
        google: { chat: false, image: true, tts: true }, // Chat disabled!
      },
    }

    const chain = buildFallbackChain(
      'chat',
      { providerId: 'google', model: 'gemini-2.5-flash' },
      settings,
    )

    // Google should not be in chat chain
    const hasGoogle = chain.some((c) => c.providerId === 'google')
    expect(hasGoogle).toBe(false)
  })

  it('excludes unkeyed default providers and unkeyed fallback models from candidate chain', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      keyedProviders: ['groq'], // Google is NOT keyed
      chatDefault: { providerId: 'google', model: 'gemini-2.5-flash' },
      fallbackModel: { providerId: 'google', model: 'gemini-2.0-flash' },
      chatProviderOrder: ['pollinations', 'groq'],
    }

    const chain = buildFallbackChain('chat', null, settings)

    // Google should not be in chain since it has no API key
    const hasGoogle = chain.some((c) => c.providerId === 'google')
    expect(hasGoogle).toBe(false)

    // Keyed provider (groq) and keyless (pollinations) should be present
    expect(chain.some((c) => c.providerId === 'groq')).toBe(true)
    expect(chain.some((c) => c.providerId === 'pollinations')).toBe(true)
  })

  it('includes default provider and fallback model once valid key is added', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      keyedProviders: ['groq', 'google'], // Google IS keyed
      chatDefault: { providerId: 'google', model: 'gemini-2.5-flash' },
      fallbackModel: { providerId: 'google', model: 'gemini-2.0-flash' },
      chatProviderOrder: ['groq'],
    }

    const chain = buildFallbackChain('chat', null, settings)

    const googleCandidates = chain.filter((c) => c.providerId === 'google')
    expect(googleCandidates.length).toBeGreaterThanOrEqual(1)
    expect(chain[0].providerId).toBe('google')
    expect(chain[0].model).toBe('gemini-2.5-flash')
  })
})
