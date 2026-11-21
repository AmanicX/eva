import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  resolveProviderCredentials,
  resolveProviderIdFromUrl,
} from '@/lib/providerResolution'
import {
  setProviderKey,
  setCloudflareCredentials,
  clearApiKey,
  setApiKey,
} from '@/lib/credentials'
import { listGroqModels } from '@/lib/groq'

describe('Credential Isolation & Resolution', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await clearApiKey()
  })

  it('resolves distinct keys for each provider without leaking keys across providers', async () => {
    await setProviderKey('groq', 'gsk_fake_groq_key_123')
    await setProviderKey('openai', 'sk_fake_openai_key_456')
    await setProviderKey('google', 'AIza_fake_google_key_789')

    const groqCreds = await resolveProviderCredentials({ providerId: 'groq' })
    const openaiCreds = await resolveProviderCredentials({ providerId: 'openai' })
    const googleCreds = await resolveProviderCredentials({ providerId: 'google' })

    expect(groqCreds.apiKey).toBe('gsk_fake_groq_key_123')
    expect(openaiCreds.apiKey).toBe('sk_fake_openai_key_456')
    expect(googleCreds.apiKey).toBe('AIza_fake_google_key_789')

    // Verification: OpenAI does NOT get Groq's key
    expect(openaiCreds.apiKey).not.toBe(groqCreds.apiKey)
  })

  it('uses unsaved form keys when provided during connection testing', async () => {
    await setProviderKey('openai', 'saved_old_key')

    const creds = await resolveProviderCredentials({
      providerId: 'openai',
      formKey: 'unsaved_new_form_key',
    })

    expect(creds.apiKey).toBe('unsaved_new_form_key')
  })

  it('properly resolves Cloudflare credentials with account-specific URL', async () => {
    await setCloudflareCredentials('cf_test_account_id', 'cf_test_token_xyz')

    const creds = await resolveProviderCredentials({ providerId: 'cloudflare' })

    expect(creds.apiKey).toBe('cf_test_token_xyz')
    expect(creds.accountId).toBe('cf_test_account_id')
    expect(creds.baseUrl).toContain('cf_test_account_id')
    expect(creds.baseUrl).not.toContain('{account_id}')
  })

  it('does not treat unrecognized or custom endpoints as Groq', () => {
    const customUrl = 'https://my-private-llm.internal.net/v1'
    const providerId = resolveProviderIdFromUrl(customUrl)
    expect(providerId).toBe('custom')
    expect(providerId).not.toBe('groq')

    const localCustomUrl = 'http://192.168.1.100:8000/v1'
    const localProviderId = resolveProviderIdFromUrl(localCustomUrl)
    expect(localProviderId).toBe('custom')
  })

  it('sends only the resolved provider key in network headers during connection test', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'gpt-4o' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await setApiKey('gsk_groq_saved_key')
    await setProviderKey('openai', 'sk_openai_special_key')

    const creds = await resolveProviderCredentials({ providerId: 'openai' })
    await listGroqModels(creds.apiKey, creds.baseUrl)

    expect(fetchMock).toHaveBeenCalled()
    const callHeaders = fetchMock.mock.calls[0][1].headers
    expect(callHeaders.Authorization).toBe('Bearer sk_openai_special_key')
    expect(callHeaders.Authorization).not.toBe('Bearer gsk_groq_saved_key')
  })
})
