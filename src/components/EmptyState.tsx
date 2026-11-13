import { Check, Globe2, KeyRound, MessageSquare, Plus, Sparkles, Users } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { THEMES } from '@/data/themes'
import { providerNeedsKey } from '@/lib/groq'
import { Avatar } from './Avatar'
import appIcon from '@/assets/icon.png'

export function EmptyState() {
  const theme = useStore((s) => s.settings.theme)
  const setUI = useStore((s) => s.setUI)
  const characters = useStore((s) => s.characters)
  const worlds = useStore((s) => s.worlds)
  const focus = useStore((s) => s.focusOrCreateConversation)
  const setActiveWorld = useStore((s) => s.setActiveWorld)
  const apiKey = useStore((s) => s.settings.apiKey)
  const baseUrl = useStore((s) => s.settings.baseUrl)
  const connected = apiKey.trim() !== '' || !providerNeedsKey(baseUrl)

  const meta = THEMES[theme]
  const themed = characters.filter((c) => c.theme === theme)

  const openCreate = () => {
    if (theme === 'world') setUI({ worldModal: { tab: worlds.length ? 'cast' : 'world' } })
    else setUI({ characterModal: { tab: 'create' } })
  }

  const openBrowse = () => {
    if (theme === 'world') setUI({ worldModal: { tab: 'cast' } })
    else setUI({ characterModal: { tab: 'browse' } })
  }

  return (
    <div className="scroll-thin relative flex h-full flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="anim-pop relative w-full max-w-lg text-center">
        {!connected && (
          <button
            onClick={() => setUI({ settingsOpen: true, settingsTab: 'connection' })}
            className="mx-auto mb-6 flex w-full items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-left transition hover:border-warning/60"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning">
              <KeyRound size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-fg">No AI provider connected</span>
              <span className="block text-2xs text-muted">
                Configure your API key (Groq, Ollama Cloud, etc.) to start chatting.
              </span>
            </span>
          </button>
        )}

        {/* Nexus Brand Hero & Mode Indicator */}
        <div className="relative mx-auto mb-5 flex size-16 items-center justify-center">
          <img
            src={appIcon}
            alt="Nexus Logo"
            className="size-16 rounded-2xl object-cover shadow-2xl ring-1 ring-border/80"
          />
          <span className="absolute -bottom-1 -right-1 flex size-6.5 items-center justify-center rounded-lg bg-accent-grad text-xs text-accent-fg shadow-md ring-2 ring-bg">
            {theme === 'chatbot' ? (
              <MessageSquare size={13} />
            ) : theme === 'anime' ? (
              <Sparkles size={13} />
            ) : (
              <Globe2 size={13} />
            )}
          </span>
        </div>

        <h2 className="font-display text-2xl font-bold tracking-tight text-fg">
          {meta.name} Mode
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted">
          {meta.blurb}
        </p>

        {/* Feature Highlights */}
        <ul className="list mx-auto mt-6 max-w-sm text-left">
          {meta.features.map((f) => (
            <li key={f} className="list-row text-xs text-muted">
              <Check size={14} className="shrink-0 text-accent" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button onClick={openCreate} className="btn btn-accent px-4 py-2.5 text-xs">
            {theme === 'world' ? <Globe2 size={15} /> : <Plus size={15} />}
            {theme === 'world'
              ? worlds.length
                ? 'New world'
                : 'Create world'
              : 'Create character'}
          </button>
          {(themed.length > 0 || (theme === 'world' && worlds.length > 0)) && (
            <button onClick={openBrowse} className="btn px-4 py-2.5 text-xs">
              <Users size={15} />
              {theme === 'world' ? 'Browse cast' : 'Browse characters'}
            </button>
          )}
        </div>

        {/* Continue Recent Characters */}
        {theme !== 'world' && themed.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border">
            <p className="mb-3 text-2xs font-semibold tracking-wide text-faint uppercase">
              Start chat with
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {themed.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => focus(c.id)}
                  className="group flex w-16 flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-surface transition"
                  title={c.name}
                >
                  <Avatar
                    name={c.name}
                    avatar={c.avatar}
                    color={c.avatarColor}
                    size={42}
                    className="transition duration-200 group-hover:scale-105"
                  />
                  <span className="w-full truncate text-2xs text-muted font-medium group-hover:text-fg">
                    {c.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* World quick switch */}
        {theme === 'world' && worlds.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border">
            <p className="mb-2.5 text-2xs font-semibold tracking-wide text-faint uppercase">
              Active Worlds
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {worlds.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setActiveWorld(w.id)}
                  className="chip text-xs hover:border-accent"
                >
                  <span className="size-2 rounded-full" style={{ background: w.color }} />
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
