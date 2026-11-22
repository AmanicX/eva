import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Image as ImageIcon, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Modal } from './Modal'
import { useStore } from '@/store/useStore'
import { generateImageConcepts, expandImageIdea, getPromptWriters, type ImageConcept } from '@/lib/imagePromptGenerator'
import { IMAGE_STYLES, applyImageStyle, type ImageStyleId } from '@/lib/imageStyles'
import { generateImage, defaultImageModel, resolveImageModel, GOOGLE_IMAGE_MODELS, POLLINATIONS_IMAGE_MODELS } from '@/lib/imageGeneration'
import { PROVIDER_PRESETS } from '@/lib/groq'
import { cn, uid } from '@/lib/utils'

interface ImageGenModalProps {
  open: boolean
  onClose: () => void
}

/** A fresh editor per opening/chat, without resetting edits when settings update. */
export function ImageGenModal(props: ImageGenModalProps) {
  const activeId = useStore((s) => s.activeConversationId)
  const [previousOpen, setPreviousOpen] = useState(props.open)
  const [session, setSession] = useState(0)
  if (props.open !== previousOpen) {
    setPreviousOpen(props.open)
    if (props.open) setSession(session + 1)
  }
  return <ImageGenSession key={`${activeId}-${session}`} {...props} />
}

const fieldClass = 'min-h-11 w-full min-w-0 rounded-xl border border-border-strong bg-surface px-3 py-2 text-base text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent sm:text-sm'
const labelClass = 'mb-2 block text-sm font-medium text-fg'

function ImageGenSession({ open, onClose }: ImageGenModalProps) {
  const conversation = useStore((s) => s.conversations.find((c) => c.id === s.activeConversationId))
  const settings = useStore((s) => s.settings)
  const writers = getPromptWriters(settings, conversation?.chatConfig)
  const [mode, setMode] = useState<'chat' | 'standalone' | 'manual'>(conversation?.messages.length ? 'chat' : 'standalone')
  const [writerKey, setWriterKey] = useState(() => writers[0] ? `${writers[0].providerId}::${writers[0].model}` : '')
  const writer = writers.find((w) => `${w.providerId}::${w.model}` === writerKey)
  const [style, setStyle] = useState<ImageStyleId>('natural')
  const [idea, setIdea] = useState('')
  const [concepts, setConcepts] = useState<ImageConcept[]>([])
  const [prompt, setPrompt] = useState('')
  const [selected, setSelected] = useState('')
  const [providerId, setProviderId] = useState(() => conversation?.imageConfig?.providerId || settings.imageDefault?.providerId || 'pollinations')
  const [model, setModel] = useState(() => {
    const provider = conversation?.imageConfig?.providerId || settings.imageDefault?.providerId || 'pollinations'
    return resolveImageModel(provider, conversation?.imageConfig?.model ||
      (provider === settings.imageDefault?.providerId ? settings.imageDefault.model : settings.providerModels[provider]?.imageModel))
  })
  const [busy, setBusy] = useState<'ideas' | 'expand' | 'image' | null>(null)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const reducedMotion = useReducedMotion()

  const cancel = useCallback(() => {
    request.current?.abort()
    request.current = null
    setBusy(null)
    setProgress('')
  }, [])
  const close = useCallback(() => { cancel(); onClose() }, [cancel, onClose])
  useEffect(() => {
    if (!open) request.current?.abort()
    return () => { request.current?.abort() }
  }, [open])

  async function run(task: 'ideas' | 'expand' | 'image') {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    const conversationId = conversation?.id
    const isCurrent = () => !controller.signal.aborted && request.current === controller &&
      useStore.getState().activeConversationId === conversationId
    setBusy(task)
    setError('')
    setProgress(task === 'image' ? 'Preparing image request…' : 'Writing with your selected AI model…')
    try {
      const options = { settings, writer, chatConfig: conversation?.chatConfig, style, signal: controller.signal }
      if (task === 'ideas') {
        const items = await generateImageConcepts(mode === 'chat' && conversation
          ? { ...options, mode: 'chat', conversation }
          : { ...options, mode: 'standalone', idea })
        // Suggestions never overwrite an existing edited prompt.
        if (isCurrent()) setConcepts(items)
      } else if (task === 'expand') {
        const expanded = await expandImageIdea({ ...options, idea })
        if (isCurrent()) { setPrompt(expanded); setSelected('') }
      } else {
        if (!conversationId) throw new Error('Open a conversation before adding an image.')
        const result = await generateImage({
          prompt, preferredProviderId: providerId, preferredModel: model,
          settings, signal: controller.signal,
          onProgress: (message) => { if (isCurrent()) setProgress(message) },
        })
        if (!isCurrent()) return
        useStore.getState().addMessage(conversationId, {
          id: uid('msg'), role: 'assistant', content: '', type: 'image',
          image: { id: result.id, prompt: result.prompt, url: result.url, model: `${result.providerId}/${result.model}` },
          timestamp: result.createdAt,
        })
        close()
      }
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : 'Image Gen failed. Please try again.')
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(null)
        setProgress('')
      }
    }
  }

  const models = providerId === 'google' ? GOOGLE_IMAGE_MODELS : POLLINATIONS_IMAGE_MODELS
  return (
    <Modal open={open} onClose={close} size="xl" fitKeyboard
      icon={<ImageIcon size={18} aria-hidden="true" />}
      title="Image Gen" subtitle="Find an idea. Make it yours."
      bodyClassName="min-h-0"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="flex min-w-0 items-center gap-2 text-xs text-muted">
            {busy && <Loader2 size={14} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {progress || 'Images are added to this conversation.'}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="btn btn-ghost min-h-11 px-4 text-sm" onClick={busy ? cancel : close}>
              {busy ? 'Stop' : 'Cancel'}
            </button>
            <button type="button" onClick={() => run('image')} disabled={!!busy || !prompt.trim() || !conversation}
              className="btn btn-accent min-h-11 gap-2 px-4 text-sm">
              <Wand2 size={16} aria-hidden="true" />{busy === 'image' ? 'Generating…' : 'Generate image'}
            </button>
          </div>
        </div>
      }>
      <div className="space-y-6">
        <div role="group" aria-label="Prompt source" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1 sm:max-w-md">
          {([['chat', 'Recent chat'], ['standalone', 'AI ideas'], ['manual', 'Manual']] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={mode === id} disabled={!!busy}
              onClick={() => { setMode(id); setConcepts([]); setSelected(''); setError('') }}
              className={cn('min-h-11 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent',
                mode === id ? 'bg-surface text-fg' : 'text-muted hover:text-fg')}>
              {label}
            </button>
          ))}
        </div>
        {/* At desktop: flexible editor + 256px controls, with a single 24px gutter. */}
        <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0 space-y-5">
            {mode !== 'manual' && (
              <section aria-label="AI prompt writing" className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-fg">{mode === 'chat' ? 'Four ideas from right here' : 'Start somewhere new'}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {mode === 'chat'
                      ? 'Only the latest three messages in this chat. No memory, character biography or world lore.'
                      : 'Independent of your chat. Add a short idea, or leave it blank for a surprise.'}
                  </p>
                </div>
                {mode === 'standalone' && (
                  <div>
                    <label htmlFor="image-idea" className={labelClass}>Your starting idea <span className="font-normal text-muted">(optional)</span></label>
                    <input id="image-idea" value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={3000}
                      disabled={!!busy} className={fieldClass} placeholder="A tiny observatory on a whale…" />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => run('ideas')} disabled={!!busy || !writer}
                    className="btn btn-secondary min-h-11 gap-2 px-3 text-sm">
                    <Sparkles size={15} aria-hidden="true" />{busy === 'ideas' ? 'Writing four ideas…' : concepts.length ? 'Refresh four ideas' : 'Create four ideas'}
                  </button>
                  {mode === 'standalone' && (
                    <button type="button" onClick={() => run('expand')} disabled={!!busy || !writer || !idea.trim()}
                      className="btn btn-ghost min-h-11 px-3 text-sm">
                      {busy === 'expand' ? 'Expanding…' : 'Expand my idea'}
                    </button>
                  )}
                </div>
                {concepts.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Image concepts">
                    {concepts.map((concept) => (
                      <motion.button key={concept.title} type="button" aria-pressed={selected === concept.title} disabled={!!busy}
                        initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.16 }}
                        onClick={() => { setSelected(concept.title); setPrompt(concept.prompt); setError('') }}
                        className={cn('min-w-0 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent',
                          selected === concept.title ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-border-strong')}>
                        <span className="flex items-start justify-between gap-2 text-sm font-semibold text-fg">
                          <span className="break-words">{concept.title}</span>
                          {selected === concept.title && <Check size={16} className="shrink-0 text-accent" aria-hidden="true" />}
                        </span>
                        <span className="mt-2 line-clamp-3 block break-words text-xs leading-relaxed text-muted">{concept.prompt}</span>
                      </motion.button>
                    ))}
                  </div>
                )}
                {concepts.length === 0 && !busy && <p className="text-xs text-muted">Choose a concept to fill the editor, or write your own below.</p>}
              </section>
            )}
            <section aria-label="Final image prompt">
              <label htmlFor="image-prompt" className={labelClass}>{mode === 'manual' ? 'Your prompt, your words' : 'Final image prompt'}</label>
              <textarea id="image-prompt" value={prompt} onChange={(e) => { setPrompt(e.target.value); setSelected('') }}
                disabled={!!busy} maxLength={16000} rows={mode === 'manual' ? 10 : 6}
                aria-describedby="image-prompt-help"
                className={cn(fieldClass, 'scroll-thin resize-y leading-relaxed')}
                placeholder="Describe anything you want to see: a person, a product, an illustration, a place…" />
              <div id="image-prompt-help" className="mt-2 flex justify-between gap-3 text-xs leading-relaxed text-muted">
                <span>Sent exactly as shown. AI never silently rewrites your prompt.</span>
                <span className="shrink-0 tabular-nums">{prompt.length.toLocaleString()} / 16,000</span>
              </div>
            </section>
          </div>
          <aside className="min-w-0 space-y-5 rounded-2xl bg-surface-2 p-4" aria-label="Image settings">
            <div>
              <label htmlFor="image-provider" className={labelClass}>Image provider</label>
              <select id="image-provider" value={providerId} disabled={!!busy} className={fieldClass}
                onChange={(e) => { setProviderId(e.target.value); setModel(resolveImageModel(e.target.value, settings.providerModels[e.target.value]?.imageModel)) }}>
                <option value="google">Google AI Studio</option>
                <option value="pollinations">Pollinations</option>
              </select>
            </div>
            <div>
              <label htmlFor="image-model" className={labelClass}>Image model</label>
              <select id="image-model" value={model} disabled={!!busy} className={fieldClass} onChange={(e) => setModel(e.target.value)}>
                {!models.some((m) => m.id === model) && <option value={model}>{model || defaultImageModel(providerId)} · choose a supported model</option>}
                {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <p className="mt-2 text-xs leading-relaxed text-muted">Uses only this provider. API key required; billing, quota and model access depend on your account.</p>
            </div>
            <div>
              <label htmlFor="image-style" className={labelClass}>Visual style</label>
              <select id="image-style" value={style} disabled={!!busy} className={fieldClass} onChange={(e) => setStyle(e.target.value as ImageStyleId)}>
                {IMAGE_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <p className="mt-2 text-xs leading-relaxed text-muted">Guides new AI ideas. To style your current prompt, apply it below.</p>
              <button type="button" disabled={!!busy || !prompt.trim() || style === 'natural'}
                onClick={() => {
                  const styled = applyImageStyle(prompt, style)
                  if (styled.length > 16000) { setError('Shorten your prompt before adding a style (16,000 character limit).'); return }
                  setPrompt(styled); setSelected('')
                }}
                className="btn btn-ghost mt-2 min-h-11 px-0 text-sm">Apply style to prompt</button>
            </div>
            {mode !== 'manual' && (
              <div>
                <label htmlFor="image-writer" className={labelClass}>AI prompt writer</label>
                <select id="image-writer" value={writerKey} disabled={!!busy} className={fieldClass} onChange={(e) => setWriterKey(e.target.value)}>
                  {!writer && <option value={writerKey}>Choose a configured writer</option>}
                  {writers.map((w) => <option key={`${w.providerId}::${w.model}`} value={`${w.providerId}::${w.model}`}>
                    {PROVIDER_PRESETS.find((p) => p.id === w.providerId)?.label || w.providerId} · {w.model}
                  </option>)}
                </select>
                <p className="mt-2 text-xs leading-relaxed text-muted">Prefers stronger configured models. Sends only the stated source to this writer. Local-only settings stay local.</p>
              </div>
            )}
          </aside>
        </div>
        {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm leading-relaxed text-fg">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" /><p>{error}</p>
        </div>}
        <p className="text-xs leading-relaxed text-muted">Image safety checks remain enabled. Explicit sexual content and graphic gore are not supported. Your configured safety checker may also review the prompt.</p>
      </div>
    </Modal>
  )
}
