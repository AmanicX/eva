/**
 * Comprehensive Application Reset and Data Erasure Engine for Eva
 *
 * Implements full cryptographic credential destruction, cache purging,
 * IndexedDB clearing, and state reset across Electron, Android, and Web platforms.
 */

import {
  clearApiKey,
  clearCloudflareCredentials,
  clearProviderKey,
  clearSecureSecret,
  setWebPersistenceAllowed,
} from './credentials'
import { clearAllImages } from './imageStorage'
import { PROVIDER_PRESETS } from './groq'
import { useStore, DEFAULT_SETTINGS } from '@/store/useStore'

function getDesktopApi() {
  if (typeof window === 'undefined') return undefined
  return (window as any).evaDesktop || (window as any).nexusDesktop
}

function getAndroidSecureStoragePlugin(): any {
  if (typeof window === 'undefined') return undefined
  const cap = (window as any).Capacitor
  if (cap?.isNativePlatform && cap.isNativePlatform() && cap.Plugins?.SecureStorage) {
    return cap.Plugins.SecureStorage
  }
  return undefined
}

export interface EraseResult {
  success: boolean
  errors: string[]
}

/**
 * Permanently erases all user conversations, character definitions, world bibles,
 * cached image binaries, and stored API keys / credentials across all platforms.
 */
export async function eraseEverything(): Promise<EraseResult> {
  const errors: string[] = []

  // 1. Clear credentials across platform backends
  try {
    await clearApiKey()
  } catch (err: any) {
    errors.push(`Failed to clear primary API key: ${err?.message}`)
  }

  try {
    await clearCloudflareCredentials()
  } catch (err: any) {
    errors.push(`Failed to clear Cloudflare credentials: ${err?.message}`)
  }

  for (const preset of PROVIDER_PRESETS) {
    try {
      await clearProviderKey(preset.id)
    } catch (err: any) {
      errors.push(`Failed to clear provider key ${preset.id}: ${err?.message}`)
    }
  }

  try {
    await clearSecureSecret('custom')
    await clearSecureSecret('local-custom')
  } catch (err: any) {
    errors.push(`Failed to clear custom credentials: ${err?.message}`)
  }

  // 2. Native storage deep wipe
  const desktop = getDesktopApi()
  if (desktop?.clearAllSecureCredentials) {
    try {
      await desktop.clearAllSecureCredentials()
    } catch {
      // Desktop clear fallback
    }
  }

  const androidPlugin = getAndroidSecureStoragePlugin()
  if (androidPlugin?.clear) {
    try {
      await androidPlugin.clear()
    } catch {
      // Android clear fallback
    }
  }

  // 3. Clear web persistence consent and all localStorage keys
  try {
    setWebPersistenceAllowed(false)
  } catch {
    // Ignore
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem('nexus-chat-store')
      window.localStorage.removeItem('eva_api_key')
      window.localStorage.removeItem('eva_allow_web_persistence')

      // Clear any remaining eva keys
      const keysToRemove: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k && (k.startsWith('eva_') || k.startsWith('nexus_') || k.includes('store'))) {
          keysToRemove.push(k)
        }
      }
      for (const k of keysToRemove) {
        window.localStorage.removeItem(k)
      }
    } catch (err: any) {
      errors.push(`LocalStorage cleanup error: ${err?.message}`)
    }
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.clear()
    } catch {
      // Ignore
    }
  }

  // 4. Clear IndexedDB images
  try {
    await clearAllImages()
  } catch (err: any) {
    errors.push(`Failed to clear cached images in IndexedDB: ${err?.message}`)
  }

  // 5. Reset Zustand store to pristine fresh install state
  try {
    const store = useStore.getState()
    store.replaceAll({
      settings: {
        ...DEFAULT_SETTINGS,
        onboarded: false,
      },
      characters: [],
      worlds: [],
      conversations: [],
    })
    store.setUI({
      welcomeOpen: true,
      settingsOpen: false,
      characterModal: null,
      worldModal: null,
      sidebarOpen: false,
      memoryOpen: false,
      rightPanel: 'none',
      commandPaletteOpen: false,
    })
  } catch (err: any) {
    errors.push(`Failed to reset memory store: ${err?.message}`)
  }

  return {
    success: errors.length === 0,
    errors,
  }
}
