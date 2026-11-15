import { describe, expect, it } from 'vitest'
import { filterTextForSpeech } from '../src/lib/tts'

describe('filterTextForSpeech', () => {
  it('extracts only spoken dialogue and strips thoughts, world events, and actions by default', () => {
    const raw =
      '*Aria pauses for a brief moment, her eyes following yours.* (a soft, reflective warmth in her voice) [World Event: Sunset over Neo-Veridia] "Perhaps another world waiting to be written. But right now, this moment is plenty real enough."'

    const filtered = filterTextForSpeech(raw, { readNarration: false })
    expect(filtered).toBe(
      'Perhaps another world waiting to be written. But right now, this moment is plenty real enough.',
    )
    expect(filtered).not.toContain('Aria pauses')
    expect(filtered).not.toContain('reflective warmth')
    expect(filtered).not.toContain('World Event')
  })

  it('includes narration when readNarration is enabled, while still stripping thoughts and world events', () => {
    const raw =
      '*Aria turns to the window.* (hoping for clear skies) [Grid Status: Online] "The storm has passed."'

    const filtered = filterTextForSpeech(raw, { readNarration: true })
    expect(filtered).toContain('Aria turns to the window')
    expect(filtered).toContain('The storm has passed')
    expect(filtered).not.toContain('hoping for clear skies')
    expect(filtered).not.toContain('Grid Status')
  })

  it('strips god command syntax <...>', () => {
    const raw = '<god: make it rain> "Take cover!" *she shouts.*'
    const filtered = filterTextForSpeech(raw, { readNarration: false })
    expect(filtered).toBe('Take cover!')
    expect(filtered).not.toContain('god: make it rain')
  })
})
