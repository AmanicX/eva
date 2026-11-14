import { useEffect, useMemo, useState } from 'react'
import { Command, Menu, Terminal } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Sidebar } from '@/components/Sidebar'
import { ChatView } from '@/components/ChatView'
import { EmptyState } from '@/components/EmptyState'
import { SettingsModal } from '@/components/SettingsModal'
import { CharacterModal } from '@/components/CharacterModal'
import { WorldModal } from '@/components/WorldModal'
import { CommandCheatsheet } from '@/components/CommandCheatsheet'
import { CommandPalette } from '@/components/CommandPalette'
import { TitleBar } from '@/components/TitleBar'
import { Welcome } from '@/components/Welcome'
import { Modal } from '@/components/Modal'
import { applyThemeTokens } from '@/data/palettes'
import { WALLPAPER_PRESETS } from '@/data/wallpapers'
import appIcon from '@/assets/icon.png'

function App() {
  const settings = useStore((s) => s.settings)
  const conversation = useStore((s) =>
    s.conversations.find((c) => c.id === s.activeConversationId),
  )
  const setUI = useStore((s) => s.setUI)
  const [showCommands, setShowCommands] = useState(false)

  // Apply theme tokens immediately and on preference updates
  useEffect(() => {
    applyThemeTokens(
      settings.appearanceMode,
      settings.theme,
      settings.customAccentColor,
      settings.customContrastColor,
      settings.frostedGlass,
    )
  }, [
    settings.appearanceMode,
    settings.theme,
    settings.customAccentColor,
    settings.customContrastColor,
    settings.frostedGlass,
  ])

  // System appearance media query listener
  useEffect(() => {
    if (settings.appearanceMode !== 'system' || typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      applyThemeTokens(
        'system',
        settings.theme,
        settings.customAccentColor,
        settings.customContrastColor,
        settings.frostedGlass,
      )
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [
    settings.appearanceMode,
    settings.theme,
    settings.customAccentColor,
    settings.customContrastColor,
    settings.frostedGlass,
  ])

  // Global keyboard shortcut: Ctrl+K / Cmd+K for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setUI({ commandPaletteOpen: !useStore.getState().ui.commandPaletteOpen })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setUI])

  const currentWallpaper = useMemo(() => {
    if (!settings.frostedGlass || settings.wallpaper === 'none') return null
    if (settings.wallpaper === 'custom' && settings.customWallpaperUrl) {
      return settings.customWallpaperUrl
    }
    const preset = WALLPAPER_PRESETS.find((w) => w.id === settings.wallpaper)
    return preset?.url || WALLPAPER_PRESETS[0].url
  }, [settings.frostedGlass, settings.wallpaper, settings.customWallpaperUrl])

  return (
    <div className="app-bg relative flex h-full w-full flex-col overflow-hidden text-fg">
      {/* Real Atmospheric Wallpaper Layer behind translucent panels */}
      {currentWallpaper && (
        <div
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          aria-hidden="true"
        >
          <img
            src={currentWallpaper}
            alt=""
            className="h-full w-full object-cover transition-opacity duration-500"
          />
          {/* Dark smoky translucent overlay so text remains 100% legible */}
          <div
            className="absolute inset-0 bg-bg transition-opacity duration-300"
            style={{ opacity: settings.wallpaperDarkness ?? 0.55 }}
          />
        </div>
      )}

      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden">
        <TitleBar />

        <div className="flex min-h-0 flex-1 w-full overflow-hidden">
          <Sidebar />

          <main className="flex min-w-0 flex-1 flex-col">
            {conversation ? (
              <ChatView onShowCommands={() => setShowCommands(true)} />
            ) : (
              <div className="flex h-full min-w-0 flex-1 flex-col">
                <header className="hairline material-header pad-top flex items-center justify-between px-3 py-2.5 lg:hidden">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUI({ sidebarOpen: true })}
                      className="btn btn-ghost grid size-10 place-items-center rounded-xl p-0"
                      aria-label="Open sidebar"
                    >
                      <Menu size={18} />
                    </button>
                    <img
                      src={appIcon}
                      alt="Nexus"
                      className="size-6.5 rounded-lg object-cover ring-1 ring-border/80"
                    />
                    <span className="font-display text-body font-semibold">Nexus</span>
                  </div>
                  <button
                    onClick={() => setUI({ commandPaletteOpen: true })}
                    className="btn btn-ghost flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-muted"
                    aria-label="Open command palette"
                  >
                    <Command size={14} />
                    <span className="text-2xs">Commands</span>
                  </button>
                </header>
                <EmptyState />
              </div>
            )}
          </main>
        </div>
      </div>

      <SettingsModal />
      <CharacterModal />
      <WorldModal />
      <Welcome />
      <CommandPalette />

      <Modal
        open={showCommands}
        onClose={() => setShowCommands(false)}
        title="Command syntax"
        subtitle="Write richer scenes with these. They work in every theme."
        icon={<Terminal size={18} />}
        size="md"
      >
        <CommandCheatsheet />
      </Modal>
    </div>
  )
}

export default App
