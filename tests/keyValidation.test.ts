import { describe, expect, it } from 'vitest'
import { validateKeyFormat } from '../src/lib/keyValidation'

describe('validateKeyFormat', () => {
  it('allows any key format for Groq, Google, OpenRouter, OpenAI, etc. without blocking', () => {
    expect(validateKeyFormat('groq', 'gsk_1234567890abcdef1234567890').valid).toBe(true)
    expect(validateKeyFormat('groq', 'custom_key_without_prefix').valid).toBe(true)
    expect(validateKeyFormat('google', 'any_google_or_custom_key').valid).toBe(true)
    expect(validateKeyFormat('openrouter', 'any_openrouter_key').valid).toBe(true)
    expect(validateKeyFormat('openai', 'any_openai_key').valid).toBe(true)
    expect(validateKeyFormat('cloudflare', 'token', { accountId: 'id' }).valid).toBe(true)
    expect(validateKeyFormat('ollama', '').valid).toBe(true)
    expect(validateKeyFormat('pollinations', '').valid).toBe(true)
  })
})
