import {
  BookOpen,
  Globe2,
  KeyRound,
  MessageSquare,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { THEMES } from '@/data/themes'
import { ANIME_PRESETS, avatarFor, presetToCharacter } from '@/data/anime'
import { providerNeedsKey } from '@/lib/groq'
import { isMobilePlatform } from '@/lib/platform'
import { uid } from '@/lib/utils'
import { Avatar } from './Avatar'
import { AppLogo } from './AppLogo'

const STARTER_BOTS = [
  {
    name: 'Aria',
    tagline: 'Empathetic AI companion with deep curiosity',
    color: '#8B5CF6',
    greeting:
      '*Aria turns towards you with a warm, thoughtful tilt of her head.* "Hello. I was just wondering what was on your mind today — or what world we might explore together."',
    description:
      'Warm, thoughtful, analytical yet emotionally attuned. Speaks with nuance and vivid curiosity.',
    tags: ['companion', 'analytical', 'creative', 'warm'],
  },
  {
    name: 'Kaelen Vance',
    tagline: 'Cynical cyberpunk fixer with a hidden code of honor',
    color: '#2563EB',
    greeting:
      '*Kaelen exhales a thin curl of smoke, scanning the room before locking eyes with you.* "Keep your voice down. In this district, loose talk gets you deleted. What job did you bring me?"',
    description:
      'Sharp, streetwise, resourceful, and guarded. Operates in neon shadows but never betrays a true ally.',
    tags: ['cyberpunk', 'fixer', 'streetwise', 'gritty'],
  },
  {
    name: 'Elowen of the Silver Vale',
    tagline: 'Archival scholar and keeper of forgotten arcane lore',
    color: '#10B981',
    greeting:
      '*Elowen carefully sets down a glowing parchment quill and brushes back a lock of silver hair.* "Greetings, traveler. Not many find their way to this sanctuary. Which ancient mystery seeks your attention?"',
    description:
      'Poetic, wise, deeply knowledgeable about ancient history, arcane relics, and world mythologies.',
    tags: ['fantasy', 'scholar', 'arcane', 'mystic'],
  },
]

function createStarterCharacter(bot: (typeof STARTER_BOTS)[0]) {
  return {
    id: uid('char'),
    theme: 'chatbot' as const,
    name: bot.name,
    avatar: '',
    avatarColor: bot.color,
    tagline: bot.tagline,
    description: bot.description,
    gender: 'Other',
    age: 'Adult',
    tags: bot.tags,
    greeting: bot.greeting,
    canon: 'custom' as const,
    overrides: '',
    metadata: [],
    createdAt: Date.now(),
  }
}

export function EmptyState() {
  const theme = useStore((s) => s.settings.theme)
  const setUI = useStore((s) => s.setUI)
  const characters = useStore((s) => s.characters)
  const worlds = useStore((s) => s.worlds)
  const activeWorldId = useStore((s) => s.activeWorldId)
  const focus = useStore((s) => s.focusOrCreateConversation)
  const createCharacter = useStore((s) => s.createCharacter)
  const apiKey = useStore((s) => s.settings.apiKey)
  const baseUrl = useStore((s) => s.settings.baseUrl)
  const connected = apiKey.trim() !== '' || !providerNeedsKey(baseUrl)

  const meta = THEMES[theme]
  const themed = characters.filter((c) => c.theme === theme)
  const activeWorld = worlds.find((w) => w.id === activeWorldId) || worlds[0]

  const openCreate = () => {
    if (theme === 'world') setUI({ worldModal: { tab: worlds.length ? 'cast' : 'world' } })
    else setUI({ characterModal: { tab: 'create' } })
  }

  const openBrowse = () => {
    if (theme === 'world') setUI({ worldModal: { tab: 'cast' } })
    else setUI({ characterModal: { tab: 'browse' } })
  }

  const handleStartPreset = (presetName: string) => {
    const preset = ANIME_PRESETS.find((p) => p.name === presetName)
    if (!preset) return
    const existing = characters.find((c) => c.name === preset.name && c.theme === 'anime')
    if (existing) {
      focus(existing.id)
    } else {
      const char = presetToCharacter(preset)
      createCharacter(char)
      focus(char.id)
    }
  }

  const handleStartStarterBot = (bot: (typeof STARTER_BOTS)[0]) => {
    const existing = characters.find((c) => c.name === bot.name && c.theme === 'chatbot')
    if (existing) {
      focus(existing.id)
    } else {
      const char = createStarterCharacter(bot)
      createCharacter(char)
      focus(char.id)
    }
  }

  return (
    <div className="scroll-thin relative flex h-full flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6">
      <div className="anim-pop relative w-full max-w-xl text-center py-4">
        {!connected && (
          <button
            onClick={() => setUI({ settingsOpen: true, settingsTab: 'connection' })}
            className="mx-auto mb-6 flex w-full items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-3.5 text-left transition hover:border-warning/80 hover:bg-warning/15 shadow-sm"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning">
              <KeyRound size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-fg">No AI provider connected</span>
              <span className="block text-2xs text-muted">
                {isMobilePlatform()
                  ? 'Configure your API key (Groq, OpenRouter, Google AI, etc.) to start conversations.'
                  : 'Configure your API key (Groq, OpenRouter, Ollama, etc.) to start conversations.'}
              </span>
            </span>
          </button>
        )}

        {/* Eva Brand Hero & Mode Indicator */}
        <div className="relative mx-auto mb-4 flex size-18 items-center justify-center">
          <AppLogo className="size-18 rounded-2xl shadow-xl ring-1 ring-border/80" />
          <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-xl bg-accent-grad text-xs text-accent-fg shadow-md ring-2 ring-bg">
            {theme === 'chatbot' ? (
              <MessageSquare size={14} />
            ) : theme === 'anime' ? (
              <Sparkles size={14} />
            ) : (
              <Globe2 size={14} />
            )}
          </span>
        </div>

        <h2 className="font-display text-2xl font-bold tracking-tight text-fg">
          {meta.name} Studio
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted">
          {meta.blurb}
        </p>

        {/* Action Buttons */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button onClick={openCreate} className="btn btn-accent px-4 py-2.5 text-xs font-semibold shadow-xs">
            {theme === 'world' ? <Globe2 size={15} /> : <Plus size={15} />}
            {theme === 'world'
              ? worlds.length
                ? 'Create New World'
                : 'Create First World'
              : 'Create Character'}
          </button>
          {theme !== 'world' && (
            <button
              onClick={() => setUI({ characterModal: { tab: 'generate' } })}
              className="btn px-4 py-2.5 text-xs border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 transition font-medium"
            >
              <Sparkles size={15} />
              Generate with AI
            </button>
          )}
          {(themed.length > 0 || (theme === 'world' && worlds.length > 0)) && (
            <button onClick={openBrowse} className="btn px-4 py-2.5 text-xs">
              <Users size={15} />
              {theme === 'world' ? 'Browse Cast' : 'Browse Characters'}
            </button>
          )}
        </div>

        {/* Mode-Specific Content */}

        {/* 1. Anime Mode: Featured Canon Cast */}
        {theme === 'anime' && (
          <div className="mt-8 border-t border-border pt-6 text-left">
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <h3 className="text-xs font-semibold text-fg">Featured Canon Cast</h3>
                <p className="text-2xs text-muted">Instant 1-click conversation with canon personalities</p>
              </div>
              <button
                onClick={() => setUI({ characterModal: { tab: 'browse' } })}
                className="text-2xs text-accent hover:underline font-medium"
              >
                View all ({ANIME_PRESETS.length})
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ANIME_PRESETS.slice(0, 4).map((p) => (
                <div
                  key={p.name}
                  onClick={() => handleStartPreset(p.name)}
                  className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-2.5 transition hover:border-accent/40 hover:bg-surface-2 shadow-xs"
                >
                  <Avatar
                    name={p.name}
                    avatar={avatarFor(p.name)}
                    color={p.avatarColor}
                    size={40}
                    className="shrink-0 group-hover:scale-105 transition"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-fg group-hover:text-accent transition">
                        {p.name}
                      </span>
                      <span className="rounded bg-accent/15 px-1 py-0.2 text-3xs text-accent font-medium border border-accent/25 shrink-0">
                        {p.source}
                      </span>
                    </div>
                    <p className="truncate text-2xs text-faint mt-0.5">{p.tagline}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Chatbot Mode: Character Starters / Library */}
        {theme === 'chatbot' && (
          <div className="mt-8 border-t border-border pt-6 text-left">
            {themed.length > 0 ? (
              <div>
                <p className="mb-3 px-1 text-2xs font-semibold tracking-wide text-faint uppercase">
                  Your Characters
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {themed.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => focus(c.id)}
                      className="group flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-left hover:border-accent/40 hover:bg-surface-2 transition shadow-xs"
                    >
                      <Avatar
                        name={c.name}
                        avatar={c.avatar}
                        color={c.avatarColor}
                        size={28}
                        className="group-hover:scale-105 transition shrink-0"
                      />
                      <span className="truncate text-xs font-medium text-fg max-w-[120px]">
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-3 px-1">
                  <h3 className="text-xs font-semibold text-fg">Starter Archetypes</h3>
                  <p className="text-2xs text-muted">Click any archetype to create and begin chatting instantly</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {STARTER_BOTS.map((bot) => (
                    <button
                      key={bot.name}
                      onClick={() => handleStartStarterBot(bot)}
                      className="group flex flex-col items-start rounded-xl border border-border bg-surface p-3 text-left transition hover:border-accent/50 hover:bg-surface-2 shadow-xs"
                    >
                      <span
                        className="mb-2 size-2.5 rounded-full shrink-0"
                        style={{ background: bot.color }}
                      />
                      <span className="text-xs font-semibold text-fg group-hover:text-accent transition">
                        {bot.name}
                      </span>
                      <p className="mt-1 line-clamp-2 text-2xs text-muted leading-relaxed">
                        {bot.tagline}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. World Mode: Active World Briefing or World Creator */}
        {theme === 'world' && (
          <div className="mt-8 border-t border-border pt-6 text-left">
            {activeWorld ? (
              <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full shrink-0"
                      style={{ background: activeWorld.color }}
                    />
                    <h3 className="text-sm font-semibold text-fg">{activeWorld.name}</h3>
                  </div>
                  <span className="rounded-md bg-surface-2 px-2 py-0.5 text-2xs text-faint border border-border">
                    {activeWorld.genre}
                  </span>
                </div>
                {activeWorld.description && (
                  <p className="text-xs text-muted leading-relaxed mb-3 line-clamp-3">
                    {activeWorld.description}
                  </p>
                )}
                {activeWorld.playerName && (
                  <div className="text-2xs text-faint mb-3 flex items-center gap-2">
                    <span>Protagonist: <strong>{activeWorld.playerName}</strong></span>
                    {activeWorld.playerRole && <span>· Role: {activeWorld.playerRole}</span>}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
                  <button
                    onClick={() => setUI({ worldModal: { tab: 'cast' } })}
                    className="btn btn-accent px-3 py-1.5 text-xs font-medium"
                  >
                    <Users size={13} />
                    Explore Cast & NPCs
                  </button>
                  <button
                    onClick={() => setUI({ worldModal: { tab: 'world' } })}
                    className="btn px-3 py-1.5 text-xs"
                  >
                    <BookOpen size={13} />
                    Lore & Details
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                <Globe2 size={24} className="mx-auto mb-2 text-faint" />
                <h3 className="text-xs font-semibold text-fg">No Interactive Worlds Created</h3>
                <p className="mt-1 text-2xs text-muted max-w-sm mx-auto">
                  Build a fictional setting with custom factions, locations, and characters with evolving reputation.
                </p>
                <button
                  onClick={() => setUI({ worldModal: { tab: 'world' } })}
                  className="btn btn-accent mx-auto mt-4 px-3.5 py-1.5 text-xs font-medium"
                >
                  <Plus size={13} />
                  Build First World
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
