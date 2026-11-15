import type { ThemeId } from '@/types'

export interface AccentPalette {
  id: string
  label: string
  primary: string
  contrast: string
  description: string
}

export const CURATED_PALETTES: AccentPalette[] = [
  {
    id: 'gold',
    label: 'Astra Gold',
    primary: '#D4A359',
    contrast: '#E5B869',
    description: 'Signature Astra warm radiant gold with burnished ivory contrast',
  },
  {
    id: 'azure',
    label: 'Azure',
    primary: '#2563EB',
    contrast: '#3B82F6',
    description: 'Deep royal sapphire with architectural sky contrast',
  },
  {
    id: 'iris',
    label: 'Iris',
    primary: '#8B5CF6',
    contrast: '#A78BFA',
    description: 'Editorial iris violet with refined lavender contrast',
  },
  {
    id: 'verdant',
    label: 'Verdant',
    primary: '#10B981',
    contrast: '#34D399',
    description: 'Deep emerald pine with muted arctic teal',
  },
  {
    id: 'amber',
    label: 'Amber',
    primary: '#F59E0B',
    contrast: '#FBBF24',
    description: 'Burnished warm gold with terracotta bronze',
  },
  {
    id: 'terracotta',
    label: 'Terracotta',
    primary: '#F97316',
    contrast: '#FB923C',
    description: 'Sun-baked clay with vibrant burnt copper warmth',
  },
  {
    id: 'crimson',
    label: 'Crimson',
    primary: '#E11D48',
    contrast: '#F43F5E',
    description: 'Velvet ruby crimson with rich garnet depth',
  },
  {
    id: 'titanium',
    label: 'Titanium',
    primary: '#64748B',
    contrast: '#94A3B8',
    description: 'Architectural neutral slate with cold forged steel',
  },
]

export const DEFAULT_THEME_PALETTES: Record<ThemeId, { paletteId: string; primary: string; contrast: string }> = {
  chatbot: {
    paletteId: 'gold',
    primary: '#D4A359',
    contrast: '#E5B869',
  },
  anime: {
    paletteId: 'iris',
    primary: '#8B5CF6',
    contrast: '#A78BFA',
  },
  world: {
    paletteId: 'verdant',
    primary: '#10B981',
    contrast: '#34D399',
  },
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const sanitized = hex.replace('#', '').trim()
  if (sanitized.length === 3) {
    const r = parseInt(sanitized[0] + sanitized[0], 16)
    const g = parseInt(sanitized[1] + sanitized[1], 16)
    const b = parseInt(sanitized[2] + sanitized[2], 16)
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b }
  }
  if (sanitized.length === 6) {
    const r = parseInt(sanitized.slice(0, 2), 16)
    const g = parseInt(sanitized.slice(2, 4), 16)
    const b = parseInt(sanitized.slice(4, 6), 16)
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b }
  }
  return null
}

export function isValidHex(hex: string): boolean {
  return /^#([0-9A-F]{3}){1,2}$/i.test(hex.trim())
}

/**
 * Calculates WCAG 2.1 relative luminance for sRGB
 * Formula: https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0.5
  const { r, g, b } = rgb
  const a = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
}

/**
 * Calculates exact WCAG contrast ratio between two colors
 * Ratio range: 1:1 to 21:1
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1)
  const l2 = getLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Selects whether white (#ffffff) or dark obsidian (#09090b) yields
 * higher contrast according to WCAG contrast ratio calculations.
 */
export function getContrastForeground(bgHex: string): '#FFFFFF' | '#111111' {
  const whiteRatio = getContrastRatio(bgHex, '#FFFFFF')
  const darkRatio = getContrastRatio(bgHex, '#111111')
  return whiteRatio >= darkRatio ? '#FFFFFF' : '#111111'
}

export function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const amt = Math.round(2.55 * percent)
  const clamp = (val: number) => Math.max(0, Math.min(255, val))
  const r = clamp(rgb.r + amt).toString(16).padStart(2, '0')
  const g = clamp(rgb.g + amt).toString(16).padStart(2, '0')
  const b = clamp(rgb.b + amt).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

/**
 * Derives a harmonious, art-directed complementary or analogous secondary contrast
 * based on color wheel quadrant analysis rather than arbitrary fixed degree additions.
 */
export function deriveContrastColor(primaryHex: string): string {
  const rgb = hexToRgb(primaryHex)
  if (!rgb) return '#0284c7'
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  const hueDeg = h * 360
  let targetHue = (hueDeg + 28) % 360

  // Curate harmonious shifts for specific chromatic spectrums
  if (hueDeg >= 190 && hueDeg <= 250) {
    // Blue spectrum -> harmonious deep sky / cerulean
    targetHue = 198
  } else if (hueDeg >= 260 && hueDeg <= 320) {
    // Purple / violet spectrum -> refined rose
    targetHue = 345
  } else if (hueDeg >= 90 && hueDeg <= 170) {
    // Green spectrum -> deep teal
    targetHue = 175
  } else if (hueDeg >= 20 && hueDeg <= 60) {
    // Amber / orange -> terracotta
    targetHue = 15
  } else if (hueDeg < 20 || hueDeg > 340) {
    // Red -> garnet / wine
    targetHue = 330
  }

  const newS = Math.min(0.85, Math.max(0.55, s))
  const newL = Math.min(0.58, Math.max(0.38, l))

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }

  const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS
  const p = 2 * newL - q
  const rh = Math.round(hue2rgb(p, q, (targetHue / 360) + 1 / 3) * 255).toString(16).padStart(2, '0')
  const gh = Math.round(hue2rgb(p, q, targetHue / 360) * 255).toString(16).padStart(2, '0')
  const bh = Math.round(hue2rgb(p, q, (targetHue / 360) - 1 / 3) * 255).toString(16).padStart(2, '0')
  return `#${rh}${gh}${bh}`
}

/**
 * Synchronizes CSS variables to the document root according to the 60-30-10 distribution,
 * WCAG AA standards, and selected appearance mode.
 */
export function applyThemeTokens(
  appearanceMode: 'dark' | 'light' | 'system',
  themeId: ThemeId,
  primaryColor: string,
  contrastColor: string,
  frostedGlass: boolean,
) {
  const root = document.documentElement

  const isDark =
    appearanceMode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : appearanceMode === 'dark'

  root.dataset.theme = themeId
  root.dataset.appearance = isDark ? 'dark' : 'light'
  root.dataset.frosted = frostedGlass ? 'true' : 'false'
  root.classList.toggle('dark', isDark)
  root.classList.toggle('light', !isDark)

  const primary = isValidHex(primaryColor) ? primaryColor : (DEFAULT_THEME_PALETTES[themeId]?.primary ?? '#2563eb')
  const contrast = isValidHex(contrastColor) ? contrastColor : (DEFAULT_THEME_PALETTES[themeId]?.contrast ?? '#0284c7')

  const primaryFg = getContrastForeground(primary)
  const contrastFg = getContrastForeground(contrast)
  const primaryRgb = hexToRgb(primary) ?? { r: 37, g: 99, b: 235 }
  const contrastRgb = hexToRgb(contrast) ?? { r: 2, g: 132, b: 199 }

  const pR = primaryRgb.r
  const pG = primaryRgb.g
  const pB = primaryRgb.b
  const cR = contrastRgb.r
  const cG = contrastRgb.g
  const cB = contrastRgb.b

  if (isDark) {
    // 60% Astra Warm Dark — #12100E primary background
    root.style.setProperty('--c-bg', '#12100E')
    root.style.setProperty('--c-bg-2', '#17140F')
    // 30% Controlled layered warm surfaces
    root.style.setProperty('--c-surface', '#17140F')
    root.style.setProperty('--c-surface-2', '#1E1A14')
    root.style.setProperty('--c-surface-3', '#262019')
    root.style.setProperty('--c-surface-elevated', '#1E1A14')
    root.style.setProperty('--c-inset', '#0C0B09')
    // Borders — warm ivory low opacity
    root.style.setProperty('--c-border', 'rgba(242, 237, 227, 0.08)')
    root.style.setProperty('--c-border-strong', 'rgba(242, 237, 227, 0.16)')
    root.style.setProperty('--c-sep', 'rgba(242, 237, 227, 0.06)')
    root.style.setProperty('--c-fill', 'rgba(242, 237, 227, 0.08)')
    root.style.setProperty('--c-fill-2', 'rgba(242, 237, 227, 0.04)')
    // Text: Astra warm typography
    root.style.setProperty('--c-fg', '#F2EDE3')
    root.style.setProperty('--c-muted', '#CEC7B8')
    root.style.setProperty('--c-faint', '#A79E8D')
    root.style.setProperty('--c-subtle', '#8A8172')
    // Chat bubbles
    root.style.setProperty('--c-bubble-user', primary)
    root.style.setProperty('--c-bubble-user-fg', primaryFg)
    root.style.setProperty('--c-bubble-bot', '#1E1A14')
    root.style.setProperty('--c-bubble-bot-fg', '#F2EDE3')
    // Frosted glass (warm tinted for Astra depth)
    if (frostedGlass) {
      root.style.setProperty('--c-glass-sidebar', 'rgba(23, 20, 15, 0.75)')
      root.style.setProperty('--c-glass-header', 'rgba(23, 20, 15, 0.80)')
      root.style.setProperty('--c-glass-composer', 'rgba(30, 26, 20, 0.82)')
      root.style.setProperty('--c-glass-workspace', 'rgba(18, 16, 14, 0.45)')
      root.style.setProperty('--c-glass-panel', 'rgba(30, 26, 20, 0.85)')
      root.style.setProperty('--c-glass-modal', 'rgba(23, 20, 15, 0.90)')
      root.style.setProperty('--c-glass', 'rgba(23, 20, 15, 0.78)')
      root.style.setProperty('--c-glass-surface', 'rgba(30, 26, 20, 0.80)')
      root.style.setProperty('--glass-blur', '24px')
    } else {
      root.style.setProperty('--c-glass', '#17140F')
      root.style.setProperty('--c-glass-surface', '#1E1A14')
      root.style.setProperty('--glass-blur', '0px')
    }
  } else {
    // 60% Bright, Clean, Minimal — #FAFAFA pure neutral background (no yellow/cream)
    root.style.setProperty('--c-bg', '#FAFAFA')
    root.style.setProperty('--c-bg-2', '#FFFFFF')
    // 30% Controlled layered crisp surfaces
    root.style.setProperty('--c-surface', '#FFFFFF')
    root.style.setProperty('--c-surface-2', '#F2F2F2')
    root.style.setProperty('--c-surface-3', '#EAEAEA')
    root.style.setProperty('--c-surface-elevated', '#F2F2F2')
    root.style.setProperty('--c-inset', '#F0F0F0')
    // Borders — subtle crisp neutral
    root.style.setProperty('--c-border', 'rgba(0, 0, 0, 0.08)')
    root.style.setProperty('--c-border-strong', 'rgba(0, 0, 0, 0.14)')
    root.style.setProperty('--c-sep', 'rgba(0, 0, 0, 0.06)')
    root.style.setProperty('--c-fill', 'rgba(0, 0, 0, 0.05)')
    root.style.setProperty('--c-fill-2', 'rgba(0, 0, 0, 0.03)')
    // Text: High clarity dark slate
    root.style.setProperty('--c-fg', '#111111')
    root.style.setProperty('--c-muted', '#333333')
    root.style.setProperty('--c-faint', '#666666')
    root.style.setProperty('--c-subtle', '#888888')
    // Chat bubbles
    root.style.setProperty('--c-bubble-user', primary)
    root.style.setProperty('--c-bubble-user-fg', primaryFg)
    root.style.setProperty('--c-bubble-bot', '#F2F2F2')
    root.style.setProperty('--c-bubble-bot-fg', '#111111')
    // Frosted glass (clean bright)
    if (frostedGlass) {
      root.style.setProperty('--c-glass-sidebar', 'rgba(255, 255, 255, 0.75)')
      root.style.setProperty('--c-glass-header', 'rgba(255, 255, 255, 0.80)')
      root.style.setProperty('--c-glass-composer', 'rgba(255, 255, 255, 0.85)')
      root.style.setProperty('--c-glass-workspace', 'rgba(250, 250, 250, 0.45)')
      root.style.setProperty('--c-glass-panel', 'rgba(255, 255, 255, 0.88)')
      root.style.setProperty('--c-glass-modal', 'rgba(255, 255, 255, 0.92)')
      root.style.setProperty('--c-glass', 'rgba(255, 255, 255, 0.75)')
      root.style.setProperty('--c-glass-surface', 'rgba(250, 250, 250, 0.80)')
      root.style.setProperty('--glass-blur', '24px')
    } else {
      root.style.setProperty('--c-glass', '#FFFFFF')
      root.style.setProperty('--c-glass-surface', '#FAFAFA')
      root.style.setProperty('--glass-blur', '0px')
    }
  }

  // Accent RGB values for backdrop lighting
  root.style.setProperty('--c-accent-rgb', `${pR}, ${pG}, ${pB}`)
  root.style.setProperty('--c-contrast-rgb', `${cR}, ${cG}, ${cB}`)

  // 10% Accent Palette & Contrast Palette
  root.style.setProperty('--c-accent', primary)
  root.style.setProperty('--c-accent-contrast', contrast)
  root.style.setProperty('--c-accent-fg', primaryFg)
  root.style.setProperty('--c-accent-contrast-fg', contrastFg)
  root.style.setProperty('--c-accent-hover', isDark ? adjustBrightness(primary, 8) : adjustBrightness(primary, -8))
  root.style.setProperty('--c-accent-active', isDark ? adjustBrightness(primary, -12) : adjustBrightness(primary, 12))
  root.style.setProperty('--c-accent-surface', `rgba(${pR}, ${pG}, ${pB}, ${isDark ? 0.12 : 0.08})`)
  root.style.setProperty('--c-accent-surface-hover', `rgba(${pR}, ${pG}, ${pB}, ${isDark ? 0.18 : 0.12})`)
  root.style.setProperty('--c-accent-border', `rgba(${pR}, ${pG}, ${pB}, ${isDark ? 0.24 : 0.18})`)
  root.style.setProperty('--c-accent-ring', `rgba(${pR}, ${pG}, ${pB}, 0.35)`)

  root.style.setProperty('--c-contrast-surface', `rgba(${cR}, ${cG}, ${cB}, ${isDark ? 0.12 : 0.08})`)
  root.style.setProperty('--c-contrast-border', `rgba(${cR}, ${cG}, ${cB}, ${isDark ? 0.24 : 0.18})`)

  root.style.setProperty('--grad-accent', `linear-gradient(135deg, ${primary} 0%, ${contrast} 100%)`)
  root.style.setProperty('--shadow-accent', `0 8px 24px -8px rgba(${pR}, ${pG}, ${pB}, ${isDark ? 0.35 : 0.2})`)

  // Semantics
  root.style.setProperty('--c-success', '#16a34a')
  root.style.setProperty('--c-warning', '#d97706')
  root.style.setProperty('--c-danger', '#dc2626')
  root.style.setProperty('--c-info', '#2563eb')

  const metaColor = isDark ? '#12100E' : '#FAFAFA'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', metaColor)

  // Dynamic theme favicon update
  const faviconEl = document.querySelector("link[rel*='icon']")
  if (faviconEl) {
    faviconEl.setAttribute('href', isDark ? './favicon-dark.svg' : './favicon-light.svg')
  }

  // Dynamic theme icon update for desktop window / dock
  if (typeof window !== 'undefined') {
    const desktopApi = (window as unknown as { evaDesktop?: { setThemeIcon?: (t: string) => void } }).evaDesktop
    desktopApi?.setThemeIcon?.(isDark ? 'dark' : 'light')
  }

  return { isDark, primary, contrast, primaryFg, contrastFg }
}
