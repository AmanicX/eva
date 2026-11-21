import { useEffect, useState } from 'react'
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
import { THEMES } from '@/data/themes'
import { AppLogo } from '@/components/AppLogo'
import { isAndroidPlatform, isDesktopPlatform } from '@/lib/platform'
import { cn } from '@/lib/utils'

function App() {
  const settings = useStore((s) => s.settings)
  const conversation = useStore((s) =>
    s.conversations.find((c) => c.id === s.activeConversationId),
  )
  const setUI = useStore((s) => s.setUI)
  const [showCommands, setShowCommands] = useState(false)
  const isAndroid = isAndroidPlatform()
  const isDesktop = isDesktopPlatform()

  // Synchronize platform & frosted state on root elements
  useEffect(() => {
    const platform = isAndroid ? 'android' : isDesktop ? 'desktop' : 'web'
    document.documentElement.dataset.platform = platform
    document.body.dataset.platform = platform
    document.documentElement.dataset.frosted = String(settings.frostedGlass)
    document.body.dataset.frosted = String(settings.frostedGlass)
  }, [isAndroid, isDesktop, settings.frostedGlass])

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

  return (
    <div className="app-bg relative flex h-full w-full flex-col overflow-hidden text-fg">
      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden">
        {!isAndroid && <TitleBar />}

        <div className="flex min-h-0 flex-1 w-full overflow-hidden">
          <Sidebar />

          <main className="flex min-w-0 flex-1 flex-col">
            {conversation ? (
              <ChatView onShowCommands={() => setShowCommands(true)} />
            ) : (
              <div className="flex h-full min-w-0 flex-1 flex-col material-workspace">
                <header
                  className={cn(
                    'hairline material-header pad-top flex items-center px-3 py-2.5 lg:hidden',
                    isAndroid ? 'gap-2.5' : 'justify-between',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      onClick={() => setUI({ sidebarOpen: true })}
                      className="btn btn-ghost grid size-10 place-items-center rounded-xl p-0 shrink-0"
                      aria-label="Open sidebar"
                    >
                      <Menu size={18} />
                    </button>
                    <AppLogo className="size-7 rounded-lg ring-1 ring-border/80 shadow-xs shrink-0" />
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-display text-sm font-semibold tracking-tight text-fg">
                        Eva
                      </span>
                      {isAndroid && (
                        <>
                          <span className="text-3xs text-faint">·</span>
                          <span className="text-2xs text-muted font-medium truncate">
                            {THEMES[settings.theme]?.name ?? 'Chatbot'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {!isAndroid && (
                    <button
                      onClick={() => setUI({ commandPaletteOpen: true })}
                      className="btn btn-ghost flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-muted shrink-0"
                      aria-label="Open command palette"
                    >
                      <Command size={14} />
                      <span className="text-2xs">Commands</span>
                    </button>
                  )}
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
