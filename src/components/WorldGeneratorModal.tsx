import { useState, useRef } from 'react'
import {
  AlertCircle,
  Check,
  Globe2,
  Loader2,
  RefreshCw,
  Search,
  Wand2,
} from 'lucide-react'
import { Modal } from './Modal'
import { useStore } from '@/store/useStore'
import {
  generateWorldProfile,
  regenerateWorldSection,
  type GeneratedWorldProfile,
  type WorldSectionKey,
} from '@/lib/worldGenerator'
import { lookupOnlineInfo } from '@/lib/lookup'
import { PROVIDER_PRESETS, MODEL_SUGGESTIONS } from '@/lib/groq'
import { isMobilePlatform, isProviderSupportedOnPlatform } from '@/lib/platform'
import { cn } from '@/lib/utils'

interface WorldGeneratorModalProps {
  open: boolean
  onClose: () => void
  onApply: (profile: GeneratedWorldProfile) => void
}

const GENRE_SUGGESTIONS = [
  'High Fantasy',
  'Cyberpunk Noir',
  'Space Opera',
  'Isekai Fantasy',
  'Post-Apocalyptic',
  'Supernatural Mystery',
  'Urban Fantasy',
  'Historical Steampunk',
  'Wuxia & Martial Cultivation',
]

export function WorldGeneratorModal({ open, onClose, onApply }: WorldGeneratorModalProps) {
  const settings = useStore((s) => s.settings)

  const [prompt, setPrompt] = useState('')
  const [genre, setGenre] = useState('High Fantasy')
  const [lookupOnline, setLookupOnline] = useState(false)
  const [lookupStatus, setLookupStatus] = useState('')
  const [providerId, setProviderId] = useState<string>('inherit')
  const [model, setModel] = useState<string>('')

  const [generating, setGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [profile, setProfile] = useState<GeneratedWorldProfile | null>(null)

  const [regeneratingSection, setRegeneratingSection] = useState<WorldSectionKey | null>(null)
  const [sectionPrompt, setSectionPrompt] = useState('')
  const [sectionPromptTarget, setSectionPromptTarget] = useState<WorldSectionKey | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setErrorMsg('Please enter a world concept or description.')
      return
    }

    setGenerating(true)
    setErrorMsg(null)
    setLookupStatus('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      let lookupRef = ''
      if (lookupOnline) {
        setLookupStatus('Searching MediaWiki (Wikipedia / Fandom) for canon reference…')
        try {
          const lookup = await lookupOnlineInfo(prompt, controller.signal)
          if (lookup?.content) {
            lookupRef = lookup.content
            setLookupStatus(`Found reference notes from ${lookup.sources.length} sources.`)
          } else {
            setLookupStatus('No online articles found. Proceeding with creative generation.')
          }
        } catch {
          setLookupStatus('Lookup bypassed.')
        }
      }

      const preferredModel =
        providerId !== 'inherit' && model ? { providerId, model } : null

      const result = await generateWorldProfile({
        description: prompt.trim(),
        genre,
        lookupReference: lookupRef,
        settings,
        preferredModel,
        signal: controller.signal,
      })

      setProfile(result)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setErrorMsg(err instanceof Error ? err.message : 'World generation failed.')
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  const handleRegenerate = async (section: WorldSectionKey) => {
    if (!profile) return
    setRegeneratingSection(section)
    setErrorMsg(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const preferredModel =
        providerId !== 'inherit' && model ? { providerId, model } : null

      const updated = await regenerateWorldSection({
        world: profile,
        section,
        prompt: sectionPrompt,
        settings,
        preferredModel,
        signal: controller.signal,
      })

      setProfile(updated)
      setSectionPromptTarget(null)
      setSectionPrompt('')
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setErrorMsg(err instanceof Error ? err.message : `Failed to regenerate ${section}.`)
    } finally {
      setRegeneratingSection(null)
      abortRef.current = null
    }
  }

  const handleApply = () => {
    if (profile) {
      onApply(profile)
      onClose()
    }
  }

  const isMobile = isMobilePlatform()
  const availableProviders = PROVIDER_PRESETS.filter(
    (p) =>
      isProviderSupportedOnPlatform(p.id, isMobile) &&
      (settings.keyedProviders.includes(p.id) ||
        p.id === 'ollama' ||
        p.id === 'lmstudio' ||
        p.id === 'pollinations'),
  )

  const modelsForProvider = providerId !== 'inherit' ? MODEL_SUGGESTIONS[providerId] || [] : []

  return (
    <Modal
      open={open}
      onClose={generating ? () => {} : onClose}
      size="xl"
      icon={<Globe2 size={18} />}
      title="AI World Studio Architect"
      subtitle="Generate a complete living world bible with rules, lore, factions, and starting NPCs"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button onClick={onClose} disabled={generating} className="btn btn-ghost px-4 py-2 text-xs">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {profile ? (
              <>
                <button
                  onClick={() => setProfile(null)}
                  disabled={generating}
                  className="btn btn-ghost px-3 py-1.5 text-xs"
                >
                  Start Over
                </button>
                <button
                  onClick={handleApply}
                  className="btn btn-accent flex items-center gap-2 px-4 py-2 text-xs shadow-md"
                >
                  <Check size={14} />
                  Apply to World Bible
                </button>
              </>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="btn btn-accent flex items-center gap-2 px-4 py-2 text-xs shadow-md"
              >
                {generating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Generating Universe…
                  </>
                ) : (
                  <>
                    <Wand2 size={14} />
                    Generate World
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-fg">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-danger" />
            <div className="flex-1 leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {!profile ? (
          <div className="space-y-4">
            {/* World concept input */}
            <div>
              <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted">
                World Concept & Vision
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={generating}
                rows={4}
                placeholder="e.g. A solarpunk floating archipelago powered by celestial whale migrations, where memory is traded as currency and ancient cloud guilds compete for wind rights…"
                className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-xs text-fg leading-relaxed outline-none focus:border-accent scroll-thin"
              />
            </div>

            {/* Genre selector */}
            <div>
              <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted">
                Genre
              </label>
              <div className="flex flex-wrap gap-1.5">
                {GENRE_SUGGESTIONS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenre(g)}
                    disabled={generating}
                    className={cn(
                      'chip text-2xs py-1 transition',
                      genre === g ? 'chip-active' : 'hover:bg-surface-2',
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Lookup toggle and Provider configuration */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
              <label className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-surface/50 p-3 cursor-pointer hover:bg-surface-2/60 transition">
                <input
                  type="checkbox"
                  checked={lookupOnline}
                  onChange={(e) => setLookupOnline(e.target.checked)}
                  disabled={generating}
                  className="mt-0.5 size-4 rounded accent-accent"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-fg flex items-center gap-1.5">
                    <Search size={13} className="text-accent" />
                    Look up online (Wikipedia / Fandom)
                  </span>
                  <p className="text-2xs text-muted leading-relaxed">
                    Retrieve real lore and background notes for existing franchises (e.g. Cyberpunk, Dune, Evangelion).
                  </p>
                </div>
              </label>

              <div className="rounded-xl border border-border/80 bg-surface/50 p-3 space-y-2">
                <span className="block text-2xs font-semibold uppercase tracking-wider text-muted">
                  AI Model Override
                </span>
                <div className="flex gap-2">
                  <select
                    value={providerId}
                    onChange={(e) => {
                      const val = e.target.value
                      setProviderId(val)
                      setModel(MODEL_SUGGESTIONS[val]?.[0] || '')
                    }}
                    disabled={generating}
                    className="flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-2xs text-fg outline-none focus:border-accent"
                  >
                    <option value="inherit">Global Default</option>
                    {availableProviders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>

                  {providerId !== 'inherit' && (
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      disabled={generating}
                      className="flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-2xs text-fg outline-none focus:border-accent font-mono"
                    >
                      {modelsForProvider.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {lookupStatus && (
              <p className="text-2xs text-accent italic">{lookupStatus}</p>
            )}
          </div>
        ) : (
          /* Profile Review & Single-Section Regeneration */
          <div className="space-y-5">
            {/* Header info */}
            <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface/60 p-4">
              <span className="text-3xl">{profile.avatar}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base font-bold text-fg truncate">
                    {profile.name}
                  </h3>
                  <span className="rounded bg-accent/15 px-2 py-0.5 text-2xs font-semibold text-accent border border-accent/25">
                    {profile.genre}
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-2">
                  {profile.description}
                </p>
              </div>
            </div>

            {/* Sections grid */}
            <div className="space-y-3">
              {(
                [
                  { key: 'rules', label: 'World Rules & Physical Limits', value: profile.rules },
                  { key: 'locations', label: 'Key Locations & Sectors', value: profile.locations },
                  { key: 'factions', label: 'Factions, Guilds & Agendas', value: profile.factions },
                  { key: 'lore', label: 'Timeline & Historical Lore', value: profile.lore },
                ] as const
              ).map((sec) => (
                <div
                  key={sec.key}
                  className="rounded-xl border border-border/80 bg-surface/50 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-fg">{sec.label}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSectionPromptTarget(sectionPromptTarget === sec.key ? null : sec.key)
                      }
                      disabled={regeneratingSection !== null}
                      className="btn btn-ghost flex items-center gap-1.5 py-1 px-2 text-2xs text-faint hover:text-fg"
                    >
                      <RefreshCw
                        size={11}
                        className={cn(regeneratingSection === sec.key && 'animate-spin')}
                      />
                      Regenerate
                    </button>
                  </div>

                  {sectionPromptTarget === sec.key && (
                    <div className="flex gap-2 p-2 rounded-lg bg-surface border border-border/80">
                      <input
                        type="text"
                        value={sectionPrompt}
                        onChange={(e) => setSectionPrompt(e.target.value)}
                        placeholder="Optional guidance (e.g. 'Make it darker', 'Add floating ruins')…"
                        className="flex-1 bg-transparent text-2xs text-fg outline-none"
                      />
                      <button
                        onClick={() => handleRegenerate(sec.key)}
                        disabled={regeneratingSection !== null}
                        className="btn btn-accent py-1 px-2.5 text-2xs"
                      >
                        Run
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap">
                    {sec.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Starting NPCs preview */}
            {profile.npcs.length > 0 && (
              <div className="rounded-xl border border-border/80 bg-surface/50 p-3.5 space-y-2">
                <span className="text-xs font-semibold text-fg">
                  Starting NPC Roster ({profile.npcs.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {profile.npcs.map((npc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-surface p-2 text-xs"
                    >
                      <span className="text-xl">{npc.avatar}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-fg truncate">{npc.name}</div>
                        <div className="text-2xs text-muted truncate">{npc.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
