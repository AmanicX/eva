import { useState } from 'react'
import { Plus, X, Brain, Heart, BookOpen, Clock } from 'lucide-react'
import type { Conversation, World } from '@/types'
import { clamp } from '@/lib/utils'

interface Props {
  conversation: Conversation
  world?: World
  onClose: () => void
  onMemoryChange: (value: string) => void
  onReputationChange: (next: Record<string, number>) => void
}

function tone(value: number) {
  if (value >= 40) return { label: 'Adored', color: '#30d158' }
  if (value >= 10) return { label: 'Friendly', color: '#34d399' }
  if (value > -10) return { label: 'Neutral', color: '#94a3b8' }
  if (value > -40) return { label: 'Wary', color: '#ff9f0a' }
  if (value > -75) return { label: 'Hostile', color: '#f43f5e' }
  return { label: 'Hated', color: '#ff453a' }
}

export function RightPanel({
  conversation,
  world,
  onClose,
  onMemoryChange,
  onReputationChange,
}: Props) {
  const [memoryDraft, setMemoryDraft] = useState(conversation.memory)
  const [prevConvId, setPrevConvId] = useState(conversation.id)
  const [newNpc, setNewNpc] = useState('')
  const reputation = conversation.worldState?.reputation ?? {}
  const events = conversation.worldState?.events ?? []

  if (conversation.id !== prevConvId) {
    setPrevConvId(conversation.id)
    setMemoryDraft(conversation.memory)
  }

  const setRep = (name: string, value: number) =>
    onReputationChange({ ...reputation, [name]: clamp(Math.round(value), -100, 100) })

  return (
    <>
      <button
        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        onClick={onClose}
        aria-label="Close panel overlay"
      />
      <aside className="pad-top safe-right fixed inset-y-0 right-0 z-40 flex w-[88%] max-w-sm flex-col border-l border-border bg-bg-2 lg:static lg:z-auto lg:w-80">
        {/* Header */}
        <div className="hairline flex items-center justify-between px-4 py-3">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-fg">
            {conversation.worldId ? (
              <Heart size={16} className="text-accent" />
            ) : (
              <Brain size={16} className="text-accent" />
            )}
            <span>{conversation.worldId ? 'World State & Relationships' : 'Conversation Memory'}</span>
          </h3>
          <button
            onClick={onClose}
            className="btn btn-ghost grid size-8 shrink-0 place-items-center rounded-lg p-0 text-faint hover:text-fg"
            aria-label="Close panel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body content */}
        <div className="scroll-thin flex-1 space-y-6 overflow-y-auto p-4">
          {world && (
            <section className="space-y-4">
              {/* World Briefing HUD */}
              <div className="rounded-xl border border-border bg-surface p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-fg">{world.name}</span>
                  <span className="text-2xs text-faint">{world.genre}</span>
                </div>
                {world.playerName && (
                  <p className="text-2xs text-muted">
                    Player: <strong>{world.playerName}</strong> ({world.playerRole || 'Hero'})
                  </p>
                )}
                {world.description && (
                  <p className="text-2xs text-faint line-clamp-2 leading-relaxed">
                    {world.description}
                  </p>
                )}
              </div>

              {/* Reputation Section */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-2xs font-semibold tracking-wide text-muted uppercase">
                    NPC Relationships
                  </h4>
                  <span className="text-2xs text-faint tabular-nums">−100 … +100</span>
                </div>

                <div className="space-y-2">
                  {Object.keys(reputation).length === 0 && (
                    <p className="text-xs text-faint py-1">No relationships formed yet.</p>
                  )}
                  {Object.entries(reputation)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, value]) => {
                      const t = tone(value)
                      return (
                        <div key={name} className="rounded-xl border border-border bg-surface p-3">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="truncate text-xs font-semibold text-fg">{name}</span>
                            <span
                              className="rounded-full px-2 py-0.5 text-2xs font-semibold tabular-nums"
                              style={{ background: `${t.color}22`, color: t.color }}
                            >
                              {t.label} {value > 0 ? `+${value}` : value}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-100}
                            max={100}
                            value={value}
                            onChange={(e) => setRep(name, Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      )
                    })}

                  {/* Add NPC form */}
                  <div className="flex gap-1.5 pt-1">
                    <input
                      value={newNpc}
                      onChange={(e) => setNewNpc(e.target.value)}
                      placeholder="Add an NPC name…"
                      className="field py-1 text-xs h-8"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newNpc.trim()) {
                          setRep(newNpc.trim(), 0)
                          setNewNpc('')
                        }
                      }}
                    />
                    <button
                      className="btn size-8 shrink-0 rounded-lg p-0"
                      onClick={() => {
                        if (newNpc.trim()) {
                          setRep(newNpc.trim(), 0)
                          setNewNpc('')
                        }
                      }}
                      title="Add character"
                      aria-label="Add character"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* World Log */}
              {events.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-2xs font-semibold tracking-wide text-muted uppercase">
                    <Clock size={12} className="text-accent" />
                    <span>Recent World Events</span>
                  </div>
                  <ul className="space-y-1.5">
                    {[...events].reverse().slice(0, 10).map((e, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-2xs text-muted leading-relaxed"
                      >
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Long term memory */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-1 text-2xs font-semibold tracking-wide text-muted uppercase">
                <BookOpen size={12} className="text-accent" />
                <span>Long-Term Memory</span>
              </h4>
              <span className="text-2xs text-faint">Auto-summarized</span>
            </div>
            <textarea
              value={memoryDraft}
              onChange={(e) => setMemoryDraft(e.target.value)}
              onBlur={() => onMemoryChange(memoryDraft)}
              rows={8}
              placeholder="Key facts this character remembers about you. Nexus updates this continuously — edit freely."
              className="field scroll-thin resize-none text-xs leading-relaxed"
            />
            <p className="text-2xs text-faint leading-relaxed">
              Maintained specifically for this character conversation.
            </p>
          </section>
        </div>
      </aside>
    </>
  )
}
