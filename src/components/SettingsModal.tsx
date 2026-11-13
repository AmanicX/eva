import { useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Moon,
  Palette,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Terminal,
  Trash2,
  Upload,
  User,
  Wand2,
  Zap,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  GROQ_MODELS,
  PROVIDER_PRESETS,
  DEFAULT_BASE_URL,
  listGroqModels,
  providerNeedsKey,
  presetIdFor,
  suggestionsFor,
} from '@/lib/groq'
import { THEMES, THEME_ORDER } from '@/data/themes'
import appIcon from '@/assets/icon.png'
import {
  CURATED_PALETTES,
  applyThemeTokens,
  deriveContrastColor,
  isValidHex,
} from '@/data/palettes'
import { Modal } from './Modal'
import { CommandCheatsheet } from './CommandCheatsheet'
import { cn, clamp, download } from '@/lib/utils'
import type { AppearanceMode } from '@/types'
import type { UIState } from '@/store/useStore'

const TABS: { id: UIState['settingsTab']; label: string; icon: React.ReactNode }[] = [
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  { id: 'connection', label: 'Connection', icon: <KeyRound size={16} /> },
  { id: 'persona', label: 'Persona', icon: <User size={16} /> },
  { id: 'themes', label: 'Modes', icon: <Sparkles size={16} /> },
  { id: 'commands', label: 'Commands', icon: <Terminal size={16} /> },
  { id: 'data', label: 'Data', icon: <Database size={16} /> },
]

export function SettingsModal() {
  const settings = useStore((s) => s.settings)
  const ui = useStore((s) => s.ui)
  const updateSettings = useStore((s) => s.updateSettings)
  const setUI = useStore((s) => s.setUI)
  const setTheme = useStore((s) => s.setTheme)
  const characters = useStore((s) => s.characters)
  const conversations = useStore((s) => s.conversations)
  const worlds = useStore((s) => s.worlds)
  const replaceAll = useStore((s) => s.replaceAll)

  const open = ui.settingsOpen
  const tab = ui.settingsTab
  const [showKey, setShowKey] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const needsKey = providerNeedsKey(settings.baseUrl)
  const activePreset = PROVIDER_PRESETS.find((p) => p.baseUrl === settings.baseUrl.trim())
  const presetId = presetIdFor(settings.baseUrl)
  const curated = GROQ_MODELS.find((m) => m.id === settings.model)

  const modelOptions = Array.from(
    new Set([
      ...suggestionsFor(settings.baseUrl),
      ...settings.cachedModels,
      ...GROQ_MODELS.map((m) => m.id),
      settings.model,
    ]),
  ).filter(Boolean)
  const shownModels = modelOptions.filter((m) =>
    m.toLowerCase().includes(modelFilter.trim().toLowerCase()),
  )

  const testConnection = async () => {
    if (needsKey && !settings.apiKey.trim()) {
      setTestState('fail')
      setTestMsg('Add an API key first.')
      return
    }
    setTestState('testing')
    setTestMsg('')
    try {
      const list = await listGroqModels(settings.apiKey, settings.baseUrl)
      updateSettings({ cachedModels: list })
      setTestState('ok')
      setTestMsg(`Connected successfully · ${list.length} models available`)
    } catch (e) {
      setTestState('fail')
      setTestMsg(e instanceof Error ? e.message : 'Connection failed')
    }
  }

  const exportData = () => {
    // SECURITY: Strip sensitive credentials before exporting backups
    const sanitizedSettings = { ...settings, apiKey: '' }
    download(
      `nexus-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ settings: sanitizedSettings, characters, worlds, conversations }, null, 2),
    )
  }

  const importData = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      // If importing an external file, preserve user's active API key unless explicitly supplied
      if (parsed?.settings && !parsed.settings.apiKey) {
        parsed.settings.apiKey = settings.apiKey
      }
      replaceAll(parsed)
    } catch {
      alert('Could not read that backup file.')
    }
  }

  // Appearance handlers
  const handleModeChange = (mode: AppearanceMode) => {
    updateSettings({ appearanceMode: mode })
    applyThemeTokens(
      mode,
      settings.theme,
      settings.customAccentColor,
      settings.customContrastColor,
      settings.frostedGlass,
    )
  }

  const handlePaletteSelect = (paletteId: string) => {
    const p = CURATED_PALETTES.find((pal) => pal.id === paletteId)
    if (!p) return
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
    applyThemeTokens(settings.appearanceMode, settings.theme, p.primary, p.contrast, settings.frostedGlass)
  }

  const handleCustomPrimary = (hex: string) => {
    const nextAccents = {
      ...settings.themeAccents,
      [settings.theme]: {
        paletteId: 'custom',
        primary: hex,
        contrast: settings.customContrastColor,
      },
    }
    updateSettings({
      accentPalette: 'custom',
      customAccentColor: hex,
      themeAccents: nextAccents,
    })
    if (isValidHex(hex)) {
      applyThemeTokens(
        settings.appearanceMode,
        settings.theme,
        hex,
        settings.customContrastColor,
        settings.frostedGlass,
      )
    }
  }

  const handleCustomContrast = (hex: string) => {
    const nextAccents = {
      ...settings.themeAccents,
      [settings.theme]: {
        paletteId: 'custom',
        primary: settings.customAccentColor,
        contrast: hex,
      },
    }
    updateSettings({
      accentPalette: 'custom',
      customContrastColor: hex,
      themeAccents: nextAccents,
    })
    if (isValidHex(hex)) {
      applyThemeTokens(
        settings.appearanceMode,
        settings.theme,
        settings.customAccentColor,
        hex,
        settings.frostedGlass,
      )
    }
  }

  const handleAutoDeriveContrast = () => {
    const contrast = deriveContrastColor(settings.customAccentColor)
    handleCustomContrast(contrast)
  }

  const handleFrostedToggle = (enabled: boolean) => {
    updateSettings({ frostedGlass: enabled })
    applyThemeTokens(
      settings.appearanceMode,
      settings.theme,
      settings.customAccentColor,
      settings.customContrastColor,
      enabled,
    )
  }

  return (
    <Modal
      open={open}
      onClose={() => setUI({ settingsOpen: false })}
      title="Settings"
      subtitle="Configure studio, appearance & AI models"
      icon={<Zap size={18} />}
      size="lg"
      bodyClassName="p-0"
    >
      <div className="flex min-h-[58dvh] flex-col sm:flex-row">
        {/* Navigation Sidebar */}
        <nav className="scrollbar-none flex gap-1 overflow-x-auto border-b border-border p-2 sm:w-44 sm:shrink-0 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0 sm:p-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setUI({ settingsTab: t.id })}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition',
                tab === t.id
                  ? 'bg-surface-3 text-fg'
                  : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content Body */}
        <div className="scroll-thin max-h-[64dvh] flex-1 overflow-y-auto p-5 sm:p-6">
          {/* ============================================================== */}
          {/* APPEARANCE TAB */}
          {/* ============================================================== */}
          {tab === 'appearance' && (
            <div className="space-y-6">
              {/* Appearance Mode */}
              <Section
                title="Appearance Mode"
                hint="Deep obsidian black, clean paper light, or follow your operating system."
              >
                <div className="seg grid w-full grid-cols-3">
                  <button
                    data-active={settings.appearanceMode === 'dark'}
                    onClick={() => handleModeChange('dark')}
                    className="flex items-center justify-center gap-2"
                  >
                    <Moon size={15} /> Dark
                  </button>
                  <button
                    data-active={settings.appearanceMode === 'light'}
                    onClick={() => handleModeChange('light')}
                    className="flex items-center justify-center gap-2"
                  >
                    <Sun size={15} /> Light
                  </button>
                  <button
                    data-active={settings.appearanceMode === 'system'}
                    onClick={() => handleModeChange('system')}
                    className="flex items-center justify-center gap-2"
                  >
                    <Zap size={15} /> System
                  </button>
                </div>
              </Section>

              {/* Accent Themes */}
              <Section
                title="Accent Palette"
                hint={`Active for ${THEMES[settings.theme].name} mode. Nexus remembers accent colors per mode.`}
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CURATED_PALETTES.map((p) => {
                    const active = settings.accentPalette === p.id
                    return (
                      <button
                        key={p.id}
                        onClick={() => handlePaletteSelect(p.id)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-xs transition',
                          active
                            ? 'border-accent bg-accent/10 text-fg font-semibold'
                            : 'border-border bg-surface hover:bg-surface-2 text-muted',
                        )}
                      >
                        <div className="flex -space-x-1.5 shrink-0">
                          <span
                            className="size-4 rounded-full border border-black/20 shadow-sm"
                            style={{ backgroundColor: p.primary }}
                          />
                          <span
                            className="size-4 rounded-full border border-black/20 shadow-sm"
                            style={{ backgroundColor: p.contrast }}
                          />
                        </div>
                        <span className="truncate">{p.label}</span>
                        {active && <Check size={14} className="ml-auto text-accent shrink-0" />}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => updateSettings({ accentPalette: 'custom' })}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-xs transition',
                      settings.accentPalette === 'custom'
                        ? 'border-accent bg-accent/10 text-fg font-semibold'
                        : 'border-border bg-surface hover:bg-surface-2 text-muted',
                    )}
                  >
                    <Palette size={16} className="text-accent shrink-0" />
                    <span>Custom</span>
                    {settings.accentPalette === 'custom' && (
                      <Check size={14} className="ml-auto text-accent shrink-0" />
                    )}
                  </button>
                </div>
              </Section>

              {/* Custom Accent & Contrast Picker */}
              <Section
                title="Custom Colors & Contrast"
                hint="Fine-tune your 10% primary accent and its complementary secondary contrast."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Primary Accent */}
                  <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
                    <span className="text-xs font-medium text-muted block">Primary Accent</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.customAccentColor}
                        onChange={(e) => handleCustomPrimary(e.target.value)}
                        className="size-8 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={settings.customAccentColor}
                        onChange={(e) => handleCustomPrimary(e.target.value)}
                        placeholder="#0a84ff"
                        className="field font-mono text-xs uppercase"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Contrast Accent */}
                  <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted">Contrast Color</span>
                      <button
                        onClick={handleAutoDeriveContrast}
                        className="flex items-center gap-1 text-2xs text-accent hover:underline"
                        title="Calculate harmonious analogous contrast"
                      >
                        <Wand2 size={12} /> Auto-derive
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.customContrastColor}
                        onChange={(e) => handleCustomContrast(e.target.value)}
                        className="size-8 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={settings.customContrastColor}
                        onChange={(e) => handleCustomContrast(e.target.value)}
                        placeholder="#38bdf8"
                        className="field font-mono text-xs uppercase"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
              </Section>

              {/* Frosted Glass Setting */}
              <Section
                title="Material & Frosted Glass"
                hint="Controlled background blur on floating panels and headers. Disable for solid, high-contrast surfaces."
              >
                <Toggle
                  label="Enable Frosted Glass"
                  desc={
                    settings.frostedGlass
                      ? 'Subtle translucency & backdrop blur enabled on overlays and header surfaces.'
                      : 'Solid opaque surfaces enabled everywhere for crisp readability.'
                  }
                  checked={settings.frostedGlass}
                  onChange={handleFrostedToggle}
                />
              </Section>

              {/* Live Design System Preview Card */}
              <Section title="Live Preview" hint="How your current combination renders in Nexus.">
                <div className="rounded-2xl border border-border/80 material p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={appIcon}
                      alt="Nexus"
                      className="size-10 rounded-xl object-cover shadow-md ring-1 ring-border/80 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-fg">Component Tokens</span>
                        <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-2xs font-semibold text-accent border border-accent/25">
                          Accent Active
                        </span>
                      </div>
                      <p className="text-2xs text-muted">
                        Nexus balances a 60% neutral foundation with 30% structured typography and 10%
                        accent highlights.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button className="btn btn-accent text-xs px-3.5 py-2">
                      Primary Action
                    </button>
                    <button className="btn text-xs px-3.5 py-2">
                      Secondary Surface
                    </button>
                    <span
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--c-contrast-surface)',
                        color: 'var(--c-accent-contrast)',
                        border: '1px solid var(--c-contrast-border)',
                      }}
                    >
                      Contrast Highlight
                    </span>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {/* ============================================================== */}
          {/* CONNECTION TAB */}
          {/* ============================================================== */}
          {tab === 'connection' && (
            <div className="space-y-5">
              <Section
                title="Provider"
                hint="Groq, Ollama Cloud (Gemma 4), OpenRouter, local models or custom endpoints."
              >
                <div className="flex flex-wrap gap-1.5">
                  {PROVIDER_PRESETS.map((p) => {
                    const active = settings.baseUrl.trim() === p.baseUrl
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          updateSettings({ baseUrl: p.baseUrl })
                          // If Ollama Cloud, suggest gemma4 if no model or default
                          if (p.id === 'ollamacloud' && (!settings.model || settings.model.includes('gpt-oss'))) {
                            updateSettings({ model: 'gemma4' })
                          }
                        }}
                        className={cn('chip', active && 'chip-active')}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
                <input
                  type="text"
                  value={settings.baseUrl}
                  onChange={(e) => updateSettings({ baseUrl: e.target.value })}
                  placeholder={DEFAULT_BASE_URL}
                  className="field font-mono text-xs"
                  spellCheck={false}
                />
                <p className="text-2xs text-faint">
                  {presetId === 'ollamacloud' ? (
                    <>
                      Ollama Cloud endpoints host hosted models (e.g. Gemma 4 31B, Llama 3.3). Usage is metered per token (~$0.14 in / $0.40 out per 1M tokens; free tier has starter usage). Get your API key at{' '}
                      <a
                        href="https://ollama.com/settings/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline underline-offset-2"
                      >
                        ollama.com/settings/keys
                      </a>
                      .
                    </>
                  ) : (
                    'Any OpenAI-compatible server works. Groq, Ollama Cloud, OpenRouter, LM Studio, or local Ollama.'
                  )}
                </p>
              </Section>

              <Section
                title={needsKey ? 'API key' : 'API key (optional)'}
                hint={
                  needsKey
                    ? 'Stored securely on this device and sent only to the provider above.'
                    : 'Local servers usually ignore the key — leave it blank.'
                }
              >
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={settings.apiKey}
                      onChange={(e) => updateSettings({ apiKey: e.target.value })}
                      placeholder={activePreset?.keyHint ?? 'your key'}
                      className="field pr-12 font-mono text-xs sm:pr-9"
                      spellCheck={false}
                    />
                    <button
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-faint hover:text-fg"
                      aria-label={showKey ? 'Hide API key' : 'Show API key'}
                      title={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button
                    onClick={testConnection}
                    className="btn shrink-0"
                    disabled={testState === 'testing'}
                  >
                    {testState === 'testing' ? (
                      <RefreshCw size={15} className="animate-spin text-accent" />
                    ) : (
                      <Zap size={15} />
                    )}
                    Test
                  </button>
                </div>
                {testState !== 'idle' && (
                  <p
                    className={cn(
                      'flex items-center gap-1.5 text-xs',
                      testState === 'ok'
                        ? 'text-[#30d158]'
                        : testState === 'fail'
                          ? 'text-danger'
                          : 'text-muted',
                    )}
                  >
                    {testState === 'ok' ? <Check size={13} /> : <AlertCircle size={13} />}
                    {testMsg || 'Testing connection…'}
                  </p>
                )}
                <p className="text-2xs text-faint">
                  {activePreset?.keyUrl ? (
                    <>
                      Get an API key at{' '}
                      <a
                        href={activePreset.keyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline underline-offset-2"
                      >
                        {activePreset.keyUrl.replace(/^https?:\/\//, '')}
                      </a>
                      .
                    </>
                  ) : needsKey ? (
                    'Paste the API key for the chosen provider.'
                  ) : (
                    'No key needed for this local endpoint.'
                  )}
                </p>
              </Section>

              <Section
                title="Model"
                hint={curated?.note ?? 'Type or select any model supported by your provider.'}
              >
                <div className="flex gap-2">
                  <input
                    value={settings.model}
                    onChange={(e) => updateSettings({ model: e.target.value })}
                    placeholder="model identifier (e.g. gemma4, openai/gpt-oss-20b)"
                    className="field font-mono text-xs"
                    spellCheck={false}
                  />
                  <button
                    onClick={testConnection}
                    disabled={testState === 'testing'}
                    className="btn shrink-0"
                    title="Fetch model list from provider"
                  >
                    <RefreshCw size={15} className={cn(testState === 'testing' && 'animate-spin')} />
                  </button>
                </div>

                <div className="relative">
                  <Search size={13} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
                  <input
                    value={modelFilter}
                    onChange={(e) => setModelFilter(e.target.value)}
                    placeholder={`Filter ${modelOptions.length} available models…`}
                    className="field pl-8 text-xs"
                  />
                </div>

                <div className="scroll-thin max-h-44 overflow-y-auto rounded-xl border border-border">
                  {shownModels.map((m) => (
                    <button
                      key={m}
                      onClick={() => updateSettings({ model: m })}
                      className={cn(
                        'flex w-full items-center gap-2 border-b border-border/60 px-3 py-2.5 text-left font-mono text-xs transition last:border-0 hover:bg-surface-2',
                        settings.model === m && 'bg-surface-2 text-accent font-semibold',
                      )}
                    >
                      <span className="truncate">{m}</span>
                      {settings.model === m && <Check size={13} className="ml-auto shrink-0" />}
                    </button>
                  ))}
                  {shownModels.length === 0 && (
                    <p className="px-3 py-3 text-2xs text-faint">
                      No models listed — click ↻ to query available models from your provider.
                    </p>
                  )}
                </div>

                <p className="text-2xs text-faint">
                  {presetId === 'ollamacloud'
                    ? 'Ollama Cloud supports Google Gemma 4 (gemma4, gemma4:e4b, gemma4:31b). Select a model above or fetch live models.'
                    : presetId === 'ollama'
                      ? 'Local Ollama: run "ollama serve", pull models (e.g. "ollama pull gemma4"), then click ↻.'
                      : 'Providers cap tokens per minute. If you hit a rate limit, wait a few seconds and retry.'}
                </p>
              </Section>

              <Section title="Generation Parameters">
                <Slider
                  label="Temperature"
                  value={settings.temperature}
                  min={0}
                  max={2}
                  step={0.05}
                  onChange={(v) => updateSettings({ temperature: v })}
                  display={settings.temperature.toFixed(2)}
                />
                <Slider
                  label="Top P"
                  value={settings.topP}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => updateSettings({ topP: v })}
                  display={settings.topP.toFixed(2)}
                />
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">Max tokens</span>
                  <input
                    type="number"
                    min={256}
                    max={8192}
                    step={128}
                    value={settings.maxTokens}
                    onChange={(e) =>
                      updateSettings({
                        maxTokens: clamp(Number(e.target.value) || 2048, 256, 8192),
                      })
                    }
                    className="field tabular-nums"
                  />
                </label>
              </Section>

              <Section title="Behaviour">
                <Toggle
                  label="Stream responses"
                  desc="Display text tokens incrementally as they are generated."
                  checked={settings.streaming}
                  onChange={(v) => updateSettings({ streaming: v })}
                />
                <Toggle
                  label="Automatic conversation memory"
                  desc="Continuously summarize conversations to preserve narrative continuity."
                  checked={settings.memoryEnabled}
                  onChange={(v) => updateSettings({ memoryEnabled: v })}
                />
              </Section>
            </div>
          )}

          {/* ============================================================== */}
          {/* PERSONA TAB */}
          {/* ============================================================== */}
          {tab === 'persona' && (
            <div className="space-y-5">
              <Section
                title="Universal system prompt"
                hint="Master instructions applied across every character in every mode."
              >
                <textarea
                  value={settings.globalSystemPrompt}
                  onChange={(e) => updateSettings({ globalSystemPrompt: e.target.value })}
                  rows={6}
                  className="field scroll-thin resize-none text-xs leading-relaxed"
                />
              </Section>

              <Section
                title="User Persona"
                hint="Defines your identity, preferences, and standing to every character."
              >
                <textarea
                  value={settings.userPersona}
                  onChange={(e) => updateSettings({ userPersona: e.target.value })}
                  rows={5}
                  className="field scroll-thin resize-none text-xs leading-relaxed"
                  placeholder="Describe yourself…"
                />
                <p className="text-2xs text-faint">
                  In World mode, your specific role and appearance are defined per world.
                </p>
              </Section>
            </div>
          )}

          {/* ============================================================== */}
          {/* MODES TAB */}
          {/* ============================================================== */}
          {tab === 'themes' && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Each mode is an isolated experience. Characters and conversations remain strictly
                within their mode.
              </p>
              {THEME_ORDER.map((id) => {
                const t = THEMES[id]
                const active = settings.theme === id
                return (
                  <div
                    key={id}
                    className={cn(
                      'rounded-2xl border p-4 transition',
                      active ? 'border-accent bg-accent/5' : 'border-border bg-surface',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-10 items-center justify-center rounded-xl bg-accent-grad text-accent-fg font-bold"
                        style={{ fontSize: 18 }}
                      >
                        {t.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-display font-semibold text-fg">{t.name}</h4>
                          <span className="text-2xs text-faint">{t.tagline}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted leading-relaxed">{t.blurb}</p>
                      </div>
                      <button
                        onClick={() => setTheme(id)}
                        disabled={active}
                        className={cn('btn shrink-0', active && 'opacity-60')}
                      >
                        {active ? 'Active' : 'Switch'}
                      </button>
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {t.features.map((f) => (
                        <li key={f} className="chip text-2xs">
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}

          {/* ============================================================== */}
          {/* COMMANDS TAB */}
          {/* ============================================================== */}
          {tab === 'commands' && (
            <div className="space-y-4">
              <p className="text-sm text-muted leading-relaxed">
                Direct rich scenes by embedding these command tags inside your messages.
              </p>
              <CommandCheatsheet />
            </div>
          )}

          {/* ============================================================== */}
          {/* DATA TAB */}
          {/* ============================================================== */}
          {tab === 'data' && (
            <div className="space-y-5">
              <Section title="Local Storage Workspace" hint="All data lives private and local on this device.">
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Characters" value={characters.length} />
                  <Stat label="Worlds" value={worlds.length} />
                  <Stat label="Chats" value={conversations.length} />
                </div>
              </Section>

              <Section title="Guided Tour" hint="Reopen the first-run orientation guide.">
                <button
                  onClick={() => setUI({ settingsOpen: false, welcomeOpen: true })}
                  className="btn"
                >
                  <Sparkles size={15} /> Show orientation tour
                </button>
              </Section>

              <Section title="Backup & Restore">
                <div className="flex flex-wrap gap-2">
                  <button onClick={exportData} className="btn">
                    <Download size={15} /> Export JSON backup
                  </button>
                  <button onClick={() => fileRef.current?.click()} className="btn">
                    <Upload size={15} /> Import backup
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void importData(f)
                      e.target.value = ''
                    }}
                  />
                </div>
              </Section>

              <Section title="Danger Zone">
                <button
                  onClick={() => {
                    if (
                      confirm(
                        'Erase ALL characters, worlds, chats and custom settings? This action is irreversible.',
                      )
                    ) {
                      localStorage.removeItem('nexus-chat-store')
                      location.reload()
                    }
                  }}
                  className="btn border-danger/40 text-danger hover:bg-danger/10"
                >
                  <Trash2 size={15} /> Erase everything
                </button>
              </Section>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Cpu size={13} className="text-faint" />
          {title}
        </h3>
        {hint && <p className="mt-0.5 text-2xs text-faint leading-relaxed">{hint}</p>}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs text-muted">
        {label}
        <span className="font-mono text-fg tabular-nums">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  )
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 text-left transition hover:border-border-strong"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-fg">{label}</div>
        <div className="text-2xs text-faint mt-0.5 leading-relaxed">{desc}</div>
      </div>
      <span className="switch" data-on={checked}>
        <span />
      </span>
    </button>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5 text-center">
      <div className="font-display text-xl font-bold tabular-nums text-fg">{value}</div>
      <div className="text-2xs text-faint mt-0.5">{label}</div>
    </div>
  )
}
