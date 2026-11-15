import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getApiKey,
  setApiKey,
  getSecureSecret,
  setSecureSecret,
  removeSecureSecret,
  getCredentialStorageInfo,
  isWebPersistenceAllowed,
  setWebPersistenceAllowed,
  migrateLegacyCredentials,
} from '../src/lib/credentials'

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

// Ensure window and web storage exist in Node/Vitest test environment
if (typeof (globalThis as any).window === 'undefined') {
  ;(globalThis as any).window = globalThis
}
;(globalThis as any).window.localStorage = mockLocalStorage
;(globalThis as any).window.sessionStorage = mockSessionStorage

describe('Credential Storage Abstraction (credentials)', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
    mockSessionStorage.clear()
    delete (window as any).evaDesktop
    delete (window as any).nexusDesktop
    delete (window as any).Capacitor
    setWebPersistenceAllowed(false)
  })

  afterEach(() => {
    delete (window as any).evaDesktop
    delete (window as any).nexusDesktop
    delete (window as any).Capacitor
  })

  it('stores and retrieves API key in volatile memory by default on web', async () => {
    await setApiKey('sk-groq-test-key-12345')
    const retrieved = await getApiKey()
    expect(retrieved).toBe('sk-groq-test-key-12345')

    // Web persistence was false, so localStorage MUST NOT have the plaintext key
    expect(window.localStorage.getItem('eva_api_key')).toBeNull()
  })

  it('stores, retrieves, and removes arbitrary secrets', async () => {
    await setSecureSecret('test_github_token', 'ghp_abc123xyz')
    let val = await getSecureSecret('test_github_token')
    expect(val).toBe('ghp_abc123xyz')

    await removeSecureSecret('test_github_token')
    val = await getSecureSecret('test_github_token')
    expect(val).toBeNull()
  })

  it('respects web persistence consent lifecycle', async () => {
    expect(isWebPersistenceAllowed()).toBe(false)

    // Grant consent
    setWebPersistenceAllowed(true)
    expect(isWebPersistenceAllowed()).toBe(true)

    await setApiKey('sk-groq-persistent-test')
    expect(window.localStorage.getItem('eva_api_key')).toBe('sk-groq-persistent-test')

    // Revoke consent -> must purge localStorage keys
    setWebPersistenceAllowed(false)
    expect(isWebPersistenceAllowed()).toBe(false)
    expect(window.localStorage.getItem('eva_api_key')).toBeNull()
  })

  it('returns diagnostic storage information without leaking credentials', async () => {
    const info = await getCredentialStorageInfo()
    expect(info.platform).toBe('web-memory')
    expect(info.description).toContain('volatile memory')
    expect(info.isHardwareEncrypted).toBe(false)
  })

  describe('Electron safeStorage mock integration', () => {
    it('uses Electron safeStorage when desktop IPC bridge is present', async () => {
      const mockStorage = new Map<string, string>()
      ;(window as any).evaDesktop = {
        isSecureStorageAvailable: vi.fn().mockResolvedValue(true),
        getSecureCredential: vi.fn(async (key: string) => mockStorage.get(key) || null),
        setSecureCredential: vi.fn(async (key: string, val: string) => {
          mockStorage.set(key, val)
        }),
        deleteSecureCredential: vi.fn(async (key: string) => {
          mockStorage.delete(key)
        }),
      }

      const info = await getCredentialStorageInfo()
      expect(info.platform).toBe('electron-safestorage')
      expect(info.isHardwareEncrypted).toBe(true)

      await setApiKey('sk-electron-safe-key')
      expect((window as any).evaDesktop.setSecureCredential).toHaveBeenCalledWith(
        'api_key',
        'sk-electron-safe-key',
      )

      const fetched = await getApiKey()
      expect(fetched).toBe('sk-electron-safe-key')
    })
  })

  describe('Android Keystore native plugin mock integration', () => {
    it('uses Android Keystore plugin on native Android platform', async () => {
      const mockAndroidStorage = new Map<string, string>()
      ;(window as any).Capacitor = {
        isNativePlatform: () => true,
        Plugins: {
          SecureStorage: {
            isAvailable: vi.fn().mockResolvedValue({ available: true }),
            get: vi.fn(async ({ key }: { key: string }) => ({
              value: mockAndroidStorage.get(key) || null,
            })),
            set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
              mockAndroidStorage.set(key, value)
              return { success: true }
            }),
            delete: vi.fn(async ({ key }: { key: string }) => {
              mockAndroidStorage.delete(key)
              return { success: true }
            }),
          },
        },
      }

      const info = await getCredentialStorageInfo()
      expect(info.platform).toBe('android-keystore')
      expect(info.isHardwareEncrypted).toBe(true)

      await setApiKey('sk-android-keystore-key')
      expect((window as any).Capacitor.Plugins.SecureStorage.set).toHaveBeenCalledWith({
        key: 'api_key',
        value: 'sk-android-keystore-key',
      })

      const retrieved = await getApiKey()
      expect(retrieved).toBe('sk-android-keystore-key')
    })
  })

  describe('Credential Migration', () => {
    it('migrates legacy localStorage API keys to secure backend and removes unencrypted copy only upon verification', async () => {
      window.localStorage.setItem('eva_api_key', 'sk-legacy-unencrypted-key')

      const mockStorage = new Map<string, string>()
      ;(window as any).evaDesktop = {
        isSecureStorageAvailable: vi.fn().mockResolvedValue(true),
        getSecureCredential: vi.fn(async (key: string) => mockStorage.get(key) || null),
        setSecureCredential: vi.fn(async (key: string, val: string) => {
          mockStorage.set(key, val)
        }),
        deleteSecureCredential: vi.fn(async (key: string) => {
          mockStorage.delete(key)
        }),
      }

      const result = await migrateLegacyCredentials()
      expect(result.migrated).toBe(true)
      expect(mockStorage.get('api_key')).toBe('sk-legacy-unencrypted-key')
      // Must be safely cleared from localStorage
      expect(window.localStorage.getItem('eva_api_key')).toBeNull()
    })

    it('does not remove legacy key if secure migration fails or is unavailable', async () => {
      window.localStorage.setItem('eva_api_key', 'sk-legacy-unencrypted-key')

      // No secure backend available (pure web)
      const result = await migrateLegacyCredentials()
      expect(result.migrated).toBe(false)
      expect(result.error).toBeDefined()
      // Legacy key remains preserved so user does not lose access
      expect(window.localStorage.getItem('eva_api_key')).toBe('sk-legacy-unencrypted-key')
    })
  })
})
