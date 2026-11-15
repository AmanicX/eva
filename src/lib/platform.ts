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
