import { useState, useEffect } from 'react'
import { Check, Cpu, Image as ImageIcon, Volume2 } from 'lucide-react'
import { Modal } from './Modal'
import { useStore } from '@/store/useStore'
import { PROVIDER_PRESETS, MODEL_SUGGESTIONS } from '@/lib/groq'
import { GOOGLE_TTS_VOICES, POLLINATIONS_TTS_VOICES } from '@/lib/tts'
import { GOOGLE_IMAGE_MODELS, POLLINATIONS_IMAGE_MODELS } from '@/lib/imageGeneration'
import { isMobilePlatform, isProviderSupportedOnPlatform, isLocalProvider } from '@/lib/platform'
import type { PerChatConfig } from '@/types'

interface ChatConfigModalProps {
  open: boolean
  onClose: () => void
}

export function ChatConfigModal({ open, onClose }: ChatConfigModalProps) {
  const activeConversationId = useStore((s) => s.activeConversationId)
  const conversation = useStore((s) =>
    s.conversations.find((c) => c.id === s.activeConversationId),
  )
  const settings = useStore((s) => s.settings)
  const updateConversation = useStore((s) => s.updateConversation)

  // Local state
  const [chatProvider, setChatProvider] = useState<string>('inherit')
  const [chatModel, setChatModel] = useState<string>('')

  const [imageProvider, setImageProvider] = useState<string>('inherit')
  const [imageModel, setImageModel] = useState<string>('')

  const [ttsProvider, setTtsProvider] = useState<string>('inherit')
  const [ttsVoice, setTtsVoice] = useState<string>('')

  useEffect(() => {
    if (!open || !conversation) return
    if (conversation.chatConfig?.providerId) {
      setChatProvider(conversation.chatConfig.providerId)
      setChatModel(conversation.chatConfig.model || '')
    } else {
      setChatProvider('inherit')
      setChatModel('')
    }

    if (conversation.imageConfig?.providerId) {
      setImageProvider(conversation.imageConfig.providerId)
      setImageModel(conversation.imageConfig.model || '')
    } else {
      setImageProvider('inherit')
      setImageModel('')
    }

    if (conversation.ttsConfig?.providerId) {
      setTtsProvider(conversation.ttsConfig.providerId)
      setTtsVoice(conversation.ttsConfig.voice || '')
    } else {
      setTtsProvider('inherit')
      setTtsVoice('')
    }
  }, [open, conversation])

  const handleSave = () => {
    if (!activeConversationId) return

    const chatConfig: PerChatConfig | undefined =
      chatProvider !== 'inherit' && chatModel
        ? { providerId: chatProvider, model: chatModel }
        : undefined

    const imageConfig: PerChatConfig | undefined =
      imageProvider !== 'inherit' && imageModel
        ? { providerId: imageProvider, model: imageModel }
        : undefined

    const ttsConfig: PerChatConfig | undefined =
      ttsProvider !== 'inherit' && ttsVoice
        ? { providerId: ttsProvider, voice: ttsVoice }
        : undefined

    updateConversation(activeConversationId, {
      chatConfig,
      imageConfig,
      ttsConfig,
    })

    onClose()
  }

  const isMobile = isMobilePlatform()
  const isCurrentLocal = isMobile && isLocalProvider(chatProvider)

  // Helper lists
  const availableChatProviders = PROVIDER_PRESETS.filter(
    (p) =>
      isProviderSupportedOnPlatform(p.id, isMobile) &&
      (settings.keyedProviders.includes(p.id) ||
        p.id === 'ollama' ||
        p.id === 'lmstudio' ||
        p.id === 'pollinations'),
  )

  const chatSuggestions = chatProvider !== 'inherit' && !isCurrentLocal ? MODEL_SUGGESTIONS[chatProvider] || [] : []

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      icon={<Cpu size={18} />}
      title="Per-Chat Configuration"
      subtitle="Customize models and voices specifically for this conversation"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost px-4 py-2 text-xs">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-accent flex items-center gap-2 px-4 py-2 text-xs shadow-md"
          >
            <Check size={14} />
            Save Settings
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Chat Provider & Model */}
        <div className="rounded-2xl border border-border/80 bg-surface/50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-fg">
            <Cpu size={15} className="text-accent" />
            <span>Chat AI Model</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-2xs text-muted font-medium">Provider</label>
              <select
                value={chatProvider}
                onChange={(e) => {
                  const val = e.target.value
                  setChatProvider(val)
                  if (val === 'inherit') {
                    setChatModel('')
                  } else {
                    const first = MODEL_SUGGESTIONS[val]?.[0] || ''
                    setChatModel(first)
                  }
                }}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-fg outline-none focus:border-accent"
              >
                <option value="inherit">Inherit Global Default</option>
                {isCurrentLocal && (
                  <option value={chatProvider} disabled>
                    {PROVIDER_PRESETS.find((p) => p.id === chatProvider)?.label || chatProvider} (Desktop Only)
                  </option>
                )}
                {availableChatProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {isCurrentLocal && (
                <p className="mt-1 text-2xs text-amber-500">
                  Configured with a local desktop model. On mobile, choose a cloud provider or inherit global settings.
                </p>
              )}
            </div>

            {chatProvider !== 'inherit' && (
              <div>
                <label className="mb-1 block text-2xs text-muted font-medium">Model</label>
                {chatSuggestions.length > 0 ? (
                  <select
                    value={chatModel}
                    onChange={(e) => setChatModel(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-fg outline-none focus:border-accent"
                  >
                    {chatSuggestions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={chatModel}
                    onChange={(e) => setChatModel(e.target.value)}
                    placeholder="e.g. gpt-4o or llama-3.3"
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-fg outline-none focus:border-accent font-mono"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Image Provider & Model */}
        <div className="rounded-2xl border border-border/80 bg-surface/50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-fg">
            <ImageIcon size={15} className="text-accent" />
            <span>Scene Image Model</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-2xs text-muted font-medium">Provider</label>
              <select
                value={imageProvider}
                onChange={(e) => {
                  const val = e.target.value
                  setImageProvider(val)
                  if (val === 'inherit') {
                    setImageModel('')
                  } else if (val === 'google') {
                    setImageModel('imagen-3.0-generate-002')
                  } else {
                    setImageModel('flux')
                  }
                }}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-fg outline-none focus:border-accent"
              >
                <option value="inherit">Inherit Global Default</option>
                <option value="pollinations">Pollinations.ai (Flux)</option>
                <option value="google">
                  Google AI Studio (Imagen 3){!settings.keyedProviders.includes('google') ? ' — Requires API key' : ''}
                </option>
              </select>
            </div>

            {imageProvider !== 'inherit' && (
              <div>
                <label className="mb-1 block text-2xs text-muted font-medium">Model</label>
                <select
                  value={imageModel}
                  onChange={(e) => setImageModel(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-fg outline-none focus:border-accent"
                >
                  {(imageProvider === 'google'
                    ? GOOGLE_IMAGE_MODELS
                    : POLLINATIONS_IMAGE_MODELS
                  ).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* TTS Voice */}
        <div className="rounded-2xl border border-border/80 bg-surface/50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-fg">
            <Volume2 size={15} className="text-accent" />
            <span>Text-to-Speech Voice</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-2xs text-muted font-medium">TTS Provider</label>
              <select
                value={ttsProvider}
                onChange={(e) => {
                  const val = e.target.value
                  setTtsProvider(val)
                  if (val === 'inherit') {
                    setTtsVoice('')
                  } else if (val === 'google') {
                    setTtsVoice('Puck')
                  } else {
                    setTtsVoice('alloy')
                  }
                }}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-fg outline-none focus:border-accent"
              >
                <option value="inherit">Inherit Global Default</option>
                <option value="pollinations">Pollinations.ai TTS (Alloy, etc.)</option>
                <option value="google">
                  Google AI TTS (Puck, Kore, etc.){!settings.keyedProviders.includes('google') ? ' — Requires API key' : ''}
                </option>
              </select>
            </div>

            {ttsProvider !== 'inherit' && (
              <div>
                <label className="mb-1 block text-2xs text-muted font-medium">Voice</label>
                <select
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-fg outline-none focus:border-accent"
                >
                  {(ttsProvider === 'google'
                    ? GOOGLE_TTS_VOICES
                    : POLLINATIONS_TTS_VOICES
                  ).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
