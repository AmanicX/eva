import { describe, it, expect } from 'vitest'
import {
  PROVIDER_GUIDES,
  getGuideForBaseUrl,
} from '../src/lib/providerGuides'

describe('Provider Setup Guides Database', () => {
  const supportedIds = [
    'groq',
    'openrouter',
    'ollama',
    'lmstudio',
    'ollamacloud',
    'openai',
    'google',
    'pollinations',
    'cloudflare',
    'custom',
  ]

  it('contains comprehensive guides for all supported providers', () => {
    for (const id of supportedIds) {
      const guide = PROVIDER_GUIDES[id]
      expect(guide).toBeDefined()
      expect(guide.name).toBeTruthy()
      expect(guide.tagline).toBeTruthy()
      expect(guide.steps.length).toBeGreaterThanOrEqual(3)
      expect(guide.commonErrors.length).toBeGreaterThanOrEqual(1)
      expect(guide.defaultBaseUrl).toMatch(/^https?:\/\//)
    }
  })

  it('contains valid HTTPS official documentation action URLs where applicable', () => {
    for (const guide of Object.values(PROVIDER_GUIDES)) {
      if (guide.keyManagementUrl) {
        expect(guide.keyManagementUrl).toMatch(/^https:\/\//)
        expect(() => new URL(guide.keyManagementUrl!)).not.toThrow()
      }
      for (const step of guide.steps) {
        if (step.actionUrl) {
          expect(step.actionUrl).toMatch(/^https:\/\//)
          expect(() => new URL(step.actionUrl!)).not.toThrow()
        }
      }
    }
  })

  it('accurately resolves provider guide from arbitrary base URLs', () => {
    expect(getGuideForBaseUrl('https://api.groq.com/openai/v1').id).toBe('groq')
    expect(getGuideForBaseUrl('https://api.groq.com/openai/v1/').id).toBe('groq')
    expect(getGuideForBaseUrl('https://openrouter.ai/api/v1').id).toBe('openrouter')
    expect(getGuideForBaseUrl('http://localhost:11434/v1').id).toBe('ollama')
    expect(getGuideForBaseUrl('http://127.0.0.1:11434/v1').id).toBe('ollama')
    expect(getGuideForBaseUrl('http://localhost:1234/v1').id).toBe('lmstudio')
    expect(getGuideForBaseUrl('https://ollama.com/v1').id).toBe('ollamacloud')
    expect(getGuideForBaseUrl('https://api.openai.com/v1').id).toBe('openai')
    expect(getGuideForBaseUrl('https://generativelanguage.googleapis.com/v1beta/openai').id).toBe('google')
    expect(getGuideForBaseUrl('https://text.pollinations.ai/openai').id).toBe('pollinations')
    expect(getGuideForBaseUrl('https://api.cloudflare.com/client/v4/accounts/123/ai/v1').id).toBe('cloudflare')
    expect(getGuideForBaseUrl('https://api.deepseek.com/v1').id).toBe('custom')
    expect(getGuideForBaseUrl('http://192.168.1.100:8000/v1').id).toBe('custom')
  })

  it('distinguishes between local and cloud providers correctly', () => {
    expect(PROVIDER_GUIDES.groq.isLocal).toBe(false)
    expect(PROVIDER_GUIDES.groq.needsKey).toBe(true)

    expect(PROVIDER_GUIDES.ollama.isLocal).toBe(true)
    expect(PROVIDER_GUIDES.ollama.needsKey).toBe(false)

    expect(PROVIDER_GUIDES.lmstudio.isLocal).toBe(true)
    expect(PROVIDER_GUIDES.lmstudio.needsKey).toBe(false)
  })

  it('provides actionable resolutions for common error codes (401, 429, CORS, ECONNREFUSED)', () => {
    const groqErrors = PROVIDER_GUIDES.groq.commonErrors
    expect(groqErrors.some((e) => e.code === '401')).toBe(true)
    expect(groqErrors.some((e) => e.code === '429')).toBe(true)

    const ollamaErrors = PROVIDER_GUIDES.ollama.commonErrors
    expect(ollamaErrors.some((e) => e.code === 'ECONNREFUSED')).toBe(true)
    expect(ollamaErrors.some((e) => e.code === 'CORS')).toBe(true)
  })
})
