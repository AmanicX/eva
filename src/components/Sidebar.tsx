import { useMemo, useState } from 'react'
import {
  Plus,
  Search,
  Settings as SettingsIcon,
  Pin,
  Trash2,
  MessageSquarePlus,
  Globe2,
  Check,
  Compass,
  X,
  Info,
  Command,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { THEMES } from '@/data/themes'
import { providerNeedsKey } from '@/lib/groq'
import { Avatar } from './Avatar'
import { ThemeSwitcher } from './ThemeSwitcher'
import { cn, timeAgo } from '@/lib/utils'

export function Sidebar() {
  const theme = useStore((s) => s.settings.theme)
  const conversations = useStore((s) => s.conversations)
  const characters = useStore((s) => s.characters)
  const worlds = useStore((s) => s.worlds)
  const activeWorldId = useStore((s) => s.activeWorldId)
  const activeConversationId = useStore((s) => s.activeConversationId)
  const sidebarOpen = useStore((s) => s.ui.sidebarOpen)
  const apiKey = useStore((s) => s.settings.apiKey)
  const baseUrl = useStore((s) => s.settings.baseUrl)
  const setUI = useStore((s) => s.setUI)
  const setActiveConversation = useStore((s) => s.setActiveConversation)
  const deleteConversation = useStore((s) => s.deleteConversation)
  const togglePin = useStore((s) => s.togglePin)
  const setActiveWorld = useStore((s) => s.setActiveWorld)

  const [query, setQuery] = useState('')
  const [onlyPinned, setOnlyPinned] = useState(false)
  const [worldPicker, setWorldPicker] = useState(false)
  const ready = apiKey.trim() !== '' || !providerNeedsKey(baseUrl)

  const activeWorld = worlds.find((w) => w.id === activeWorldId)
  const meta = THEMES[theme]

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations
      .filter((c) => c.theme === theme)
      .filter((c) => (theme === 'world' && activeWorldId ? c.worldId === activeWorldId : true))
      .filter((c) => (onlyPinned ? c.pinned : true))
      .filter((c) => {
        if (!q) return true
        const char = characters.find((ch) => ch.id === c.characterId)
        return (
          c.title.toLowerCase().includes(q) ||
          (char?.name.toLowerCase().includes(q) ?? false)
        )
      })
      .sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
        return b.updatedAt - a.updatedAt
      })
  }, [conversations, theme, activeWorldId, query, onlyPinned, characters])

  const openAdd = () => {
    if (theme === 'world') {
      setUI({ worldModal: { tab: worlds.length ? 'cast' : 'world' } })
    } else {
      setUI({ characterModal: { tab: 'create' } })
    }
  }

  return (
    <>
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setUI({ sidebarOpen: false })}
          aria-label="Close sidebar"
        />
      )}
      <aside
        className={cn(
          'safe-left fixed inset-y-0 left-0 z-40 flex w-[86%] max-w-xs flex-col border-r border-border bg-bg-2 transition-transform duration-250 lg:static lg:z-auto lg:w-72 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand & Command Palette Trigger */}
        <div className="pad-top flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-accent-grad text-accent-fg shadow-md">
              <span className="font-display text-sm font-bold">N</span>
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-sm leading-none font-bold tracking-tight text-fg">
                Nexus
              </h1>
              <p className="mt-0.5 truncate text-2xs text-faint">{meta.name} Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setUI({ commandPaletteOpen: true })}
              className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-2xs text-muted hover:bg-surface-2 hover:text-fg transition"
              title="Command Palette (Ctrl+K / Cmd+K)"
              aria-label="Open command palette"
            >
              <Command size={12} />
              <span className="font-mono text-2xs font-semibold">K</span>
            </button>
            <button
              className="btn btn-ghost grid size-8 place-items-center rounded-lg p-0 lg:hidden text-faint"
              onClick={() => setUI({ sidebarOpen: false })}
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Theme mode switcher */}
        <div className="px-3">
          <ThemeSwitcher />
        </div>

        {/* World selector + Create button */}
        <div className="mt-3 flex items-center gap-2 px-3">
          <button
            onClick={openAdd}
            className="btn btn-accent flex-1 rounded-xl py-2 text-xs"
          >
            <Plus size={15} />
            {theme === 'world' ? 'Create world' : 'New character'}
          </button>
          {theme === 'world' && (
            <div className="relative">
              <button
                onClick={() => setWorldPicker((v) => !v)}
                className="btn size-9 rounded-xl p-0"
                title="Switch world"
                aria-label="Switch world"
              >
                <Globe2 size={15} />
              </button>
              {worldPicker && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setWorldPicker(false)} />
                  <div className="panel anim-pop absolute left-0 z-30 mt-1.5 w-60 rounded-xl p-1.5 shadow-2xl">
                    <div className="px-2.5 py-1.5 text-2xs font-semibold tracking-wide text-faint uppercase">
                      Your worlds
                    </div>
                    {worlds.length === 0 && (
                      <p className="px-2.5 py-2 text-xs text-faint">No worlds created yet.</p>
                    )}
                    {worlds.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => {
                          setActiveWorld(w.id)
                          setWorldPicker(false)
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-surface-2 transition"
                      >
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ background: w.color }}
                        />
                        <span className="truncate">{w.name}</span>
                        {w.id === activeWorldId && (
                          <Check size={14} className="ml-auto text-accent shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {theme === 'world' && activeWorld && (
          <div className="mt-2 px-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5">
              <Globe2 size={13} className="text-accent shrink-0" />
              <span className="truncate text-xs font-medium text-fg">{activeWorld.name}</span>
              <span className="ml-auto text-2xs text-faint truncate">
                {activeWorld.genre}
              </span>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="mt-3 flex items-center gap-1.5 px-3">
          <div className="relative flex-1">
            <Search
              size={13}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations…"
              className="field py-1 pl-8 text-xs h-8"
            />
          </div>
          <button
            onClick={() => setOnlyPinned((v) => !v)}
            className={cn(
              'btn size-8 shrink-0 rounded-lg p-0 text-muted transition',
              onlyPinned && 'btn-accent text-accent-fg',
            )}
            title={onlyPinned ? 'Showing pinned only' : 'Filter pinned'}
            aria-label="Filter pinned"
          >
            <Pin size={13} />
          </button>
        </div>

        {/* Conversation List */}
        <div className="scroll-thin mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {items.length === 0 && (
            <div className="mt-8 flex flex-col items-center gap-2 px-4 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-faint border border-border">
                <MessageSquarePlus size={16} />
              </span>
              <p className="text-xs text-muted leading-relaxed">
                {theme === 'world' && !activeWorld
                  ? 'Create a world to begin.'
                  : 'No conversations found.'}
              </p>
            </div>
          )}
          {items.map((c) => {
            const char = characters.find((ch) => ch.id === c.characterId)
            const last = [...c.messages].reverse().find((m) => m.role !== 'system')
            const active = c.id === activeConversationId
            return (
              <div
                key={c.id}
                onClick={() => setActiveConversation(c.id)}
                className={cn(
                  'group relative flex cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 transition',
                  active
                    ? 'border-accent/40 bg-accent/10 text-fg'
                    : 'border-transparent hover:bg-surface text-muted hover:text-fg',
                )}
              >
                <Avatar
                  name={char?.name ?? '?'}
                  avatar={char?.avatar}
                  color={char?.avatarColor}
                  size={34}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {c.pinned && (
                      <Pin size={11} className="shrink-0 text-accent" fill="currentColor" />
                    )}
                    <span className="truncate text-xs font-semibold text-fg">
                      {char?.name ?? c.title}
                    </span>
                  </div>
                  <p className="truncate text-2xs text-faint mt-0.5">
                    {last?.content?.replace(/[*_"<>[\]]/g, '').slice(0, 42) || 'No messages yet'}
                  </p>
                </div>
                <span className="shrink-0 text-2xs text-faint opacity-0 transition group-hover:opacity-100 tabular-nums">
                  {timeAgo(c.updatedAt)}
                </span>
                <div className="row-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePin(c.id)
                    }}
                    className="bg-surface-2 text-faint hover:text-accent border border-border"
                    title={c.pinned ? 'Unpin' : 'Pin'}
                    aria-label={c.pinned ? 'Unpin chat' : 'Pin chat'}
                  >
                    <Pin size={11} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteConversation(c.id)
                    }}
                    className="bg-surface-2 text-faint hover:text-danger border border-border"
                    title="Delete"
                    aria-label="Delete chat"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="hairline pad-bottom flex items-center gap-1.5 px-3 py-2.5 border-t border-border bg-surface">
          <button
            onClick={() => setUI({ settingsOpen: true })}
            className="btn flex-1 justify-start rounded-lg h-9 px-2.5 text-xs"
          >
            <SettingsIcon size={14} className="text-muted" />
            <span className="truncate">Settings</span>
            <span
              className={cn(
                'ml-auto size-2 rounded-full shrink-0',
                ready ? 'bg-success' : 'bg-warning',
              )}
              title={ready ? 'AI Connected' : 'No API key set'}
            />
          </button>
          <button
            onClick={() => setUI({ welcomeOpen: true })}
            className="btn size-9 shrink-0 rounded-lg p-0"
            title="Show the tour"
            aria-label="Show the tour"
          >
            <Compass size={14} className="text-muted" />
          </button>
          <button
            onClick={() => setUI({ settingsOpen: true, settingsTab: 'themes', rightPanel: 'none' })}
            className="btn size-9 shrink-0 rounded-lg p-0"
            title="About this theme"
            aria-label="About this theme"
          >
            <Info size={14} className="text-muted" />
          </button>
        </div>
      </aside>
    </>
  )
}
