import { useEffect, useState } from 'react'
import { Minus, Search, Square, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { THEMES } from '@/data/themes'
import appIcon from '@/assets/icon.png'

declare global {
  interface Window {
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
  const [isDesktop] = useState(() => typeof window !== 'undefined' && !!window.nexusDesktop?.isElectron)
  const [isMax, setIsMax] = useState(false)
  const theme = useStore((s) => s.settings.theme)
  const setUI = useStore((s) => s.setUI)
  const meta = THEMES[theme]

  useEffect(() => {
    if (window.nexusDesktop?.isMaximized) {
      window.nexusDesktop.isMaximized().then(setIsMax)
    }
  }, [])

  const handleMinimize = () => window.nexusDesktop?.minimize()
  const handleMaximize = async () => {
    window.nexusDesktop?.maximize()
    if (window.nexusDesktop?.isMaximized) {
      const state = await window.nexusDesktop.isMaximized()
      setIsMax(state)
    }
  }
  const handleClose = () => window.nexusDesktop?.close()

  return (
    <header
      className="titlebar-drag relative z-50 flex h-8.5 w-full select-none items-center justify-between border-b border-border/60 material px-3 text-xs text-muted"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Brand Identity */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <img
          src={appIcon}
          alt="Nexus"
          className="size-4.5 rounded-md object-cover ring-1 ring-border/80 shadow-xs"
        />
        <span className="font-display text-2xs font-semibold tracking-tight text-fg">
          Nexus
        </span>
        <span className="text-3xs text-faint font-medium">·</span>
        <span className="text-3xs text-faint font-medium">{meta.name}</span>
      </div>

      {/* Center: Quick Command / Search Widget */}
      <div className="flex flex-1 items-center justify-center px-4">
        <button
          onClick={() => setUI({ commandPaletteOpen: true })}
          className="flex items-center gap-2 rounded-lg border border-border/80 bg-surface/70 px-3 py-0.5 text-2xs text-muted hover:border-accent/40 hover:bg-surface hover:text-fg transition shadow-xs"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="Open Command Palette (Ctrl+K / Cmd+K)"
        >
          <Search size={11} className="text-faint shrink-0" />
          <span className="hidden sm:inline font-sans text-3xs">Search chats, models & commands…</span>
          <span className="sm:hidden font-sans text-3xs">Search…</span>
          <kbd className="font-mono text-3xs font-semibold bg-surface-3 border border-border rounded px-1.5 py-0.2 text-faint">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: Window Controls for Desktop */}
      {isDesktop && (
        <div
          className="flex h-full items-center"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleMinimize}
            className="flex h-full w-10 items-center justify-center text-muted hover:bg-surface-2 hover:text-fg transition-colors"
            title="Minimize"
            aria-label="Minimize"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={handleMaximize}
            className="flex h-full w-10 items-center justify-center text-muted hover:bg-surface-2 hover:text-fg transition-colors"
            title={isMax ? 'Restore' : 'Maximize'}
            aria-label="Maximize"
          >
            <Square size={11} className={isMax ? 'stroke-[2.5]' : ''} />
          </button>
          <button
            onClick={handleClose}
            className="flex h-full w-10 items-center justify-center text-muted hover:bg-danger hover:text-white transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </header>
  )
}
