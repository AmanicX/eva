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
    id: 'cobalt',
    label: 'Cobalt',
    primary: '#0a84ff',
    contrast: '#38bdf8',
    description: 'Electric blue with sky highlights',
  },
  {
    id: 'amethyst',
    label: 'Amethyst',
    primary: '#a855f7',
    contrast: '#f43f5e',
    description: 'Royal violet with vivid coral',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    primary: '#10b981',
    contrast: '#06b6d4',
    description: 'Vibrant jade with arctic teal',
  },
  {
    id: 'amber',
    label: 'Amber',
    primary: '#f59e0b',
    contrast: '#ea580c',
    description: 'Golden warmth with deep ochre',
  },
  {
    id: 'crimson',
    label: 'Crimson',
    primary: '#f43f5e',
    contrast: '#fb923c',
    description: 'Velvet ruby with bright tangerine',
  },
  {
    id: 'cyan',
    label: 'Glacier',
    primary: '#06b6d4',
    contrast: '#3b82f6',
    description: 'Crisp cyan with sapphire blue',
  },
  {
    id: 'titanium',
    label: 'Titanium',
    primary: '#71717a',
    contrast: '#a1a1aa',
    description: 'Industrial slate with metallic silver',
  },
]

export const DEFAULT_THEME_PALETTES: Record<ThemeId, { paletteId: string; primary: string; contrast: string }> = {
  chatbot: {
    paletteId: 'cobalt',
    primary: '#0a84ff',
    contrast: '#38bdf8',
  },
  anime: {
    paletteId: 'amethyst',
    primary: '#a855f7',
    contrast: '#f43f5e',
  },
  world: {
    paletteId: 'emerald',
    primary: '#10b981',
    contrast: '#06b6d4',
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

export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0.5
  const { r, g, b } = rgb
  // sRGB relative luminance calculation
  const a = [r, g, b].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
}

export function getContrastForeground(hex: string): '#ffffff' | '#09090b' {
  const lum = getLuminance(hex)
  return lum > 0.45 ? '#09090b' : '#ffffff'
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

/** Derive a complementary or harmonious contrast accent when none provided */
export function deriveContrastColor(primaryHex: string): string {
  const rgb = hexToRgb(primaryHex)
  if (!rgb) return '#38bdf8'
  // Convert RGB to HSL
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

  // Shift hue by +35 degrees for an energetic analogous contrast
  let newH = (h * 360 + 35) % 360
  const newS = Math.min(1, Math.max(0.65, s))
  const newL = Math.min(0.7, Math.max(0.5, l))

  // HSL to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS
  const p = 2 * newL - q
  const rh = Math.round(hue2rgb(p, q, newH / 360 + 1 / 3) * 255)
  const gh = Math.round(hue2rgb(p, q, newH / 360) * 255)
  const bh = Math.round(hue2rgb(p, q, newH / 360 - 1 / 3) * 255)

  return `#${rh.toString(16).padStart(2, '0')}${gh.toString(16).padStart(2, '0')}${bh.toString(16).padStart(2, '0')}`
}

export interface AppliedColors {
  isDark: boolean
  primary: string
  contrast: string
  primaryFg: string
  contrastFg: string
}

export function resolveAppearanceIsDark(mode: 'dark' | 'light' | 'system'): boolean {
  if (mode === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return mode === 'dark'
}

export function applyThemeTokens(
  appearanceMode: 'dark' | 'light' | 'system',
  themeId: ThemeId,
  primaryColor: string,
  contrastColor: string,
  frostedGlass: boolean,
): AppliedColors {
  if (typeof document === 'undefined') {
    return {
      isDark: true,
      primary: primaryColor,
      contrast: contrastColor,
      primaryFg: '#ffffff',
      contrastFg: '#ffffff',
    }
  }

  const isDark = resolveAppearanceIsDark(appearanceMode)
  const root = document.documentElement

  // Set dataset attributes
  root.dataset.theme = themeId
  root.dataset.appearance = isDark ? 'dark' : 'light'
  root.dataset.frosted = frostedGlass ? 'true' : 'false'
  root.classList.toggle('dark', isDark)
  root.classList.toggle('light', !isDark)

  const primary = isValidHex(primaryColor) ? primaryColor : (DEFAULT_THEME_PALETTES[themeId]?.primary ?? '#0a84ff')
  const contrast = isValidHex(contrastColor) ? contrastColor : (DEFAULT_THEME_PALETTES[themeId]?.contrast ?? '#38bdf8')

  const primaryFg = getContrastForeground(primary)
  const contrastFg = getContrastForeground(contrast)
  const primaryRgb = hexToRgb(primary) ?? { r: 10, g: 132, b: 255 }
  const contrastRgb = hexToRgb(contrast) ?? { r: 56, g: 189, b: 248 }

  const pR = primaryRgb.r
  const pG = primaryRgb.g
  const pB = primaryRgb.b
  const cR = contrastRgb.r
  const cG = contrastRgb.g
  const cB = contrastRgb.b

  // Neutral Foundations (60-30-10 distribution)
  if (isDark) {
    // 60% Deep Obsidian / Jet-black
    root.style.setProperty('--c-bg', '#09090b')
    root.style.setProperty('--c-bg-2', '#0f0f12')
    // 30% Controlled layered surfaces
    root.style.setProperty('--c-surface', '#151518')
    root.style.setProperty('--c-surface-2', '#1c1c21')
    root.style.setProperty('--c-surface-3', '#27272f')
    root.style.setProperty('--c-surface-elevated', '#22222a')
    // Borders
    root.style.setProperty('--c-border', 'rgba(255, 255, 255, 0.08)')
    root.style.setProperty('--c-border-strong', 'rgba(255, 255, 255, 0.16)')
    root.style.setProperty('--c-sep', 'rgba(255, 255, 255, 0.06)')
    // Text
    root.style.setProperty('--c-fg', '#f4f4f6')
    root.style.setProperty('--c-muted', '#a1a1aa')
    root.style.setProperty('--c-faint', '#71717a')
    // Chat bubbles
    root.style.setProperty('--c-bubble-user', primary)
    root.style.setProperty('--c-bubble-user-fg', primaryFg)
    root.style.setProperty('--c-bubble-bot', '#18181d')
    root.style.setProperty('--c-bubble-bot-fg', '#f4f4f6')
    // Frosted glass
    if (frostedGlass) {
      root.style.setProperty('--c-glass', 'rgba(15, 15, 18, 0.78)')
      root.style.setProperty('--c-glass-surface', 'rgba(21, 21, 25, 0.72)')
      root.style.setProperty('--glass-blur', '16px')
    } else {
      root.style.setProperty('--c-glass', '#0f0f12')
      root.style.setProperty('--c-glass-surface', '#151518')
      root.style.setProperty('--glass-blur', '0px')
    }
  } else {
    // 60% Sophisticated Soft White / Paper
    root.style.setProperty('--c-bg', '#f8f9fa')
    root.style.setProperty('--c-bg-2', '#ffffff')
    // 30% Controlled layered surfaces
    root.style.setProperty('--c-surface', '#ffffff')
    root.style.setProperty('--c-surface-2', '#f1f3f5')
    root.style.setProperty('--c-surface-3', '#e9ecef')
    root.style.setProperty('--c-surface-elevated', '#ffffff')
    // Borders
    root.style.setProperty('--c-border', 'rgba(0, 0, 0, 0.08)')
    root.style.setProperty('--c-border-strong', 'rgba(0, 0, 0, 0.16)')
    root.style.setProperty('--c-sep', 'rgba(0, 0, 0, 0.06)')
    // Text
    root.style.setProperty('--c-fg', '#18181b')
    root.style.setProperty('--c-muted', '#52525b')
    root.style.setProperty('--c-faint', '#8c8c96')
    // Chat bubbles
    root.style.setProperty('--c-bubble-user', primary)
    root.style.setProperty('--c-bubble-user-fg', primaryFg)
    root.style.setProperty('--c-bubble-bot', '#f1f3f5')
    root.style.setProperty('--c-bubble-bot-fg', '#18181b')
    // Frosted glass
    if (frostedGlass) {
      root.style.setProperty('--c-glass', 'rgba(255, 255, 255, 0.82)')
      root.style.setProperty('--c-glass-surface', 'rgba(248, 249, 250, 0.78)')
      root.style.setProperty('--glass-blur', '16px')
    } else {
      root.style.setProperty('--c-glass', '#ffffff')
      root.style.setProperty('--c-glass-surface', '#f8f9fa')
      root.style.setProperty('--glass-blur', '0px')
    }
  }

  // 10% Accent Palette & Contrast Palette
  root.style.setProperty('--c-accent', primary)
  root.style.setProperty('--c-accent-contrast', contrast)
  root.style.setProperty('--c-accent-fg', primaryFg)
  root.style.setProperty('--c-accent-contrast-fg', contrastFg)
  root.style.setProperty('--c-accent-hover', isDark ? adjustBrightness(primary, 8) : adjustBrightness(primary, -8))
  root.style.setProperty('--c-accent-active', isDark ? adjustBrightness(primary, -12) : adjustBrightness(primary, 12))
  root.style.setProperty('--c-accent-surface', `rgba(${pR}, ${pG}, ${pB}, ${isDark ? 0.12 : 0.08})`)
  root.style.setProperty('--c-accent-surface-hover', `rgba(${pR}, ${pG}, ${pB}, ${isDark ? 0.18 : 0.14})`)
  root.style.setProperty('--c-accent-border', `rgba(${pR}, ${pG}, ${pB}, ${isDark ? 0.28 : 0.24})`)
  root.style.setProperty('--c-accent-ring', `rgba(${pR}, ${pG}, ${pB}, 0.35)`)

  root.style.setProperty('--c-contrast-surface', `rgba(${cR}, ${cG}, ${cB}, ${isDark ? 0.12 : 0.08})`)
  root.style.setProperty('--c-contrast-border', `rgba(${cR}, ${cG}, ${cB}, ${isDark ? 0.28 : 0.24})`)

  root.style.setProperty('--grad-accent', `linear-gradient(135deg, ${primary} 0%, ${contrast} 100%)`)
  root.style.setProperty('--shadow-accent', `0 8px 24px -8px rgba(${pR}, ${pG}, ${pB}, ${isDark ? 0.45 : 0.3})`)

  // Semantics
  root.style.setProperty('--c-success', '#30d158')
  root.style.setProperty('--c-warning', '#ff9f0a')
  root.style.setProperty('--c-danger', '#ff453a')
  root.style.setProperty('--c-info', '#0a84ff')

  // Mobile status bar meta
  const metaColor = isDark ? '#09090b' : '#f8f9fa'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', metaColor)

  return { isDark, primary, contrast, primaryFg, contrastFg }
}
