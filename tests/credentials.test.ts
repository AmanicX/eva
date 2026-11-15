import { describe, it, expect, beforeEach } from 'vitest'
import {
  getApiKey,
  setApiKey,
  getSecureSecret,
  setSecureSecret,
  removeSecureSecret,
  getCredentialStorageInfo,
} from '../src/lib/credentials'

describe('Credential Storage Abstraction (credentials)', () => {
  beforeEach(() => {
    // Reset any stored in-memory secrets
    if (typeof window !== 'undefined') {
      window.sessionStorage.clear()
      window.localStorage.clear()
    }
  })

  it('stores and retrieves API key cleanly in memory/local storage fallback', async () => {
    await setApiKey('sk-groq-test-key-12345')
    const retrieved = await getApiKey()
    expect(retrieved).toBe('sk-groq-test-key-12345')
  })

  it('stores, retrieves, and removes arbitrary secrets', async () => {
    await setSecureSecret('test_github_token', 'ghp_abc123xyz')
    let val = await getSecureSecret('test_github_token')
    expect(val).toBe('ghp_abc123xyz')

    await removeSecureSecret('test_github_token')
    val = await getSecureSecret('test_github_token')
    expect(val).toBeNull()
  })

  it('returns diagnostic storage information without leaking credentials', async () => {
    const info = await getCredentialStorageInfo()
    expect(info.platform).toBeDefined()
    expect(info.description).toBeDefined()
    expect(typeof info.isHardwareEncrypted).toBe('boolean')
  })
})
