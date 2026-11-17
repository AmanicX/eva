import { useEffect, useState } from 'react'
import {
  Globe2,
  MessageSquare,
  Minus,
  Moon,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Square,
  Sun,
  X,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { THEMES } from '@/data/themes'
import { AppLogo } from './AppLogo'
import { isAndroidPlatform } from '@/lib/platform'

declare global {
  interface Window {
    evaDesktop?: {
      isElectron: boolean
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
    }
    nexusDesktop?: {
      isElectron: boolean
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
    }
  }
}

export function TitleBar() {
  const isAndroid = isAndroidPlatform()
  const getDesktop = () =>
    typeof window !== 'undefined' ? window.evaDesktop || window.nexusDesktop : undefined
  const [isDesktop] = useState(() => !!getDesktop()?.isElectron)
  const [isMax, setIsMax] = useState(false)
  const theme = useStore((s) => s.settings.theme)
  const appearanceMode = useStore((s) => s.settings.appearanceMode)
  const updateSettings = useStore((s) => s.updateSettings)
  const setUI = useStore((s) => s.setUI)
  const meta = THEMES[theme]

  const isSystem = appearanceMode === 'system'
  const systemIsLight =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
  const isLight = isSystem ? systemIsLight : appearanceMode === 'light'

  const toggleAppearance = () => {
    // Cycle between dark -> light -> system
    const next = appearanceMode === 'dark' ? 'light' : appearanceMode === 'light' ? 'system' : 'dark'
    updateSettings({ appearanceMode: next })
  }

  useEffect(() => {
    const d = getDesktop()
    if (d?.isMaximized) {
      d.isMaximized().then(setIsMax)
    }
  }, [])

  if (isAndroid) return null

  const handleMinimize = () => getDesktop()?.minimize()
  const handleMaximize = async () => {
    const d = getDesktop()
    d?.maximize()
    if (d?.isMaximized) {
      const state = await d.isMaximized()
      setIsMax(state)
    }
  }
  const handleClose = () => getDesktop()?.close()

  return (
    <header
      className="titlebar-drag relative z-50 flex h-9 w-full select-none items-center justify-between border-b border-border/70 material-header px-3 text-xs text-muted"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Brand Identity */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <AppLogo className="size-5 rounded-md ring-1 ring-border/80 shadow-xs" />
        <span className="font-display text-2xs font-semibold tracking-tight text-fg">
          Eva
        </span>
        <span className="text-3xs text-faint">·</span>
        <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-3xs font-medium text-muted border border-border">
          {theme === 'chatbot' ? (
            <MessageSquare size={10} className="text-accent" />
          ) : theme === 'anime' ? (
            <Sparkles size={10} className="text-accent" />
          ) : (
            <Globe2 size={10} className="text-accent" />
          )}
          <span>{meta.name}</span>
        </span>
      </div>

      {/* Center: Quick Command / Search Widget */}
      <div className="flex flex-1 items-center justify-center px-4">
        <button
          onClick={() => setUI({ commandPaletteOpen: true })}
          className="group flex items-center gap-2 rounded-xl border border-border/80 bg-surface/70 px-3.5 py-1 text-2xs text-muted hover:border-accent/60 hover:bg-surface hover:text-fg hover:shadow-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent transition-all duration-200"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="Open Command Palette (Ctrl+K / Cmd+K)"
        >
          <Search size={12} className="text-faint group-hover:text-accent shrink-0 transition-colors duration-200" />
          <span className="hidden sm:inline font-sans text-3xs">Search chats, models & commands…</span>
          <span className="sm:hidden font-sans text-3xs">Search…</span>
          <kbd className="font-mono text-3xs font-semibold bg-surface-3/80 border border-border/80 rounded px-1.5 py-0.2 text-faint group-hover:text-muted transition-colors">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right Controls: Theme Switcher & Actions */}
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Quick Appearance Toggle */}
        <button
          onClick={toggleAppearance}
          className="grid size-7.5 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg transition"
          title={`Appearance: ${appearanceMode.toUpperCase()} (click to change)`}
          aria-label={`Toggle appearance mode, current: ${appearanceMode}`}
        >
          {isLight ? (
            <Sun size={14} className="text-accent transition-transform hover:rotate-45" />
          ) : (
            <Moon size={14} className="text-accent transition-transform hover:-rotate-12" />
          )}
        </button>

        {!isDesktop && (
          <button
            onClick={() => setUI({ settingsOpen: true })}
            className="grid size-7.5 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg transition"
            title="Settings"
            aria-label="Settings"
          >
            <SettingsIcon size={14} />
          </button>
        )}

        {/* Window Controls for Desktop */}
        {isDesktop && (
          <div className="flex h-full items-center ml-1">
            <button
              onClick={handleMinimize}
              className="flex h-full w-9 items-center justify-center text-muted hover:bg-surface-2 hover:text-fg transition-colors"
              title="Minimize"
              aria-label="Minimize"
            >
              <Minus size={13} />
            </button>
            <button
              onClick={handleMaximize}
              className="flex h-full w-9 items-center justify-center text-muted hover:bg-surface-2 hover:text-fg transition-colors"
              title={isMax ? 'Restore' : 'Maximize'}
              aria-label="Maximize"
            >
              <Square size={11} className={isMax ? 'stroke-[2.5]' : ''} />
            </button>
            <button
              onClick={handleClose}
              className="flex h-full w-9 items-center justify-center text-muted hover:bg-danger hover:text-white transition-colors"
              title="Close"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
