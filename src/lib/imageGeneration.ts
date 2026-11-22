/** Explicit, single-provider image requests. Never send a failed prompt elsewhere. */
import { checkImageExplicitContent } from './imageGuard'
import { storeImageBlob } from './imageStorage'
import { getProviderKey } from './credentials'
import { uid } from './utils'
import type { Settings } from '@/types'

export interface ImageGenerationOptions {
  prompt: string
  preferredProviderId?: string
  preferredModel?: string
  settings: Settings
  signal?: AbortSignal
  onProgress?: (msg: string) => void
}

export interface ImageGenerationResult {
  id: string
  url: string
  prompt: string
  providerId: string
  model: string
  createdAt: number
}

// Models, not styles. Verified against the providers' official catalogs.
export const POLLINATIONS_IMAGE_MODELS = [
  { id: 'flux', label: 'FLUX.1 Schnell' },
  { id: 'zimage', label: 'Z-Image Turbo' },
  { id: 'black-forest-labs/flux.1.1-pro', label: 'FLUX 1.1 Pro' },
  { id: 'gptimage', label: 'GPT Image 1 Mini (paid)' },
]
export const GOOGLE_IMAGE_MODELS = [
  { id: 'gemini-3.1-flash-image', label: 'Nano Banana 2 · Gemini 3.1 Flash Image' },
  { id: 'gemini-3-pro-image', label: 'Nano Banana Pro · Gemini 3 Pro Image' },
  { id: 'gemini-2.5-flash-image', label: 'Nano Banana · Gemini 2.5 Flash Image' },
]

export function defaultImageModel(providerId: string): string {
  return providerId === 'google' ? GOOGLE_IMAGE_MODELS[0].id : 'flux'
}

/** Migrate known retired defaults only; invalid custom models fail explicitly. */
export function resolveImageModel(providerId: string, model?: string): string {
  if (!model || (providerId === 'google' && model.startsWith('imagen-'))) {
    return defaultImageModel(providerId)
  }
  if (providerId === 'pollinations') {
    if (model === 'flux-pro') return 'black-forest-labs/flux.1.1-pro'
    if (['flux-realism', 'flux-anime', 'flux-3d', 'turbo'].includes(model)) return 'flux'
  }
  return model
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024

function decodeImage(data: unknown, declaredMime?: unknown): Blob {
  if (typeof data !== 'string' || !data || data.length > MAX_IMAGE_BYTES * 1.4) {
    throw new Error('The provider returned missing or oversized image data. Please try again.')
  }
  let binary: string
  try { binary = atob(data) } catch { throw new Error('The provider returned invalid image data.') }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  const starts = (...values: number[]) => values.every((v, i) => bytes[i] === v)
  const mime = starts(137, 80, 78, 71, 13, 10, 26, 10) ? 'image/png'
    : starts(255, 216, 255) ? 'image/jpeg'
    : starts(82, 73, 70, 70) && binary.slice(8, 12) === 'WEBP' ? 'image/webp'
    : ''
  if (!mime || bytes.length > MAX_IMAGE_BYTES || (declaredMime && declaredMime !== mime)) {
    throw new Error('The provider did not return a valid supported image (PNG, JPEG or WebP).')
  }
  return new Blob([bytes], { type: mime })
}

async function providerError(res: Response, provider: string): Promise<Error> {
  // Classify raw errors, but never display provider text (may echo keys/prompts).
  const detail = (await res.text().catch(() => '')).slice(0, 16000)
  const prefix = `${provider} image request failed (${res.status}). `
  if (/safety|content.blocked|content.policy|prohibited/i.test(detail)) {
    return new Error(prefix + 'The provider blocked this request for content safety. Edit the prompt.')
  }
  if (res.status === 402 || /billing|payment|balance|budget/i.test(detail)) {
    return new Error(prefix + 'Enable billing or add balance for this API project/key. Image generation may not have a free tier.')
  }
  if (res.status === 401 || /API_KEY_INVALID|key.*invalid/i.test(detail)) {
    return new Error(prefix + 'Check the saved API key in Settings. A Google AI Studio key is not a Vertex access token.')
  }
  if (res.status === 403) {
    return new Error(prefix + 'Permission denied. Check API/key restrictions, model access and region availability for this project.')
  }
  if (res.status === 429) {
    return new Error(prefix + 'Quota or rate limit reached. Check project quotas and billing, then retry later.')
  }
  if (res.status === 404 || res.status === 400) {
    return new Error(prefix + 'The model or request is unsupported. Select an image-capable model available to your account; Imagen is retired.')
  }
  return new Error(prefix + 'The provider is unavailable. Try again later; no other provider was contacted.')
}

interface GoogleResponse {
  promptFeedback?: { blockReason?: string }
  candidates?: { finishReason?: string; content?: { parts?: {
    thought?: boolean; inlineData?: { mimeType?: string; data?: string }
  }[] } }[]
}

export async function generateImage(opts: ImageGenerationOptions): Promise<ImageGenerationResult> {
  const { prompt, settings } = opts
  opts.signal?.throwIfAborted()
  if (!prompt.trim() || prompt.length > 16000) throw new Error('Enter an image prompt of 1–16,000 characters.')
  const providerId = opts.preferredProviderId || settings.imageDefault?.providerId || 'pollinations'
  if (!['google', 'pollinations'].includes(providerId)) throw new Error('Select Google or Pollinations for Image Gen.')
  if (settings.providerCapabilities?.[providerId]?.image === false) {
    throw new Error('Image generation is disabled for this provider. Enable it in Settings.')
  }
  const model = resolveImageModel(providerId, opts.preferredModel ||
    (settings.imageDefault?.providerId === providerId ? settings.imageDefault.model : settings.providerModels?.[providerId]?.imageModel))
  const models = providerId === 'google' ? GOOGLE_IMAGE_MODELS : POLLINATIONS_IMAGE_MODELS
  if (!models.some((m) => m.id === model)) throw new Error('Unsupported image model. Select a supported image-capable model.')
  const key = await getProviderKey(providerId)
  opts.signal?.throwIfAborted()
  if (!key) throw new Error(`Add your ${providerId === 'google' ? 'Google AI Studio' : 'Pollinations'} API key in Settings. Image access and billing depend on your account.`)

  const controller = new AbortController()
  const abort = () => controller.abort()
  opts.signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, 180000)
  try {
    opts.onProgress?.('Checking image safety…')
    const guard = await checkImageExplicitContent(prompt, settings, controller.signal)
    controller.signal.throwIfAborted()
    if (guard.explicit) throw new Error(guard.reason || 'Explicit content is not supported for image generation.')
    opts.onProgress?.(`Generating with ${providerId === 'google' ? 'Google' : 'Pollinations'}…`)
    // https://ai.google.dev/api/generate-content
    // https://gen.pollinations.ai/openapi.json
    const res = await fetch(providerId === 'google'
      ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
      : 'https://gen.pollinations.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(providerId === 'google' ? { 'x-goog-api-key': key } : { Authorization: `Bearer ${key}` }),
      },
      body: JSON.stringify(providerId === 'google' ? {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      } : {
        prompt, model, n: 1, size: '1024x1024', response_format: 'b64_json',
        seed: Math.floor(Math.random() * 2147483647),
      }),
      signal: controller.signal,
    })
    if (!res.ok) throw await providerError(res, providerId === 'google' ? 'Google' : 'Pollinations')
    let blob: Blob
    if (providerId === 'google') {
      const data: GoogleResponse = await res.json()
      const candidate = data.candidates?.[0]
      if (data.promptFeedback?.blockReason || /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(candidate?.finishReason || '')) {
        throw new Error('Google blocked image generation for content safety or policy reasons. Edit the prompt.')
      }
      const image = candidate?.content?.parts?.find((p) => !p.thought && p.inlineData?.data)?.inlineData
      if (!image) throw new Error('Google returned no image. Select an image-capable model or edit the prompt; check model access and billing.')
      blob = decodeImage(image.data, image.mimeType)
    } else {
      const data = await res.json() as { data?: { b64_json?: string }[] }
      blob = decodeImage(data.data?.[0]?.b64_json)
    }
    controller.signal.throwIfAborted()
    const id = uid('img')
    const url = await storeImageBlob(id, blob, prompt)
    controller.signal.throwIfAborted()
    return { id, url, prompt, providerId, model, createdAt: Date.now() }
  } catch (error) {
    if (opts.signal?.aborted) throw new DOMException('Image generation cancelled.', 'AbortError')
    if (controller.signal.aborted) throw new Error('Image generation timed out after three minutes. Please try again.')
    if (error instanceof TypeError) throw new Error('Could not reach the image provider. Check your connection and API access.')
    throw error
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', abort)
  }
}
