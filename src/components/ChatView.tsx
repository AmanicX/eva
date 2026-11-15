import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Brain,
  ChevronLeft,
  Cpu,
  Download,
  Eraser,
  Globe2,
  Heart,
  ImageIcon,
  Menu,
  MoreVertical,
  Pencil,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { parseInput } from '@/lib/commands'
import { buildRequestMessages } from '@/lib/prompt'
import { providerNeedsKey } from '@/lib/groq'
import { executeChatWithFallback } from '@/lib/fallbackEngine'
import { generateSpeechAudio, ttsPlayer } from '@/lib/tts'
import { updateMemory } from '@/lib/memory'
import { extractState } from '@/lib/state'
import { Avatar } from './Avatar'
import { Composer } from './Composer'
import { MessageBubble } from './MessageBubble'
import { RightPanel } from './RightPanel'
import { SceneModal } from './SceneModal'
import { ChatConfigModal } from './ChatConfigModal'
import { cn, download, uid } from '@/lib/utils'
import type { Message } from '@/types'

export function ChatView({ onShowCommands }: { onShowCommands: () => void }) {
  const theme = useStore((s) => s.settings.theme)
  const model = useStore((s) => s.settings.model)
  const conversation = useStore((s) =>
    s.conversations.find((c) => c.id === s.activeConversationId),
  )
  const character = useStore((s) =>
    s.characters.find((c) => c.id === conversation?.characterId),
  )
  const world = useStore((s) => s.worlds.find((w) => w.id === conversation?.worldId))
  const rightPanel = useStore((s) => s.ui.rightPanel)

  const addMessage = useStore((s) => s.addMessage)
  const updateMessage = useStore((s) => s.updateMessage)
  const removeMessage = useStore((s) => s.removeMessage)
  const setMemory = useStore((s) => s.setMemory)
  const updateWorldState = useStore((s) => s.updateWorldState)
  const setUI = useStore((s) => s.setUI)

  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [sceneModalOpen, setSceneModalOpen] = useState(false)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef(false)

  const scrollToBottom = (smooth: boolean) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  useEffect(() => {
    scrollToBottom(!streamRef.current)
  }, [conversation?.messages, conversation?.id])

  useEffect(() => {
    streamRef.current = streaming
  }, [streaming])

  const applyState = (
    convId: string,
    update: NonNullable<ReturnType<typeof extractState>['update']>,
  ) => {
    const conv = useStore.getState().conversations.find((c) => c.id === convId)
    if (!conv?.worldState) return
    const ws = conv.worldState
    updateWorldState(convId, {
      reputation: { ...ws.reputation, ...(update.reputation ?? {}) },
      events: update.events ? [...ws.events, ...update.events].slice(-40) : ws.events,
      notes: update.notes ?? ws.notes,
    })
  }

  const runAssistant = async (convId: string) => {
    const state = useStore.getState()
    const conv = state.conversations.find((c) => c.id === convId)
    if (!conv) return
    const char = state.characters.find((c) => c.id === conv.characterId)
    const wld = state.worlds.find((w) => w.id === conv.worldId)

    if (
      providerNeedsKey(state.settings.baseUrl) &&
      !state.settings.apiKey.trim() &&
      state.settings.keyedProviders.length === 0
    ) {
      addMessage(convId, {
        id: uid('msg'),
        role: 'assistant',
        content:
          '⚠ No API key configured. Open **Settings → Connection**, paste your API key, then retry.',
        timestamp: Date.now(),
        error: true,
      })
      setUI({ settingsOpen: true, settingsTab: 'connection' })
      return
    }

    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    const assistantId = uid('msg')
    addMessage(convId, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    })

    try {
      const messages = buildRequestMessages({
        settings: state.settings,
        character: char!,
        world: wld,
        conversation: conv,
      })

      const preferred = conv.chatConfig?.providerId
        ? {
            providerId: conv.chatConfig.providerId,
            model: conv.chatConfig.model,
          }
        : null

      const result = await executeChatWithFallback({
        messages,
        preferredCandidate: preferred,
        settings: state.settings,
        temperature: state.settings.temperature,
        maxTokens: state.settings.maxTokens,
        signal: controller.signal,
      })

      const { clean, update } = extractState(result.content)
      updateMessage(convId, assistantId, { content: clean.trim() || '…' })
      if (update && wld) applyState(convId, update)

      // Auto-TTS if enabled
      if (state.settings.ttsAutoRead && state.settings.ttsEnabled) {
        try {
          const ttsPref = conv.ttsConfig?.providerId
            ? {
                providerId: conv.ttsConfig.providerId,
                voice: conv.ttsConfig.voice || 'alloy',
              }
            : null
          const { audioUrl } = await generateSpeechAudio(clean, ttsPref, state.settings)
          ttsPlayer.play(assistantId, audioUrl)
        } catch {
          /* auto-tts is best effort */
        }
      }

      const latest = useStore.getState().conversations.find((c) => c.id === convId)
      if (latest) {
        try {
          const mem = await updateMemory({ settings: state.settings, conversation: latest })
          if (mem) setMemory(convId, mem)
        } catch {
          /* memory is best-effort */
        }
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      const text = aborted
        ? '_Stopped._'
        : `⚠ ${err instanceof Error ? err.message : 'Request failed.'}`
      updateMessage(convId, assistantId, { content: text, error: !aborted })
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleSend = () => {
    if (!input.trim() || streaming || !conversation) return
    const convId = conversation.id
    const parsed = parseInput(input)
    const message: Message = {
      id: uid('msg'),
      role: 'user',
      content: parsed.speech.trim() || input.trim(),
      raw: input.trim(),
      commands: parsed.commands,
      timestamp: Date.now(),
    }
    addMessage(convId, message)

    const worldCmds = parsed.commands.filter((c) => c.type === 'world')
    if (
      worldCmds.length &&
      useStore.getState().conversations.find((c) => c.id === convId)?.worldState
    ) {
      const conv = useStore.getState().conversations.find((c) => c.id === convId)!
      updateWorldState(convId, {
        events: [...(conv.worldState?.events ?? []), ...worldCmds.map((c) => c.text)].slice(-40),
      })
    }

    setInput('')
    void runAssistant(convId)
  }

  const handleRegenerate = () => {
    if (!conversation || streaming) return
    const msgs = conversation.messages
    const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant') removeMessage(conversation.id, last.id)
    void runAssistant(conversation.id)
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const messages = conversation?.messages ?? []
  const lastAssistantId = useMemo(() => {
    if (!conversation) return null
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      if (conversation.messages[i].role === 'assistant') return conversation.messages[i].id
    }
    return null
  }, [conversation])

  if (!conversation) return null

  // Reputation with this character in World mode
  const currentRep =
    world && character?.name && conversation.worldState?.reputation?.[character.name] !== undefined
      ? conversation.worldState.reputation[character.name]
      : null

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Universal Header with Mode Nuances */}
      <header className="hairline material-header pad-top flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setUI({ sidebarOpen: true })}
            className="btn btn-ghost grid size-9 shrink-0 place-items-center rounded-xl p-0 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>

          <Avatar
            name={character?.name ?? '?'}
            avatar={character?.avatar}
            color={character?.avatarColor}
            size={36}
            ring
            className="shrink-0"
          />

          <div className="min-w-0">
            {renaming ? (
              <input
                autoFocus
                defaultValue={conversation.title}
                className="field py-0.5 text-xs h-7"
                onBlur={(e) => {
                  useStore
                    .getState()
                    .renameConversation(
                      conversation.id,
                      e.target.value.trim() || conversation.title,
                    )
                  setRenaming(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') setRenaming(false)
                }}
              />
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-sm font-semibold text-fg">
                  {character?.name ?? conversation.title}
                </h1>
                {theme === 'anime' && character?.canon === 'canon' && (
                  <span className="hidden sm:inline rounded bg-accent/15 px-1.5 py-0.2 text-2xs text-accent font-medium border border-accent/25">
                    Canon
                  </span>
                )}
                {theme === 'world' && currentRep !== null && (
                  <span
                    className="hidden sm:inline rounded-full px-2 py-0.2 text-2xs font-semibold tabular-nums"
                    style={{
                      backgroundColor: 'var(--c-contrast-surface)',
                      color: 'var(--c-accent-contrast)',
                      border: '1px solid var(--c-contrast-border)',
                    }}
                  >
                    Rep: {currentRep > 0 ? `+${currentRep}` : currentRep}
                  </span>
                )}
              </div>
            )}
            <p className="truncate text-2xs text-muted flex items-center gap-1.5">
              <span>{character?.tagline || character?.source || 'Conversation'}</span>
              {world && <span className="text-faint">· {world.name}</span>}
            </p>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Quick Model Badge */}
          <button
            onClick={() => setConfigModalOpen(true)}
            className="hidden md:flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-2xs text-muted hover:bg-surface-2 hover:text-fg transition"
            title="Conversation Model & Settings (Click to configure)"
          >
            <Cpu size={12} className="text-accent" />
            <span className="font-mono truncate max-w-[140px]">
              {conversation.chatConfig?.model || model}
            </span>
          </button>

          {/* Memory toggle */}
          <button
            onClick={() => setUI({ rightPanel: rightPanel === 'memory' ? 'none' : 'memory' })}
            className={cn(
              'btn btn-ghost size-9 rounded-xl p-0',
              rightPanel === 'memory' && 'bg-surface-2 text-accent',
            )}
            title="Conversation Memory"
            aria-label="Conversation Memory"
          >
            <Brain size={16} />
          </button>

          {/* World HUD toggle */}
          {world && (
            <button
              onClick={() =>
                setUI({ rightPanel: rightPanel === 'reputation' ? 'none' : 'reputation' })
              }
              className={cn(
                'btn btn-ghost size-9 rounded-xl p-0',
                rightPanel === 'reputation' && 'bg-surface-2 text-accent',
              )}
              title="World State & Reputation"
              aria-label="World State & Reputation"
            >
              <Heart size={16} />
            </button>
          )}

          {/* Menu popover */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="btn btn-ghost size-9 rounded-xl p-0"
              title="More actions"
              aria-label="More actions"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                <div className="panel anim-pop scroll-thin absolute right-0 z-30 mt-1 max-h-[70dvh] w-52 overflow-y-auto rounded-xl p-1.5 shadow-2xl">
                  <MenuItem
                    icon={<Pencil size={14} />}
                    onClick={() => {
                      setRenaming(true)
                      setMenuOpen(false)
                    }}
                  >
                    Rename conversation
                  </MenuItem>
                  <MenuItem
                    icon={<ImageIcon size={14} />}
                    onClick={() => {
                      setSceneModalOpen(true)
                      setMenuOpen(false)
                    }}
                  >
                    Generate Scene Image
                  </MenuItem>
                  <MenuItem
                    icon={<Cpu size={14} />}
                    onClick={() => {
                      setConfigModalOpen(true)
                      setMenuOpen(false)
                    }}
                  >
                    Chat & Voice Settings
                  </MenuItem>
                  <MenuItem
                    icon={<Sparkles size={14} />}
                    onClick={() => {
                      onShowCommands()
                      setMenuOpen(false)
                    }}
                  >
                    Command cheatsheet
                  </MenuItem>
                  <MenuItem
                    icon={<Download size={14} />}
                    onClick={() => {
                      const text = messages
                        .map(
                          (m) =>
                            `${m.role === 'user' ? 'You' : character?.name ?? 'Assistant'}: ${m.content}`,
                        )
                        .join('\n\n')
                      download(`${conversation.title}.txt`, text)
                      setMenuOpen(false)
                    }}
                  >
                    Export transcript
                  </MenuItem>
                  <MenuItem
                    icon={<Eraser size={14} />}
                    onClick={() => {
                      useStore.getState().clearConversation(conversation.id)
                      setMenuOpen(false)
                    }}
                  >
                    Clear messages
                  </MenuItem>
                  <div className="my-1 h-px bg-border" />
                  <MenuItem
                    danger
                    icon={<Trash2 size={14} />}
                    onClick={() => {
                      useStore.getState().deleteConversation(conversation.id)
                      setMenuOpen(false)
                    }}
                  >
                    Delete conversation
                  </MenuItem>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex min-h-0 flex-1 material-workspace">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="scroll-thin flex-1 overflow-y-auto px-3 py-6 sm:px-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {/* Empty state presentation tailored per mode */}
              {messages.length === 0 && (
                <div className="anim-fade my-auto py-8 flex flex-col items-center text-center">
                  <Avatar
                    name={character?.name ?? '?'}
                    avatar={character?.avatar}
                    color={character?.avatarColor}
                    size={68}
                    ring
                    className="mb-4 shadow-lg"
                  />

                  {theme === 'anime' ? (
                    /* Anime Editorial Header */
                    <div className="max-w-md space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <span className="rounded bg-accent/15 px-2 py-0.5 text-2xs font-semibold text-accent border border-accent/25">
                          {character?.source || 'Anime Cast'}
                        </span>
                        {character?.canon && (
                          <span className="rounded bg-surface-2 px-2 py-0.5 text-2xs text-faint border border-border">
                            {character.canon === 'canon' ? 'Canon Personality' : 'Original Creation'}
                          </span>
                        )}
                      </div>
                      <h2 className="font-display text-2xl font-bold text-fg">
                        {character?.name}
                      </h2>
                      <p className="text-xs text-muted leading-relaxed">
                        {character?.description || character?.tagline}
                      </p>
                      {character?.greeting && (
                        <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-3.5 text-left text-xs text-fg leading-relaxed italic">
                          "{character.greeting}"
                        </div>
                      )}
                    </div>
                  ) : theme === 'world' ? (
                    /* World Game Interface Header */
                    <div className="max-w-md space-y-2">
                      <div className="flex items-center justify-center gap-1.5 text-xs text-accent">
                        <Globe2 size={14} />
                        <span className="font-semibold">{world?.name || 'Interactive World'}</span>
                        <span className="text-faint">({world?.genre || 'Setting'})</span>
                      </div>
                      <h2 className="font-display text-2xl font-bold text-fg">
                        Encounter with {character?.name}
                      </h2>
                      <p className="text-xs text-muted leading-relaxed">
                        {character?.tagline || character?.description}
                      </p>
                      {world?.playerName && (
                        <div className="mt-3 rounded-xl border border-border bg-surface p-3 text-left text-2xs space-y-1">
                          <span className="font-semibold text-fg">Player Identity:</span>
                          <span className="text-muted block">
                            Playing as <strong>{world.playerName}</strong> ({world.playerRole || 'Adventurer'})
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Chatbot Minimal Header */
                    <div className="max-w-md space-y-1.5">
                      <h2 className="font-display text-xl font-bold text-fg">
                        {character?.name || 'Chatbot'}
                      </h2>
                      <p className="text-xs text-muted leading-relaxed">
                        {character?.tagline || 'Ready to start the conversation.'}
                      </p>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap justify-center gap-2 text-2xs text-faint">
                    <span className="chip font-mono">(thoughts)</span>
                    <span className="chip font-mono">"actions"</span>
                    <span className="chip font-mono">&lt;god command&gt;</span>
                    <span className="chip font-mono">[world change]</span>
                  </div>
                </div>
              )}

              {/* Message List */}
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  character={character}
                  streaming={
                    streaming &&
                    m.id === messages[messages.length - 1]?.id &&
                    m.role === 'assistant'
                  }
                  conversationTtsConfig={conversation?.ttsConfig}
                  canRegenerate={m.id === lastAssistantId && !streaming}
                  onRegenerate={handleRegenerate}
                  onDelete={() => removeMessage(conversation.id, m.id)}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Composer */}
          <Composer
            value={input}
            onChange={setInput}
            onSend={handleSend}
            onStop={handleStop}
            onShowHelp={onShowCommands}
            onOpenScene={() => setSceneModalOpen(true)}
            streaming={streaming}
            characterName={character?.name}
          />
        </div>

        {/* Right contextual panel */}
        {rightPanel !== 'none' && (
          <RightPanel
            conversation={conversation}
            world={world}
            onClose={() => setUI({ rightPanel: 'none' })}
            onMemoryChange={(v) => setMemory(conversation.id, v)}
            onReputationChange={(next) => updateWorldState(conversation.id, { reputation: next })}
          />
        )}
      </div>

      <SceneModal open={sceneModalOpen} onClose={() => setSceneModalOpen(false)} />
      <ChatConfigModal open={configModalOpen} onClose={() => setConfigModalOpen(false)} />
    </div>
  )
}

function MenuItem({
  children,
  icon,
  onClick,
  danger,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition hover:bg-surface-2',
        danger ? 'text-danger hover:bg-danger/10' : 'text-fg',
      )}
    >
      {icon}
      {children}
      <ChevronLeft size={13} className="ml-auto opacity-0" />
    </button>
  )
}
