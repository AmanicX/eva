/**
 * Text-to-Speech (TTS) Engine for Eva
 *
 * Supports Google AI and Pollinations.ai with scene syntax filtering,
 * voice selection, single-audio playback management, and error fallback.
 */

import { getProviderKey } from './credentials'
import type { Settings } from '@/types'

export interface TTSVoiceOption {
  id: string
  label: string
  gender?: 'male' | 'female' | 'neutral'
}

export const GOOGLE_TTS_VOICES: TTSVoiceOption[] = [
  { id: 'Puck', label: 'Puck (Playful, Expressive)', gender: 'male' },
  { id: 'Charon', label: 'Charon (Deep, Authoritative)', gender: 'male' },
  { id: 'Kore', label: 'Kore (Gentle, Warm)', gender: 'female' },
  { id: 'Fenrir', label: 'Fenrir (Energetic, Bold)', gender: 'male' },
  { id: 'Aoede', label: 'Aoede (Reflective, Calm)', gender: 'female' },
]

export const POLLINATIONS_TTS_VOICES: TTSVoiceOption[] = [
  { id: 'alloy', label: 'Alloy (Balanced, Clear)', gender: 'neutral' },
  { id: 'echo', label: 'Echo (Warm, Resonant)', gender: 'male' },
  { id: 'fable', label: 'Fable (Expressive, British)', gender: 'neutral' },
  { id: 'onyx', label: 'Onyx (Deep, Smooth)', gender: 'male' },
  { id: 'nova', label: 'Nova (Warm, Friendly)', gender: 'female' },
  { id: 'shimmer', label: 'Shimmer (Bright, Clear)', gender: 'female' },
]

/**
 * Filters out scene syntax (thoughts, actions, world events, god rewrites).
 * By default, reads only spoken dialogue. If readNarration is enabled, reads narration too.
 */
export function filterTextForSpeech(
  text: string,
  options?: { readNarration?: boolean },
): string {
  if (!text) return ''

  // 1. Strip hidden thoughts, world events, and god rewrites
  let cleaned = text
    .replace(/\([^)]*\)/g, ' ') // (thought)
    .replace(/\[[^\]]*\]/g, ' ') // [world event]
    .replace(/<[^>]*>/g, ' ') // <god rewrite>

  // 2. If not reading narration, strip italic asterisks (*action*)
  if (!options?.readNarration) {
    cleaned = cleaned.replace(/\*[^*]*\*/g, ' ')
  }

  // 3. Spoken dialogue vs narration
  if (!options?.readNarration) {
    // Look for explicit spoken dialogue enclosed in quotes: "..."
    const quotes = cleaned.match(/"([^"]+)"|“([^”]+)”/g)
    if (quotes && quotes.length > 0) {
      cleaned = quotes
        .map((q) => q.replace(/["“”]/g, '').trim())
        .filter(Boolean)
        .join(' ')
    }
  }

  // Normalize whitespace
  return cleaned.replace(/\s+/g, ' ').trim()
}

/**
 * Generates an audio URL (blob or direct stream) for given text.
 */
export async function generateSpeechAudio(
  text: string,
  preferred?: { providerId?: string; voice?: string } | null,
  settings?: Settings,
  signal?: AbortSignal,
): Promise<{ audioUrl: string; usedProvider: string; usedVoice: string }> {
  const readNarration = settings?.ttsReadNarration ?? false
  const spokenText = filterTextForSpeech(text, { readNarration })

  if (!spokenText) {
    throw new Error('No spoken dialogue found to read aloud in this message.')
  }

  // Candidate order: preferred -> ttsDefault -> ttsProviderOrder
  const providerCandidates: { providerId: string; voice: string }[] = []

  if (preferred?.providerId) {
    providerCandidates.push({
      providerId: preferred.providerId,
      voice: preferred.voice || 'alloy',
    })
  }

  if (settings?.ttsDefault?.providerId) {
    providerCandidates.push({
      providerId: settings.ttsDefault.providerId,
      voice: settings.ttsDefault.voice || 'alloy',
    })
  }

  const order = settings?.ttsProviderOrder || ['pollinations', 'google']
  for (const provId of order) {
    if (!providerCandidates.some((c) => c.providerId === provId)) {
      const voice = provId === 'google' ? 'Puck' : 'alloy'
      providerCandidates.push({ providerId: provId, voice })
    }
  }

  const availableCandidates = providerCandidates.filter((c) => {
    const isEnabled = settings?.providerCapabilities?.[c.providerId]?.tts !== false
    return isEnabled
  })

  for (const candidate of availableCandidates) {
    if (signal?.aborted) {
      throw new DOMException('Speech synthesis aborted', 'AbortError')
    }

    try {
      if (candidate.providerId === 'pollinations') {
        const encodedText = encodeURIComponent(spokenText.slice(0, 1000))
        const voice = candidate.voice || 'alloy'
        const url = `https://text.pollinations.ai/${encodedText}?model=openai-audio&voice=${encodeURIComponent(voice)}`

        const res = await fetch(url, { signal })
        if (!res.ok) throw new Error(`Pollinations audio returned ${res.status}`)

        const blob = await res.blob()
        const audioUrl = URL.createObjectURL(blob)
        return { audioUrl, usedProvider: 'pollinations', usedVoice: voice }
      }

      if (candidate.providerId === 'google') {
        const key = await getProviderKey('google')
        if (!key) throw new Error('Google AI Studio key not configured.')

        // Google Text-to-Speech synthesis
        const voice = candidate.voice || 'Puck'
        const res = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': key,
            },
            body: JSON.stringify({
              input: { text: spokenText.slice(0, 1000) },
              voice: {
                languageCode: 'en-US',
                name: `en-US-Journey-F`, // Or custom voice parameter
              },
              audioConfig: {
                audioEncoding: 'MP3',
              },
            }),
            signal,
          },
        )

        if (!res.ok) {
          // If Cloud TTS endpoint fails, try alternative or fall through
          throw new Error(`Google TTS request failed: ${res.status}`)
        }

        const data = await res.json()
        if (data.audioContent) {
          const binary = atob(data.audioContent)
          const array = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i)
          const blob = new Blob([array], { type: 'audio/mp3' })
          const audioUrl = URL.createObjectURL(blob)
          return { audioUrl, usedProvider: 'google', usedVoice: voice }
        }
      }
    } catch {
      // Continue to next provider in fallback order
      continue
    }
  }

  throw new Error('All configured text-to-speech providers failed to generate audio.')
}

/**
 * Singleton Audio Player ensuring only one audio plays at any time across the app.
 */
class TTSAudioController {
  private currentAudio: HTMLAudioElement | null = null
  private currentPlayingId: string | null = null
  private listeners = new Set<(playingId: string | null) => void>()

  public addListener(cb: (playingId: string | null) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  public setListener(cb: (playingId: string | null) => void) {
    this.listeners.add(cb)
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.currentPlayingId)
    }
  }

  public play(id: string, audioUrl: string) {
    this.stop()

    const audio = new Audio(audioUrl)
    this.currentAudio = audio
    this.currentPlayingId = id

    audio.onended = () => {
      this.currentPlayingId = null
      this.currentAudio = null
      this.notify()
    }

    audio.onerror = () => {
      this.currentPlayingId = null
      this.currentAudio = null
      this.notify()
    }

    this.notify()
    void audio.play().catch(() => {
      this.stop()
    })
  }

  public stop() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause()
        this.currentAudio.currentTime = 0
      } catch {
        /* ignore */
      }
      this.currentAudio = null
    }
    if (this.currentPlayingId !== null) {
      this.currentPlayingId = null
      this.notify()
    }
  }

  public isPlaying(id: string): boolean {
    return this.currentPlayingId === id
  }

  public getPlayingId(): string | null {
    return this.currentPlayingId
  }
}

export const ttsPlayer = new TTSAudioController()
