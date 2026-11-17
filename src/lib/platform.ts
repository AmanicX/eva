import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * Returns true only when running inside the native Android Capacitor shell.
 * This is true on native Android APK builds, but false on Electron desktop
 * (even in small/narrow windows) and standard web browsers.
 */
export function isAndroidPlatform(): boolean {
  if (typeof window === 'undefined') return false
  return Capacitor.getPlatform() === 'android'
}

/**
 * Returns true when running inside the Electron desktop application.
 */
export function isDesktopPlatform(): boolean {
  if (typeof window === 'undefined') return false
  return !!((window as any).evaDesktop?.isElectron || (window as any).nexusDesktop?.isElectron)
}

/**
 * Returns true when running on a native Capacitor platform (Android/iOS).
 */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false
  return Capacitor.isNativePlatform()
}

/**
 * Returns true when running in any mobile environment (native Android/iOS
 * Capacitor shell or mobile browser on a phone/tablet).
 *
 * IMPORTANT: This does NOT depend on viewport width or CSS media queries.
 * A desktop window resized to narrow mobile width is still a desktop environment,
 * while a mobile device running fullscreen or desktop-mode is still mobile.
 */
export function isMobilePlatform(): boolean {
  // 1. Native mobile runtime (Capacitor Android / iOS)
  try {
    if (Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios') {
      return true
    }
  } catch {
    // Ignore Capacitor lookup failures in test/non-standard environments
  }

  // 2. Desktop Electron application is always desktop (never mobile)
  if (isDesktopPlatform()) {
    return false
  }

  // 3. User agent inspection for mobile devices (phones & tablets)
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    const ua = navigator.userAgent
    const isMobileUA = /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|webOS/i.test(ua)
    const isIPad = (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) || /iPad/i.test(ua)
    if (isMobileUA || isIPad) {
      return true
    }
  }

  return false
}

/**
 * Known local AI providers that run on the user's computer via localhost servers.
 * These are strictly DESKTOP-ONLY and must never be exposed on mobile.
 */
export const LOCAL_PROVIDER_IDS = ['ollama', 'lmstudio'] as const
export type LocalProviderId = (typeof LOCAL_PROVIDER_IDS)[number]

/**
 * Checks whether a provider id represents a local-only AI provider.
 */
export function isLocalProvider(providerId?: string): boolean {
  if (!providerId) return false
  return (LOCAL_PROVIDER_IDS as readonly string[]).includes(providerId.toLowerCase())
}

/**
 * Checks whether a URL points to localhost or a loopback address.
 */
export function isLocalUrl(url?: string): boolean {
  if (!url) return false
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|:11434|:1234/i.test(url)
}

/**
 * Determines whether a given provider is supported on the current (or specified) platform.
 * Local providers are supported exclusively on desktop.
 */
export function isProviderSupportedOnPlatform(
  providerId?: string,
  isMobile = isMobilePlatform(),
): boolean {
  if (!providerId) return true
  if (isLocalProvider(providerId)) {
    return !isMobile
  }
  return true
}

/**
 * Filters any list of provider presets based on the current (or specified) platform.
 */
export function getSupportedProviderPresets<T extends { id: string }>(
  presets: T[],
  isMobile = isMobilePlatform(),
): T[] {
  return presets.filter((p) => isProviderSupportedOnPlatform(p.id, isMobile))
}

/**
 * React hook that returns true when the viewport/platform should use the desktop
 * full-screen layout, and false when it should use the mobile sheet presentation.
 *
 * Rules:
 * - Native Android / iOS Capacitor apps are ALWAYS mobile (false)
 * - Mobile User-Agent browsers are ALWAYS mobile (false)
 * - Electron desktop is ALWAYS desktop (true)
 * - Web browsers use a responsive breakpoint (window.innerWidth >= 768)
 */
export function useIsDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    if (isMobilePlatform()) return false
    if (isDesktopPlatform()) return true
    return window.innerWidth >= 768
  })

  useEffect(() => {
    if (typeof window === 'undefined' || isMobilePlatform() || isDesktopPlatform()) return

    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isDesktop
}
