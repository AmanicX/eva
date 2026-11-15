/**
 * Cross-Platform Credential & Secret Storage Abstraction
 *
 * Provides a clean interface for securely storing sensitive credentials (AI provider API keys,
 * OAuth tokens) without exposing them in unencrypted backups, Zustand store persistence, or logs.
 *
 * Supported platforms:
 * - Electron: Backed by Electron's native `safeStorage` (OS Keychain on macOS, Secret Service / libsecret on Linux, DPAPI on Windows).
 * - Web / Android WebView: Memory-cached storage with explicit security boundary metadata.
 */

export interface CredentialStorageInfo {
  isHardwareEncrypted: boolean
  platform: 'electron-safestorage' | 'web-storage'
  description: string
}

let inMemoryApiKey: string | null = null
const inMemorySecrets = new Map<string, string>()

function getDesktopApi() {
  if (typeof window === 'undefined') return undefined
  return (window as any).evaDesktop || (window as any).nexusDesktop
}

/**
 * Checks whether OS-level credential encryption (safeStorage) is available.
 */
export async function isPlatformEncryptionAvailable(): Promise<boolean> {
  const desktop = getDesktopApi()
  if (desktop?.isSecureStorageAvailable) {
    try {
      return await desktop.isSecureStorageAvailable()
    } catch {
      return false
    }
  }
  return false
}

/**
 * Returns human-readable diagnostic metadata about how secrets are stored on this platform.
 */
export async function getCredentialStorageInfo(): Promise<CredentialStorageInfo> {
  const hasSafeStorage = await isPlatformEncryptionAvailable()
  if (hasSafeStorage) {
    return {
      isHardwareEncrypted: true,
      platform: 'electron-safestorage',
      description: 'Protected by operating system keychain / credentials manager (Electron safeStorage).',
    }
  }
  return {
    isHardwareEncrypted: false,
    platform: 'web-storage',
    description: 'Stored in local client storage. Browser environments cannot provide hardware-isolated key protection.',
  }
}

/**
 * Retrieves the stored API key, checking platform secure storage first, then falling back to memory/local.
 */
export async function getApiKey(): Promise<string> {
  if (inMemoryApiKey !== null) {
    return inMemoryApiKey
  }

  const desktop = getDesktopApi()
  if (desktop?.getSecureCredential) {
    try {
      const stored = await desktop.getSecureCredential('api_key')
      if (stored) {
        inMemoryApiKey = stored
        return stored
      }
    } catch {
      // safeStorage lookup failed, check fallback
    }
  }

  // Web / fallback: check sessionStorage first, then localStorage
  if (typeof window !== 'undefined') {
    const sessionKey = window.sessionStorage.getItem('eva_api_key')
    if (sessionKey) {
      inMemoryApiKey = sessionKey
      return sessionKey
    }
    const localKey = window.localStorage.getItem('eva_api_key')
    if (localKey) {
      inMemoryApiKey = localKey
      return localKey
    }
  }

  return ''
}

/**
 * Stores the API key using platform secure storage whenever available.
 */
export async function setApiKey(key: string): Promise<void> {
  inMemoryApiKey = key

  const desktop = getDesktopApi()
  if (desktop?.setSecureCredential) {
    try {
      const ok = await desktop.setSecureCredential('api_key', key)
      if (ok) {
        // Successfully encrypted in OS keychain; remove unencrypted fallback if present
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('eva_api_key')
          window.sessionStorage.removeItem('eva_api_key')
        }
        return
      }
    } catch {
      // safeStorage save failed; fallback to local
    }
  }

  // Web / fallback storage
  if (typeof window !== 'undefined') {
    if (key) {
      window.localStorage.setItem('eva_api_key', key)
    } else {
      window.localStorage.removeItem('eva_api_key')
      window.sessionStorage.removeItem('eva_api_key')
    }
  }
}

/**
 * Clears the stored API key across all storage backends.
 */
export async function clearApiKey(): Promise<void> {
  inMemoryApiKey = ''
  const desktop = getDesktopApi()
  if (desktop?.deleteSecureCredential) {
    try {
      await desktop.deleteSecureCredential('api_key')
    } catch {
      // ignore
    }
  }
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('eva_api_key')
    window.sessionStorage.removeItem('eva_api_key')
  }
}

/**
 * Stores a named secure secret (e.g. OAuth tokens, sync credentials).
 */
export async function setSecureSecret(key: string, value: string): Promise<void> {
  inMemorySecrets.set(key, value)
  const desktop = getDesktopApi()
  if (desktop?.setSecureCredential) {
    try {
      const ok = await desktop.setSecureCredential(`secret_${key}`, value)
      if (ok) return
    } catch {
      // fallback
    }
  }
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(`eva_secret_${key}`, value)
  }
}

/**
 * Retrieves a named secure secret.
 */
export async function getSecureSecret(key: string): Promise<string | null> {
  if (inMemorySecrets.has(key)) {
    return inMemorySecrets.get(key) || null
  }
  const desktop = getDesktopApi()
  if (desktop?.getSecureCredential) {
    try {
      const val = await desktop.getSecureCredential(`secret_${key}`)
      if (val) {
        inMemorySecrets.set(key, val)
        return val
      }
    } catch {
      // fallback
    }
  }
  if (typeof window !== 'undefined') {
    const val = window.sessionStorage.getItem(`eva_secret_${key}`)
    if (val) {
      inMemorySecrets.set(key, val)
      return val
    }
  }
  return null
}

/**
 * Removes a named secure secret.
 */
export async function clearSecureSecret(key: string): Promise<void> {
  inMemorySecrets.delete(key)
  const desktop = getDesktopApi()
  if (desktop?.deleteSecureCredential) {
    try {
      await desktop.deleteSecureCredential(`secret_${key}`)
    } catch {
      // ignore
    }
  }
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(`eva_secret_${key}`)
    window.localStorage.removeItem(`eva_secret_${key}`)
  }
}

export const removeSecureSecret = clearSecureSecret
