/**
 * Image Generation Client for Eva
 *
 * Supports Pollinations.ai (Flux family) and Google AI (Imagen 3).
 * Integrates explicit content guard, persistent blob storage, and non-explicit fallback.
 */

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
}

export const POLLINATIONS_IMAGE_MODELS = [
  { id: 'flux', label: 'Flux Schnell (Fast, Sharp)' },
  { id: 'flux-pro', label: 'Flux 1.1 Pro (High Fidelity)' },
  { id: 'flux-realism', label: 'Flux Realism (Photorealistic)' },
  { id: 'flux-anime', label: 'Flux Anime (Anime Illustration)' },
  { id: 'flux-3d', label: 'Flux 3D (Render Style)' },
  { id: 'turbo', label: 'SDXL Turbo (Instant Draft)' },
]

export const GOOGLE_IMAGE_MODELS = [
  { id: 'imagen-3.0-generate-002', label: 'Imagen 3 (Standard)' },
  { id: 'imagen-3.0-fast-generate-001', label: 'Imagen 3 Fast' },
]

export async function generateImage(
  opts: ImageGenerationOptions,
): Promise<ImageGenerationResult> {
  const { prompt, settings, signal } = opts

  // 1. Guard against explicit content (Never leaves the app)
  opts.onProgress?.('Evaluating content safety…')
  const guard = await checkImageExplicitContent(prompt, settings, signal)
  if (guard.explicit) {
    const error = new Error(
      guard.reason ||
        'Explicit and sexual content is not supported for image generation. Please edit the prompt.',
    )
    ;(error as any).isExplicit = true
    throw error
  }

  // 2. Build candidate chain
  const candidates: { providerId: string; model: string }[] = []

  if (opts.preferredProviderId) {
    candidates.push({
      providerId: opts.preferredProviderId,
      model: opts.preferredModel || (opts.preferredProviderId === 'google' ? 'imagen-3.0-generate-002' : 'flux'),
    })
  }

  if (settings.imageDefault?.providerId) {
    candidates.push({
      providerId: settings.imageDefault.providerId,
      model: settings.imageDefault.model || 'flux',
    })
  }

  const order = settings.imageProviderOrder || ['pollinations', 'google']
  for (const provId of order) {
    if (!candidates.some((c) => c.providerId === provId)) {
      const model = provId === 'google' ? 'imagen-3.0-generate-002' : 'flux'
      candidates.push({ providerId: provId, model })
    }
  }

  // Filter candidates to only keyed / available providers and enabled image capability
  const availableCandidates = candidates.filter((c) => {
    const isEnabled = settings.providerCapabilities?.[c.providerId]?.image !== false
    if (!isEnabled) return false
    if (c.providerId === 'pollinations') return true
    if (c.providerId === 'google') return settings.keyedProviders.includes('google')
    return false
  })

  if (availableCandidates.length === 0) {
    throw new Error('No image generation providers are configured. Set up Pollinations or Google AI Studio in Settings.')
  }

  let lastError: Error | null = null

  for (let i = 0; i < availableCandidates.length; i++) {
    const candidate = availableCandidates[i]
    if (signal?.aborted) {
      throw new DOMException('Image generation cancelled.', 'AbortError')
    }

    opts.onProgress?.(
      `Generating visual scene with ${candidate.providerId === 'google' ? 'Google Imagen' : 'Pollinations Flux'}…`,
    )

    try {
      if (candidate.providerId === 'pollinations') {
        const seed = Math.floor(Math.random() * 10000000)
        const encodedPrompt = encodeURIComponent(prompt.trim())
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${encodeURIComponent(candidate.model)}&width=1024&height=1024&nologo=true&seed=${seed}`

        const res = await fetch(url, { signal })
        if (!res.ok) throw new Error(`Pollinations image API returned HTTP ${res.status}`)

        const blob = await res.blob()
        const id = uid('img')
        const storedUrl = await storeImageBlob(id, blob, prompt)

        return {
          id,
          url: storedUrl,
          prompt,
          providerId: 'pollinations',
          model: candidate.model,
        }
      }

      if (candidate.providerId === 'google') {
        const key = await getProviderKey('google')
        if (!key) throw new Error('Google AI Studio API key not found.')

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:predict`
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: '1:1',
            },
          }),
          signal,
        })

        if (!res.ok) {
          const body = await res.text().catch(() => '')
          if (res.status === 400 && /safety|policy|blocked/i.test(body)) {
            // Safety block from Google is final; do NOT fall through
            const err = new Error('Image generation was blocked by provider content safety filters.')
            ;(err as any).isExplicit = true
            throw err
          }
          throw new Error(`Google Imagen returned ${res.status}: ${body.slice(0, 150)}`)
        }

        const data = await res.json()
        const b64 = data?.predictions?.[0]?.bytesBase64Encoded
        if (!b64) throw new Error('No image bytes returned from Google Imagen.')

        const binary = atob(b64)
        const array = new Uint8Array(binary.length)
        for (let j = 0; j < binary.length; j++) array[j] = binary.charCodeAt(j)
        const blob = new Blob([array], { type: 'image/jpeg' })

        const id = uid('img')
        const storedUrl = await storeImageBlob(id, blob, prompt)

        return {
          id,
          url: storedUrl,
          prompt,
          providerId: 'google',
          model: candidate.model,
        }
      }
    } catch (err: any) {
      if (err.isExplicit) {
        // Do not fall through on explicit content or safety rejections
        throw err
      }
      lastError = err
      // Try next provider
      continue
    }
  }

  throw lastError || new Error('All image generation providers failed.')
}
