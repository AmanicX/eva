import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Cpu,
  Globe2,
  KeyRound,
  MessageSquare,
  Moon,
  Palette,
  Plus,
  Search,
  Sparkles,
  Sun,
  Terminal,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { CURATED_PALETTES, applyThemeTokens } from '@/data/palettes'
import { PROVIDER_PRESETS } from '@/lib/groq'
import { cn } from '@/lib/utils'
import appIcon from '@/assets/icon.png'

interface CommandItem {
  id: string
  category: 'Modes' | 'Actions' | 'Appearance' | 'Providers' | 'Conversations' | 'Settings'
  title: string
  subtitle?: string
  icon: React.ReactNode
  shortcut?: string
  action: () => void
}

export function CommandPalette() {
  const ui = useStore((s) => s.ui)
  const setUI = useStore((s) => s.setUI)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const setTheme = useStore((s) => s.setTheme)
  const conversations = useStore((s) => s.conversations)
  const characters = useStore((s) => s.characters)
  const worlds = useStore((s) => s.worlds)
  const setActiveConversation = useStore((s) => s.setActiveConversation)

  const open = ui.commandPaletteOpen
  const [query, setQuery] = useState('')
  const [prevQuery, setPrevQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset selected index when query changes
  if (query !== prevQuery) {
    setPrevQuery(query)
    setSelectedIndex(0)
  }

  const close = useCallback(() => {
    setUI({ commandPaletteOpen: false })
    setQuery('')
  }, [setUI])

  // Build command catalog
  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = []

    // 1. Modes
    list.push({
      id: 'mode-chatbot',
      category: 'Modes',
      title: 'Switch to Chatbot Mode',
      subtitle: 'Free-form conversational AI sandbox',
      icon: <MessageSquare size={16} className="text-accent" />,
      action: () => {
        setTheme('chatbot')
        close()
      },
    })
    list.push({
      id: 'mode-anime',
      category: 'Modes',
      title: 'Switch to Anime Mode',
      subtitle: 'Canon characters & editorial storytelling',
      icon: <Sparkles size={16} className="text-accent" />,
      action: () => {
        setTheme('anime')
        close()
      },
    })
    list.push({
      id: 'mode-world',
      category: 'Modes',
      title: 'Switch to World Mode',
      subtitle: 'Living simulation, factions & reputation',
      icon: <Globe2 size={16} className="text-accent" />,
      action: () => {
        setTheme('world')
        close()
      },
    })

    // 2. Actions
    list.push({
      id: 'action-new-character',
      category: 'Actions',
      title: 'Create New Character',
      subtitle: 'Design persona, traits, greeting & tags',
      icon: <Plus size={16} />,
      shortcut: 'N',
      action: () => {
        close()
        setUI({ characterModal: { tab: 'create' } })
      },
    })

    if (settings.theme === 'world' || worlds.length > 0) {
      list.push({
        id: 'action-new-world',
        category: 'Actions',
        title: 'Create New World',
        subtitle: 'Build a new setting with lore and factions',
        icon: <Globe2 size={16} />,
        action: () => {
          close()
          setUI({ worldModal: { tab: 'world' } })
        },
      })
    }

    list.push({
      id: 'action-browse-characters',
      category: 'Actions',
      title: 'Browse Characters & Cast',
      subtitle: 'View saved personas and anime cast presets',
      icon: <Users size={16} />,
      action: () => {
        close()
        if (settings.theme === 'world') {
          setUI({ worldModal: { tab: 'cast' } })
        } else {
          setUI({ characterModal: { tab: 'browse' } })
        }
      },
    })

    // 3. Appearance
    const isSystem = settings.appearanceMode === 'system'
    const systemIsDark =
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    const resolvedDark = isSystem ? systemIsDark : settings.appearanceMode === 'dark'

    list.push({
      id: 'app-mode-toggle',
      category: 'Appearance',
      title: `Switch to ${resolvedDark ? 'Light' : 'Dark'} Appearance`,
      subtitle: isSystem
        ? `Currently following System (${resolvedDark ? 'Dark' : 'Light'})`
        : `Currently using ${settings.appearanceMode} mode`,
      icon: resolvedDark ? <Sun size={16} /> : <Moon size={16} />,
      action: () => {
        const nextMode = resolvedDark ? 'light' : 'dark'
        updateSettings({ appearanceMode: nextMode })
        applyThemeTokens(
          nextMode,
          settings.theme,
          settings.customAccentColor,
          settings.customContrastColor,
          settings.frostedGlass,
        )
      },
    })

    if (!isSystem) {
      list.push({
        id: 'app-mode-system',
        category: 'Appearance',
        title: 'Follow System Appearance',
        subtitle: `Match OS default (currently ${systemIsDark ? 'Dark' : 'Light'})`,
        icon: <Zap size={16} />,
        action: () => {
          updateSettings({ appearanceMode: 'system' })
          applyThemeTokens(
            'system',
            settings.theme,
            settings.customAccentColor,
            settings.customContrastColor,
            settings.frostedGlass,
          )
        },
      })
    }

    list.push({
      id: 'app-frosted-toggle',
      category: 'Appearance',
      title: `${settings.frostedGlass ? 'Disable' : 'Enable'} Frosted Glass`,
      subtitle: settings.frostedGlass
        ? 'Switch to solid opaque surfaces'
        : 'Enable subtle background blur and depth',
      icon: <Zap size={16} />,
      action: () => {
        const next = !settings.frostedGlass
        updateSettings({ frostedGlass: next })
        applyThemeTokens(
          settings.appearanceMode,
          settings.theme,
          settings.customAccentColor,
          settings.customContrastColor,
          next,
        )
      },
    })

    // Accent palettes
    for (const p of CURATED_PALETTES) {
      list.push({
        id: `palette-${p.id}`,
        category: 'Appearance',
        title: `Accent: ${p.label}`,
        subtitle: p.description,
        icon: (
          <span
            className="size-3.5 rounded-full border border-white/20 shadow-sm"
            style={{ backgroundColor: p.primary }}
          />
        ),
        action: () => {
          const nextAccents = {
            ...settings.themeAccents,
            [settings.theme]: { paletteId: p.id, primary: p.primary, contrast: p.contrast },
          }
          updateSettings({
            accentPalette: p.id,
            customAccentColor: p.primary,
            customContrastColor: p.contrast,
            themeAccents: nextAccents,
          })
          applyThemeTokens(
            settings.appearanceMode,
            settings.theme,
            p.primary,
            p.contrast,
            settings.frostedGlass,
          )
        },
      })
    }

    // 4. Providers
    for (const p of PROVIDER_PRESETS) {
      list.push({
        id: `provider-${p.id}`,
        category: 'Providers',
        title: `Provider: ${p.label}`,
        subtitle: p.baseUrl,
        icon: <Cpu size={16} />,
        action: () => {
          updateSettings({ baseUrl: p.baseUrl })
          close()
          setUI({ settingsOpen: true, settingsTab: 'connection' })
        },
      })
    }

    // 5. Settings navigation
    list.push({
      id: 'nav-appearance',
      category: 'Settings',
      title: 'Appearance Settings',
      subtitle: 'Customize theme colors, contrast, and glass effects',
      icon: <Palette size={16} />,
      action: () => {
        close()
        setUI({ settingsOpen: true, settingsTab: 'appearance' })
      },
    })
    list.push({
      id: 'nav-connection',
      category: 'Settings',
      title: 'Connection & Models',
      subtitle: 'Configure API keys, Ollama Cloud, and model parameters',
      icon: <KeyRound size={16} />,
      action: () => {
        close()
        setUI({ settingsOpen: true, settingsTab: 'connection' })
      },
    })
    list.push({
      id: 'nav-persona',
      category: 'Settings',
      title: 'Universal System Prompt & Persona',
      subtitle: 'Define your user identity and system rules',
      icon: <User size={16} />,
      action: () => {
        close()
        setUI({ settingsOpen: true, settingsTab: 'persona' })
      },
    })
    list.push({
      id: 'nav-commands',
      category: 'Settings',
      title: 'Command Syntax Cheatsheet',
      subtitle: 'Learn (thoughts), "actions", <god>, [world]',
      icon: <Terminal size={16} />,
      action: () => {
        close()
        setUI({ settingsOpen: true, settingsTab: 'commands' })
      },
    })

    // 6. Recent conversations matching search
    const q = query.trim().toLowerCase()
    if (q) {
      for (const conv of conversations) {
        const char = characters.find((c) => c.id === conv.characterId)
        const matches =
          conv.title.toLowerCase().includes(q) ||
          (char && char.name.toLowerCase().includes(q)) ||
          conv.messages.some((m) => m.content.toLowerCase().includes(q))
        if (matches) {
          list.push({
            id: `conv-${conv.id}`,
            category: 'Conversations',
            title: char?.name ?? conv.title,
            subtitle: `${conv.theme.toUpperCase()} · ${conv.title}`,
            icon: <MessageSquare size={16} className="text-accent" />,
            action: () => {
              if (conv.theme !== settings.theme) {
                setTheme(conv.theme)
              }
              setActiveConversation(conv.id)
              close()
            },
          })
        }
      }
    }

    return list
  }, [
    settings,
    conversations,
    characters,
    worlds,
    query,
    updateSettings,
    setTheme,
    setActiveConversation,
    setUI,
    close,
  ])

  // Filter items based on query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q),
    )
  }, [commands, query])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Keyboard navigation
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = filtered[selectedIndex]
      if (target) target.action()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-12 sm:p-6 sm:pt-20">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={close}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="modal-glass relative z-10 flex max-h-[80dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/80 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search Input bar */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          <Search size={18} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command or search conversations…"
            className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="text-faint hover:text-fg p-1 rounded-md"
              aria-label="Clear query"
            >
              <X size={15} />
            </button>
          ) : (
            <span className="hidden sm:inline-block rounded border border-border bg-surface-3 px-1.5 py-0.5 text-2xs text-faint font-mono">
              ESC
            </span>
          )}
        </div>

        {/* Command list */}
        <div ref={listRef} className="scroll-thin flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              No matching commands or conversations found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const active = idx === selectedIndex
              return (
                <button
                  key={item.id}
                  data-index={idx}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition',
                    active
                      ? 'bg-accent/15 text-fg font-medium'
                      : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg border border-border',
                      active
                        ? 'bg-accent/20 text-accent border-accent/40'
                        : 'bg-surface-2 text-muted',
                    )}
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-fg">{item.title}</span>
                      <span className="rounded bg-surface-3 px-1.5 py-0.2 text-2xs text-faint">
                        {item.category}
                      </span>
                    </div>
                    {item.subtitle && (
                      <p className="truncate text-2xs text-faint mt-0.5">{item.subtitle}</p>
                    )}
                  </div>
                  {item.shortcut && (
                    <span className="ml-auto font-mono text-2xs text-faint bg-surface-3 px-1.5 py-0.5 rounded border border-border">
                      {item.shortcut}
                    </span>
                  )}
                  {active && <Check size={14} className="text-accent shrink-0 ml-1" />}
                </button>
              )
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="border-t border-border/80 material px-4 py-2 flex items-center justify-between text-2xs text-faint">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-surface-3 px-1 py-0.5 rounded border border-border">↑</kbd>{' '}
              <kbd className="font-mono bg-surface-3 px-1 py-0.5 rounded border border-border">↓</kbd>{' '}
              to navigate
            </span>
            <span>
              <kbd className="font-mono bg-surface-3 px-1.5 py-0.5 rounded border border-border">
                ↵
              </kbd>{' '}
              to select
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <img src={appIcon} alt="" className="size-3.5 rounded object-cover ring-1 ring-border/80" />
            <span>Nexus Command Palette</span>
          </div>
        </div>
      </div>
    </div>
  )
}
