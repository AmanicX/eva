import { describe, expect, it } from 'vitest'
import { validateKeyFormat } from '../src/lib/keyValidation'

describe('validateKeyFormat', () => {
  it('validates Groq keys format (starts with gsk_)', () => {
    expect(validateKeyFormat('groq', 'gsk_1234567890abcdef1234567890').valid).toBe(true)
    expect(validateKeyFormat('groq', 'sk_invalid').valid).toBe(false)
    expect(validateKeyFormat('groq', 'gsk_short').valid).toBe(false)
    expect(validateKeyFormat('groq', '').valid).toBe(false)
  })

  it('validates OpenRouter keys format (starts with sk-or-)', () => {
    expect(validateKeyFormat('openrouter', 'sk-or-v1-abcdef1234567890abcdef1234567890').valid).toBe(true)
    expect(validateKeyFormat('openrouter', 'sk-or-simpletoken123456').valid).toBe(true)
    expect(validateKeyFormat('openrouter', 'sk-proj-something').valid).toBe(false)
    expect(validateKeyFormat('openrouter', '').valid).toBe(false)
  })

  it('validates OpenAI keys format (starts with sk- or sk-proj-)', () => {
    expect(validateKeyFormat('openai', 'sk-abcdef1234567890abcdef123456').valid).toBe(true)
    expect(validateKeyFormat('openai', 'sk-proj-abcdef1234567890abcdef123456').valid).toBe(true)
    expect(validateKeyFormat('openai', 'invalid_key').valid).toBe(false)
  })

  it('validates Google AI Studio keys format (starts with AIza and exactly 39 chars)', () => {
    const validGoogleKey = 'AIza' + 'a'.repeat(35)
    expect(validateKeyFormat('google', validGoogleKey).valid).toBe(true)
    // Wrong prefix
    expect(validateKeyFormat('google', 'BIza' + 'a'.repeat(35)).valid).toBe(false)
    // Wrong length
    expect(validateKeyFormat('google', 'AIza' + 'a'.repeat(34)).valid).toBe(false)
    expect(validateKeyFormat('google', 'AIza' + 'a'.repeat(36)).valid).toBe(false)
  })

  it('validates Cloudflare Workers AI credentials (32-hex Account ID + API token)', () => {
    const validAccountId = '0123456789abcdef0123456789abcdef'
    const validToken = 'valid_api_token_url_safe_string_12345'

    expect(validateKeyFormat('cloudflare', validToken, { accountId: validAccountId }).valid).toBe(true)

    // Bad account ID (too short or non-hex)
    expect(validateKeyFormat('cloudflare', validToken, { accountId: 'short' }).valid).toBe(false)
    expect(validateKeyFormat('cloudflare', validToken, { accountId: 'zzzz456789abcdef0123456789abcdef' }).valid).toBe(false)

    // Bad token
    expect(validateKeyFormat('cloudflare', 'short', { accountId: validAccountId }).valid).toBe(false)
    expect(validateKeyFormat('cloudflare', '', { accountId: validAccountId }).valid).toBe(false)
  })

  it('validates Ollama Cloud and local servers', () => {
    expect(validateKeyFormat('ollamacloud', 'ollama_valid_token_12345').valid).toBe(true)
    expect(validateKeyFormat('ollamacloud', 'simple_token_12345').valid).toBe(true)
    expect(validateKeyFormat('ollamacloud', 'sh').valid).toBe(false)

    // Local servers require no key
    expect(validateKeyFormat('ollama', '').valid).toBe(true)
    expect(validateKeyFormat('lmstudio', '').valid).toBe(true)
  })

  it('allows optional key for Pollinations.ai', () => {
    expect(validateKeyFormat('pollinations', '').valid).toBe(true)
    expect(validateKeyFormat('pollinations', 'pk_valid_token_12345').valid).toBe(true)
    expect(validateKeyFormat('pollinations', 'ab').valid).toBe(false)
  })
})
