import { useEffect, useState } from 'react'
import { AlertCircle, Check, Image as ImageIcon, Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react'
import { Modal } from './Modal'
import { useStore } from '@/store/useStore'
import { generateSceneSuggestions, type SceneSuggestion } from '@/lib/sceneGenerator'
import {
  generateImage,
  POLLINATIONS_IMAGE_MODELS,
  GOOGLE_IMAGE_MODELS,
} from '@/lib/imageGeneration'
import { cn, uid } from '@/lib/utils'

interface SceneModalProps {
  open: boolean
  onClose: () => void
}

export function SceneModal({ open, onClose }: SceneModalProps) {
  const activeConversationId = useStore((s) => s.activeConversationId)
  const conversation = useStore((s) =>
    s.conversations.find((c) => c.id === s.activeConversationId),
  )
  const character = useStore((s) =>
    s.characters.find((c) => c.id === conversation?.characterId),
  )
  const world = useStore((s) => s.worlds.find((w) => w.id === conversation?.worldId))
  const settings = useStore((s) => s.settings)
  const addMessage = useStore((s) => s.addMessage)

  const [suggestions, setSuggestions] = useState<SceneSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<SceneSuggestion | null>(null)
  const [promptText, setPromptText] = useState('')
  const [providerId, setProviderId] = useState<string>('pollinations')
  const [model, setModel] = useState<string>('flux')
  const [generating, setGenerating] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Initialize provider and model from conversation or settings
  useEffect(() => {
    if (!open) return
    const initialProvider =
      conversation?.imageConfig?.providerId ||
      settings.imageDefault?.providerId ||
      'pollinations'
    const initialModel =
      conversation?.imageConfig?.model ||
      settings.imageDefault?.model ||
      (initialProvider === 'google' ? 'imagen-3.0-generate-002' : 'flux')

    setProviderId(initialProvider)
    setModel(initialModel)
  }, [open, conversation, settings])

  // Load suggestions when opened
  useEffect(() => {
    if (!open || !conversation) return
    loadSuggestions()
  }, [open, conversation?.id])

  const loadSuggestions = async () => {
    if (!conversation) return
    setLoadingSuggestions(true)
    setErrorMsg('')
    try {
      const items = await generateSceneSuggestions({
        conversation,
        character,
        world,
        settings,
      })
      setSuggestions(items)
      if (items.length > 0) {
        setSelectedSuggestion(items[0])
        setPromptText(items[0].prompt)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate scene suggestions.')
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleSelectSuggestion = (s: SceneSuggestion) => {
    setSelectedSuggestion(s)
    setPromptText(s.prompt)
    setErrorMsg('')
  }

  const handleProviderChange = (newProv: string) => {
    setProviderId(newProv)
    if (newProv === 'google') {
      setModel('imagen-3.0-generate-002')
    } else {
      setModel('flux')
    }
  }

  const handleGenerate = async () => {
    if (!promptText.trim() || !activeConversationId) return

    setGenerating(true)
    setErrorMsg('')
    setProgressMsg('Preparing image request…')

    try {
      const result = await generateImage({
        prompt: promptText.trim(),
        preferredProviderId: providerId,
        preferredModel: model,
        settings,
        onProgress: (msg) => setProgressMsg(msg),
      })

      // Add image message to chat
      addMessage(activeConversationId, {
        id: uid('img'),
        role: 'assistant',
        content: '',
        type: 'image',
        image: {
          id: result.id,
          prompt: result.prompt,
          url: result.url,
          model: `${result.providerId}/${result.model}`,
        },
        timestamp: Date.now(),
      })

      onClose()
    } catch (err: any) {
      if (err?.isExplicit || err?.message?.toLowerCase().includes('explicit')) {
        setErrorMsg('Content Safety: ' + (err.message || 'Explicit scenes are not permitted for image generation.'))
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Image generation failed.')
      }
    } finally {
      setGenerating(false)
      setProgressMsg('')
    }
  }

  const availableModels =
    providerId === 'google' ? GOOGLE_IMAGE_MODELS : POLLINATIONS_IMAGE_MODELS

  return (
    <Modal
      open={open}
      onClose={generating ? () => {} : onClose}
      size="lg"
      icon={<Sparkles size={18} />}
      title="Generate Scene Image"
      subtitle="Turn your conversation into striking visuals using Pollinations Flux or Google Imagen"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-2xs text-muted">
            {progressMsg && (
              <span className="flex items-center gap-1.5 font-medium text-accent">
                <Loader2 size={12} className="animate-spin" />
                {progressMsg}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={generating}
              className="btn btn-ghost px-4 py-2 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || !promptText.trim()}
              className="btn btn-accent flex items-center gap-2 px-4 py-2 text-xs shadow-md"
            >
              {generating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Wand2 size={14} />
                  Generate Image
                </>
              )}
            </button>
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

        {/* Model Selection bar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted">
              Image Provider
            </label>
            <select
              value={providerId}
              onChange={(e) => handleProviderChange(e.target.value)}
              disabled={generating}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-fg outline-none focus:border-accent"
            >
              <option value="pollinations">Pollinations.ai (Free Flux Family)</option>
              <option value="google">
                Google AI Studio (Imagen 3){!settings.keyedProviders.includes('google') ? ' — Requires API key' : ''}
              </option>
            </select>
            {!settings.keyedProviders.includes('google') && providerId === 'google' && (
              <p className="text-3xs text-amber-500/90 mt-1">
                API key required: Add your Google AI Studio key in Settings to generate with Imagen 3.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={generating}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-fg outline-none focus:border-accent"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scene Suggestions list */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-muted">
              Suggested Scenes from Chat
            </span>
            <button
              onClick={loadSuggestions}
              disabled={loadingSuggestions || generating}
              className="btn btn-ghost flex items-center gap-1.5 py-1 px-2 text-2xs text-faint hover:text-fg"
            >
              <RefreshCw size={11} className={cn(loadingSuggestions && 'animate-spin')} />
              Refresh Ideas
            </button>
          </div>

          {loadingSuggestions ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 rounded-2xl border border-dashed border-border/70 bg-surface/40">
              <Loader2 size={20} className="animate-spin text-accent" />
              <p className="text-xs text-muted">Analyzing conversation and character persona…</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-surface/40 p-5 text-center text-xs text-muted">
              No automatic suggestions generated yet. You can write your own custom prompt below.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {suggestions.map((s, idx) => {
                const isSelected = selectedSuggestion?.title === s.title
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    disabled={generating}
                    className={cn(
                      'group flex flex-col text-left rounded-xl border p-3 transition',
                      isSelected
                        ? 'border-accent bg-accent/10 shadow-sm'
                        : 'border-border/70 bg-surface/60 hover:border-border-strong hover:bg-surface-2',
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-semibold text-fg truncate">{s.title}</span>
                      {isSelected ? (
                        <Check size={14} className="text-accent shrink-0" />
                      ) : (
                        <ImageIcon size={13} className="text-faint group-hover:text-fg shrink-0" />
                      )}
                    </div>
                    <p className="text-2xs text-muted line-clamp-2 leading-relaxed">
                      {s.prompt}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Prompt editor */}
        <div>
          <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted">
            Scene Prompt (Editable)
          </label>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            disabled={generating}
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-xs text-fg leading-relaxed outline-none focus:border-accent scroll-thin"
            placeholder="Describe the scene in detail: environment, characters, lighting, artistic style…"
          />
          <p className="mt-1 text-2xs text-faint">
            * Note: Explicit and sexual content is prohibited for image generation and will be rejected.
          </p>
        </div>
      </div>
    </Modal>
  )
}
