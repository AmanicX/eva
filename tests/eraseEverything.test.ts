import { describe, it, expect, beforeEach } from 'vitest'
import { eraseEverything } from '@/lib/reset'
import { useStore } from '@/store/useStore'
import {
  setApiKey,
  getApiKey,
  setProviderKey,
  getProviderKey,
  setCloudflareCredentials,
  getCloudflareCredentials,
  setWebPersistenceAllowed,
  isWebPersistenceAllowed,
} from '@/lib/credentials'
import { storeImageBlob, getImageBlob } from '@/lib/imageStorage'

class MockStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

const mockLocalStorage = new MockStorage()
const mockSessionStorage = new MockStorage()

if (typeof (globalThis as any).window === 'undefined') {
  ;(globalThis as any).window = globalThis
}
;(globalThis as any).window.localStorage = mockLocalStorage
;(globalThis as any).window.sessionStorage = mockSessionStorage

describe('Comprehensive Data & Credential Erasure ("Erase Everything")', () => {
  beforeEach(async () => {
    mockLocalStorage.clear()
    mockSessionStorage.clear()

    // Populate dummy state and credentials
    await setApiKey('gsk_secret_to_erase')
    await setProviderKey('openai', 'sk_secret_to_erase')
    await setCloudflareCredentials('account_123', 'token_456')
    setWebPersistenceAllowed(true)

    useStore.getState().updateSettings({
      theme: 'anime',
      temperature: 1.2,
      onboarded: true,
    })
    useStore.getState().createCharacter({
      theme: 'anime',
      name: 'To Be Erased',
      tagline: 'Temporary character',
    })

    await storeImageBlob('img_erase_test', new Blob(['test']), 'prompt')
  })

  it('permanently erases all store state, credentials, consent, and images', async () => {
    // Verify pre-condition
    expect(useStore.getState().characters.length).toBeGreaterThan(0)
    expect(await getApiKey()).toBe('gsk_secret_to_erase')
    expect(await getProviderKey('openai')).toBe('sk_secret_to_erase')
    expect((await getCloudflareCredentials()).apiToken).toBe('token_456')
    expect(isWebPersistenceAllowed()).toBe(true)
    expect(await getImageBlob('img_erase_test')).toBeDefined()

    // Execute full cryptographic erasure
    const result = await eraseEverything()
    expect(result.success).toBe(true)
    expect(result.errors).toHaveLength(0)

    // 1. Verify credentials erased across backends
    expect(await getApiKey()).toBe('')
    expect(await getProviderKey('openai')).toBe('')
    const cf = await getCloudflareCredentials()
    expect(cf.accountId).toBe('')
    expect(cf.apiToken).toBe('')

    // 2. Verify web consent erased
    expect(isWebPersistenceAllowed()).toBe(false)

    // 3. Verify images erased from IndexedDB / memory
    expect(await getImageBlob('img_erase_test')).toBeNull()

    // 4. Verify store reset to pristine defaults
    const state = useStore.getState()
    expect(state.characters).toHaveLength(0)
    expect(state.conversations).toHaveLength(0)
    expect(state.worlds).toHaveLength(0)
    expect(state.settings.onboarded).toBe(false)
    expect(state.settings.theme).toBe('chatbot')
  })
})
