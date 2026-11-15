import { useState, useEffect, useRef, useTransition } from 'react'
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  ArrowLeft,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
  MessageSquare,
  Wand2,
  Settings as SettingsIcon,
  HelpCircle,
  Hash,
  Search,
} from 'lucide-react'
import { useStore, MIN_AGE } from '@/store/useStore'
import { providerNeedsKey, PROVIDER_PRESETS, MODEL_SUGGESTIONS } from '@/lib/groq'
import { lookupOnlineInfo } from '@/lib/lookup'
import {
  generateCharacterProfile,
  regenerateCharacterSection,
  formatFullCharacterPrompt,
  CHARACTER_SECTIONS,
  type GeneratedCharacterProfile,
  type CharacterSectionKey,
  type CharacterComplexity,
  type WritingStyle,
  type RoleplayFocus,
} from '@/lib/characterGenerator'
import { cn } from '@/lib/utils'

interface CharacterGeneratorProps {
  onApplyToForm: (profile: GeneratedCharacterProfile) => void
  onCreateAndChat: (profile: GeneratedCharacterProfile) => void
  onSaveOnly: (profile: GeneratedCharacterProfile) => void
  onCancel: () => void
}

const EXAMPLE_PROMPTS = [
  'A mysterious 22-year-old woman with silver hair and violet eyes. She is quiet, intelligent, slightly sarcastic, and initially distant, but deeply caring toward people she trusts. She has a hidden past as an elite archivist and speaks with quiet elegance.',
  'An enigmatic cyberpunk detective with augmented silver eyes and a dry sense of humor. Pragmatic and observant, haunted by an unresolved case, yet loyal to a fault when cornered.',
  'A cheerful, eccentric celestial alchemist with starry blue eyes and unruly copper hair. Curious about everything, talks rapidly with creative metaphors, and hides ancient cosmic knowledge behind a lighthearted smile.',
  'A stoic wandering swordsman who rarely speaks unless necessary. Honorable, fiercely protective, respectful of tradition, but carries quiet regret about a fallen order.',
]

const SWATCHES = [
  '#7c5cff', '#b45cff', '#ff6fae', '#ff5f9e', '#34d399', '#0ea5e9', '#37d7e8',
  '#ffa34d', '#ff8a5c', '#f472b6', '#a78bfa', '#66d0ff', '#e0466a', '#8fd8a8',
]

export function CharacterGenerator({
  onApplyToForm,
  onCreateAndChat,
  onSaveOnly,
  onCancel,
}: CharacterGeneratorProps) {
  const settings = useStore((s) => s.settings)
  const setUI = useStore((s) => s.setUI)

  // Input view state
  const [description, setDescription] = useState('')
  const [complexity, setComplexity] = useState<CharacterComplexity>('detailed')
  const [writingStyle, setWritingStyle] = useState<WritingStyle>('standard')
  const [roleplayFocus, setRoleplayFocus] = useState<RoleplayFocus>('roleplay')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('inherit')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [lookupOnline, setLookupOnline] = useState(false)
  const [lookupStatus, setLookupStatus] = useState('')

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  // Generated profile state (retained across edits)
  const [profile, setProfile] = useState<GeneratedCharacterProfile | null>(null)

  // Section-specific regeneration tracking
  const [activeRegeneratingSection, setActiveRegeneratingSection] = useState<CharacterSectionKey | null>(null)
  const [sectionPromptOpen, setSectionPromptOpen] = useState<CharacterSectionKey | null>(null)
  const [sectionInstructions, setSectionInstructions] = useState<Record<string, string>>({})
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({})

  // Abort controller refs
  const abortRef = useRef<AbortController | null>(null)
  const [, startTransition] = useTransition()

  // Clean up and abort any in-flight requests if component unmounts
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [])

  const handleCancelGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setIsGenerating(false)
    setActiveRegeneratingSection(null)
  }

  const needsKey = providerNeedsKey(settings.baseUrl) && !settings.apiKey.trim()

  const handleFullGenerate = async () => {
    if (!description.trim()) {
      setGeneralError('Please enter a description for your character.')
      return
    }

    if (needsKey) {
      setGeneralError('No API key configured. Open Settings → Connection to add your API key.')
      return
    }

    setGeneralError(null)
    setIsGenerating(true)
    setLookupStatus('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      let finalDescription = description.trim()
      if (lookupOnline) {
        setLookupStatus('Searching MediaWiki (Wikipedia / Fandom) for canon reference…')
        try {
          const lookup = await lookupOnlineInfo(description.trim(), controller.signal)
          if (lookup?.content) {
            finalDescription = `[Internet reference notes:\n${lookup.content}]\n\n${finalDescription}`
            setLookupStatus(`Found reference notes from ${lookup.sources.length} sources.`)
          } else {
            setLookupStatus('No online articles found. Proceeding with creative generation.')
          }
        } catch {
          setLookupStatus('Online lookup bypassed.')
        }
      }

      const generated = await generateCharacterProfile({
        description: finalDescription,
        complexity,
        writingStyle,
        roleplayFocus,
        provider: {
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model:
            selectedProvider !== 'inherit' && selectedModel
              ? selectedModel
              : settings.model,
        },
        signal: controller.signal,
      })

      startTransition(() => {
        setProfile(generated)
        setIsGenerating(false)
      })
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setGeneralError(err.message || 'Generation failed. Please try again.')
      setIsGenerating(false)
    }
  }

  const handleRegenerateSection = async (sectionKey: CharacterSectionKey) => {
    if (!profile) return
    if (needsKey) {
      setSectionErrors((prev) => ({ ...prev, [sectionKey]: 'API key required' }))
      return
    }

    setActiveRegeneratingSection(sectionKey)
    setSectionErrors((prev) => {
      const next = { ...prev }
      delete next[sectionKey]
      return next
    })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const customInstruction = sectionInstructions[sectionKey] || ''
      const updatedValue = await regenerateCharacterSection({
        currentProfile: profile,
        sectionKey,
        originalDescription: description.trim() || profile.personality,
        customInstruction,
        provider: {
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
        },
        signal: controller.signal,
      })

      startTransition(() => {
        setProfile((prev) => {
          if (!prev) return null
          return {
            ...prev,
            [sectionKey]: updatedValue,
          }
        })
        setActiveRegeneratingSection(null)
        setSectionPromptOpen(null)
      })
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setSectionErrors((prev) => ({
        ...prev,
        [sectionKey]: err.message || 'Regeneration failed. Previous content preserved.',
      }))
      setActiveRegeneratingSection(null)
    }
  }

  const updateProfileField = (key: keyof GeneratedCharacterProfile, value: any) => {
    setProfile((prev) => {
      if (!prev) return null
      return { ...prev, [key]: value }
    })
  }

  const handleCopyPrompt = async () => {
    if (!profile) return
    const text = formatFullCharacterPrompt(profile)
    try {
      await navigator.clipboard.writeText(text)
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 2000)
    } catch {
      /* ignore */
    }
  }

  // Render provider status banner
  const renderProviderStatus = () => (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-surface/50 px-3.5 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-muted">AI Model:</span>
        <span className="font-mono font-medium text-fg">{settings.model || 'Default'}</span>
      </div>
      {needsKey ? (
        <button
          onClick={() => setUI({ settingsOpen: true, settingsTab: 'connection' })}
          className="btn btn-ghost text-xs text-amber-500 hover:text-amber-400 py-1 px-2.5 flex items-center gap-1.5"
        >
          <AlertCircle size={13} /> Set API Key in Settings
        </button>
      ) : (
        <button
          onClick={() => setUI({ settingsOpen: true, settingsTab: 'connection' })}
          className="btn btn-ghost text-2xs text-muted hover:text-fg py-0.5 px-2 flex items-center gap-1"
          title="Change provider or model"
        >
          <SettingsIcon size={12} /> Configure
        </button>
      )}
    </div>
  )

  // ==========================================
  // VIEW 1: Input & Configuration Screen
  // ==========================================
  if (!profile) {
    return (
      <div className="space-y-5 p-5">
        {renderProviderStatus()}

        {generalError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 p-3.5 text-xs text-danger">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Generation Error</p>
              <p className="mt-0.5 text-danger/90">{generalError}</p>
            </div>
            <button
              onClick={() => setGeneralError(null)}
              className="text-danger/70 hover:text-danger"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Character Description
            </label>
            <span className="text-2xs text-faint">
              {description.length > 0 ? `${description.length} characters` : 'Describe in natural language'}
            </span>
          </div>

          <div className="relative">
            <textarea
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isGenerating}
              rows={6}
              placeholder="Describe the character you want to create. Include their appearance, personality, background, behavior, or anything else you have in mind..."
              className="field scroll-thin resize-none text-sm leading-relaxed p-3.5"
            />
            {description.trim() && !isGenerating && (
              <button
                onClick={() => setDescription('')}
                className="absolute right-3 top-3 rounded-lg p-1 text-faint hover:text-fg transition"
                title="Clear input"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Example prompts */}
        <div className="space-y-1.5">
          <span className="text-2xs font-medium text-muted flex items-center gap-1">
            <Sparkles size={12} className="text-accent" /> Need inspiration? Try an example:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setDescription(prompt)}
                disabled={isGenerating}
                className="rounded-lg border border-border/80 bg-surface/60 px-2.5 py-1 text-2xs text-muted hover:border-accent/40 hover:bg-surface hover:text-fg transition text-left line-clamp-1 max-w-full"
                title={prompt}
              >
                {prompt.slice(0, 75)}…
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Advanced Generation Controls */}
        <div className="rounded-xl border border-border/80 bg-surface/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs text-muted hover:text-fg transition"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Sliders size={13} className="text-accent" />
              Generation Options (Optional)
            </span>
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAdvanced && (
            <div className="border-t border-border/60 p-3.5 space-y-3.5">
              {/* Complexity */}
              <div className="space-y-1.5">
                <label className="text-2xs font-semibold uppercase tracking-wider text-faint">
                  Detail Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'simple', label: 'Simple', desc: 'Concise & focused' },
                      { id: 'detailed', label: 'Detailed', desc: 'Balanced & rich' },
                      { id: 'very_detailed', label: 'Very Detailed', desc: 'Deep & nuanced' },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setComplexity(c.id)}
                      className={cn(
                        'flex flex-col items-center rounded-xl border p-2 text-center transition',
                        complexity === c.id
                          ? 'border-accent bg-accent/15 text-accent-contrast shadow-2xs font-medium'
                          : 'border-border/80 bg-surface hover:bg-surface-2 text-muted',
                      )}
                    >
                      <span className="text-xs">{c.label}</span>
                      <span className="text-3xs text-faint mt-0.5">{c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Writing Style */}
              <div className="space-y-1.5">
                <label className="text-2xs font-semibold uppercase tracking-wider text-faint">
                  Writing Style
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'standard', label: 'Standard' },
                      { id: 'literary', label: 'Literary & Evocative' },
                      { id: 'anime', label: 'Anime / Manga' },
                      { id: 'cinematic', label: 'Cinematic' },
                      { id: 'gritty', label: 'Gritty & Realistic' },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setWritingStyle(s.id)}
                      className={cn(
                        'chip',
                        writingStyle === s.id && 'chip-active',
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Roleplay Focus */}
              <div className="space-y-1.5">
                <label className="text-2xs font-semibold uppercase tracking-wider text-faint">
                  Character Archetype
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'roleplay', label: 'Roleplay Dialogue' },
                      { id: 'companion', label: 'Warm Companion' },
                      { id: 'adventure', label: 'Adventure / Combat' },
                      { id: 'general', label: 'Versatile Assistant' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setRoleplayFocus(f.id)}
                      className={cn(
                        'chip',
                        roleplayFocus === f.id && 'chip-active',
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lookup online & Model override */}
              <div className="pt-2 border-t border-border/60 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-muted hover:text-fg transition">
                  <input
                    type="checkbox"
                    checked={lookupOnline}
                    onChange={(e) => setLookupOnline(e.target.checked)}
                    className="size-3.5 rounded accent-accent"
                  />
                  <Search size={13} className="text-accent" />
                  <span>Look up canon backstory & lore online (Wikipedia / Fandom)</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-3xs font-semibold uppercase text-faint mb-1">
                      Provider Override
                    </label>
                    <select
                      value={selectedProvider}
                      onChange={(e) => {
                        const val = e.target.value
                        setSelectedProvider(val)
                        setSelectedModel(MODEL_SUGGESTIONS[val]?.[0] || '')
                      }}
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-2xs text-fg outline-none"
                    >
                      <option value="inherit">Global Default</option>
                      {PROVIDER_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedProvider !== 'inherit' && (
                    <div>
                      <label className="block text-3xs font-semibold uppercase text-faint mb-1">
                        Model
                      </label>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-2xs text-fg font-mono outline-none"
                      >
                        {(MODEL_SUGGESTIONS[selectedProvider] || []).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {lookupStatus && (
          <p className="text-2xs text-accent italic px-1">{lookupStatus}</p>
        )}

        {/* Action button */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
          {isGenerating ? (
            <button
              type="button"
              onClick={handleCancelGeneration}
              className="btn border-danger/40 text-danger hover:bg-danger/10 flex items-center gap-1.5"
            >
              <X size={15} />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="btn"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleFullGenerate}
            disabled={isGenerating || !description.trim() || needsKey}
            className="btn btn-accent flex items-center gap-2 px-5 py-2.5 shadow-sm"
          >
            {isGenerating ? (
              <>
                <RefreshCw size={15} className="animate-spin text-accent-fg" />
                <span>Crafting Character…</span>
              </>
            ) : (
              <>
                <Wand2 size={15} />
                <span>Generate Character</span>
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW 2: Generated Character Preview Screen
  // ==========================================
  return (
    <div className="space-y-5 p-5">
      {/* Top Banner Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface/70 p-4 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (confirm('Return to description input? Your current generated character will be retained.')) {
                setProfile(null)
              }
            }}
            className="btn btn-ghost size-9 rounded-xl p-0 shrink-0 text-muted hover:text-fg"
            title="Return to description"
            aria-label="Back to description"
          >
            <ArrowLeft size={16} />
          </button>

          {/* Avatar and basic info */}
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-xs ring-1 ring-border/80"
            style={{ backgroundColor: profile.avatarColor || SWATCHES[0] }}
          >
            {profile.avatar || '✨'}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <input
                value={profile.name}
                onChange={(e) => updateProfileField('name', e.target.value)}
                placeholder="Character Name"
                className="font-display text-base font-semibold text-fg bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none px-1 py-0.5 rounded transition"
              />
              <span className="chip text-3xs font-medium shrink-0">
                {profile.age ? `${profile.age} yrs` : '18+'} · {profile.gender || 'Any'}
              </span>
            </div>
            <input
              value={profile.tagline}
              onChange={(e) => updateProfileField('tagline', e.target.value)}
              placeholder="Tagline or short epithet"
              className="text-xs text-muted bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none px-1 py-0.5 w-full rounded transition truncate"
            />
          </div>
        </div>

        {/* Global actions: Copy Prompt & Regenerate All */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="btn btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5 text-muted hover:text-fg"
            title="Copy full character prompt"
          >
            {copiedPrompt ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            <span>{copiedPrompt ? 'Copied!' : 'Copy Prompt'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm('Regenerate the entire character from your initial description?')) {
                handleFullGenerate()
              }
            }}
            disabled={isGenerating}
            className="btn btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5 text-muted hover:text-fg"
            title="Regenerate whole profile"
          >
            <RefreshCw size={13} className={cn(isGenerating && 'animate-spin')} />
            <span>Regenerate All</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {generalError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div className="flex-1">{generalError}</div>
          <button onClick={() => setGeneralError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Quick Visuals & Basic Attributes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Colors & Avatar */}
        <div className="rounded-xl border border-border/80 bg-surface/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-muted">
              Color & Avatar
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={profile.avatar}
              onChange={(e) => updateProfileField('avatar', e.target.value.slice(0, 4))}
              className="field w-12 text-center text-lg p-1"
              placeholder="✨"
              title="Emoji avatar"
            />
            <div className="flex flex-wrap gap-1 flex-1">
              {SWATCHES.slice(0, 10).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => updateProfileField('avatarColor', c)}
                  className={cn(
                    'size-6 rounded-full border transition',
                    profile.avatarColor === c ? 'border-fg scale-110 shadow-xs' : 'border-transparent',
                  )}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Quick Age & Gender */}
        <div className="rounded-xl border border-border/80 bg-surface/50 p-3 space-y-2">
          <span className="text-2xs font-semibold uppercase tracking-wider text-muted">
            Age & Gender
          </span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                value={profile.age}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '').slice(0, 3)
                  updateProfileField('age', cleaned)
                }}
                onBlur={() => {
                  const n = Number(profile.age) || MIN_AGE
                  updateProfileField('age', String(Math.max(MIN_AGE, Math.min(120, n))))
                }}
                placeholder="Age"
                className="field text-xs py-1"
              />
            </div>
            <div>
              <input
                value={profile.gender}
                onChange={(e) => updateProfileField('gender', e.target.value)}
                placeholder="Gender"
                className="field text-xs py-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tags section */}
      <div className="rounded-xl border border-border/80 bg-surface/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
            <Hash size={12} /> Tags & Keywords
          </span>
          <button
            type="button"
            onClick={() => handleRegenerateSection('tags')}
            disabled={activeRegeneratingSection === 'tags'}
            className="btn btn-ghost text-2xs py-0.5 px-2 text-muted hover:text-fg flex items-center gap-1"
          >
            <RefreshCw
              size={11}
              className={cn(activeRegeneratingSection === 'tags' && 'animate-spin text-accent')}
            />
            <span>Regenerate Tags</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {profile.tags.map((t, idx) => (
            <span key={idx} className="chip">
              {t}
              <button
                type="button"
                onClick={() =>
                  updateProfileField(
                    'tags',
                    profile.tags.filter((_, i) => i !== idx),
                  )
                }
                className="hover:text-danger"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <input
            placeholder="Add tag (press Enter)..."
            className="text-xs bg-transparent border-none outline-none py-1 px-1.5 min-w-[120px] text-fg placeholder:text-faint"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const val = (e.target as HTMLInputElement).value.trim().toLowerCase()
                if (val && !profile.tags.includes(val)) {
                  updateProfileField('tags', [...profile.tags, val])
                  ;(e.target as HTMLInputElement).value = ''
                }
              }
            }}
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* INDIVIDUAL SECTION PREVIEW CARDS WITH INDEPENDENT REGEN */}
      {/* ======================================================== */}
      <div className="space-y-4">
        {CHARACTER_SECTIONS.map((sec) => {
          const isRegenerating = activeRegeneratingSection === sec.key
          const isPromptOpen = sectionPromptOpen === sec.key
          const sectionError = sectionErrors[sec.key]
          const currentValue = profile[sec.key] as string

          return (
            <div
              key={sec.key}
              className={cn(
                'relative rounded-2xl border bg-surface/50 transition shadow-2xs',
                isRegenerating ? 'border-accent/60 bg-surface/80 ring-1 ring-accent/30' : 'border-border/80',
              )}
            >
              {/* Section Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-display text-xs font-semibold text-fg">
                      {sec.label}
                    </h3>
                  </div>
                  <p className="text-3xs text-faint truncate">{sec.description}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Toggle Custom Directive Box */}
                  <button
                    type="button"
                    onClick={() =>
                      setSectionPromptOpen(isPromptOpen ? null : sec.key)
                    }
                    className={cn(
                      'btn btn-ghost text-2xs py-1 px-2 rounded-lg text-muted hover:text-fg flex items-center gap-1',
                      isPromptOpen && 'bg-surface-2 text-accent',
                    )}
                    title="Add custom instructions for regenerating this section"
                  >
                    <Sliders size={12} />
                    <span className="hidden sm:inline">Refine Prompt</span>
                  </button>

                  {/* Immediate Regenerate Section Button */}
                  <button
                    type="button"
                    onClick={() => handleRegenerateSection(sec.key)}
                    disabled={isRegenerating || activeRegeneratingSection !== null}
                    className="btn btn-ghost text-2xs py-1 px-2.5 rounded-lg border border-border/80 bg-surface text-muted hover:border-accent/40 hover:bg-surface-2 hover:text-fg transition flex items-center gap-1.5 shadow-2xs"
                    title={`Regenerate ${sec.label} only`}
                  >
                    <RefreshCw
                      size={12}
                      className={cn(isRegenerating && 'animate-spin text-accent')}
                    />
                    <span>{isRegenerating ? 'Regenerating…' : 'Regenerate'}</span>
                  </button>
                </div>
              </div>

              {/* Optional Custom Instructions Input Box */}
              {isPromptOpen && (
                <div className="border-b border-border/60 bg-surface-2/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-medium text-muted flex items-center gap-1">
                      <HelpCircle size={12} className="text-accent" />
                      Specific instruction for {sec.label}:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSectionPromptOpen(null)}
                      className="text-faint hover:text-fg text-2xs"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={sectionInstructions[sec.key] || ''}
                      onChange={(e) =>
                        setSectionInstructions((prev) => ({
                          ...prev,
                          [sec.key]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleRegenerateSection(sec.key)
                        }
                      }}
                      placeholder={`e.g. "Make this darker and more mysterious..."`}
                      className="field text-xs py-1.5 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleRegenerateSection(sec.key)}
                      disabled={isRegenerating || activeRegeneratingSection !== null}
                      className="btn btn-accent text-xs px-3 py-1.5 shrink-0"
                    >
                      <Sparkles size={12} /> Apply & Regenerate
                    </button>
                  </div>
                </div>
              )}

              {/* Section-level error notice */}
              {sectionError && (
                <div className="m-3 flex items-center justify-between rounded-lg bg-danger/10 p-2 text-2xs text-danger border border-danger/30">
                  <span>{sectionError}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSectionErrors((prev) => {
                        const next = { ...prev }
                        delete next[sec.key]
                        return next
                      })
                    }
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Section Content Area (Directly editable) */}
              <div className="p-3.5">
                <textarea
                  value={currentValue}
                  onChange={(e) => updateProfileField(sec.key, e.target.value)}
                  disabled={isRegenerating}
                  rows={sec.rows || 3}
                  placeholder={sec.placeholder}
                  className="field scroll-thin resize-none text-xs leading-relaxed w-full p-2.5 font-sans"
                />
              </div>

              {/* Section Loading Overlay */}
              {isRegenerating && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-bg/70 backdrop-blur-xs">
                  <div className="flex items-center gap-2 rounded-xl border border-accent/40 bg-surface px-3 py-2 text-xs font-medium text-fg shadow-lg">
                    <RefreshCw size={14} className="animate-spin text-accent" />
                    <span>Regenerating {sec.label}…</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ======================================================== */}
      {/* FINAL ACTION BAR: Create Character / Edit in Form */}
      {/* ======================================================== */}
      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface/90 backdrop-blur-md p-4 shadow-xl">
        <button
          type="button"
          onClick={() => setProfile(null)}
          className="btn btn-ghost text-xs text-muted hover:text-fg"
        >
          <ArrowLeft size={14} /> Back to Prompt
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => onApplyToForm(profile)}
            className="btn text-xs py-2 px-3.5"
            title="Transfer these values into the manual character editor"
          >
            Review & Edit in Form
          </button>

          <button
            type="button"
            onClick={() => onSaveOnly(profile)}
            className="btn text-xs py-2 px-3.5"
          >
            Save Character
          </button>

          <button
            type="button"
            onClick={() => onCreateAndChat(profile)}
            className="btn btn-accent text-xs py-2 px-4 shadow-sm flex items-center gap-1.5"
          >
            <MessageSquare size={14} />
            <span>Create & Chat</span>
          </button>
        </div>
      </div>
    </div>
  )
}
