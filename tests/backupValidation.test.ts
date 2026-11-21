import { describe, it, expect } from 'vitest'
import {
  normalizeSettings,
  validateAndSanitizeBackup,
  normalizeTheme,
  normalizeBoundedNumber,
} from '@/lib/backupValidation'
import { THEMES } from '@/data/themes'

describe('Backup Validation & State Normalization', () => {
  it('normalizes invalid theme identifiers to safe default "chatbot"', () => {
    expect(normalizeTheme('chatbot')).toBe('chatbot')
    expect(normalizeTheme('anime')).toBe('anime')
    expect(normalizeTheme('world')).toBe('world')

    // Invalid identifiers that previously bricked the app
    expect(normalizeTheme('invalid_theme')).toBe('chatbot')
    expect(normalizeTheme(null)).toBe('chatbot')
    expect(normalizeTheme(undefined)).toBe('chatbot')
    expect(normalizeTheme(42)).toBe('chatbot')
    expect(normalizeTheme('')).toBe('chatbot')
  })

  it('guarantees normalized settings never produce an undefined theme in THEMES', () => {
    const maliciousSettings = {
      theme: 'hacked_theme_name',
      temperature: 9999,
      maxTokens: -50,
      apiKey: 'secret_key_that_should_be_stripped',
    }

    const safeSettings = normalizeSettings(maliciousSettings)

    expect(safeSettings.theme).toBe('chatbot')
    expect(THEMES[safeSettings.theme]).toBeDefined()
    expect(THEMES[safeSettings.theme].name).toBeDefined()
    expect(safeSettings.apiKey).toBe('') // Unconditionally stripped
    expect(safeSettings.temperature).toBe(2) // Clamped to max 2
    expect(safeSettings.maxTokens).toBe(16) // Clamped to min 16
  })

  it('bounds out-of-range and NaN numbers properly', () => {
    expect(normalizeBoundedNumber(0.7, 0, 2, 0.85)).toBe(0.7)
    expect(normalizeBoundedNumber(5.5, 0, 2, 0.85)).toBe(2)
    expect(normalizeBoundedNumber(-1, 0, 2, 0.85)).toBe(0)
    expect(normalizeBoundedNumber(NaN, 0, 2, 0.85)).toBe(0.85)
    expect(normalizeBoundedNumber(Infinity, 0, 2, 0.85)).toBe(0.85)
    expect(normalizeBoundedNumber('invalid', 0, 2, 0.85)).toBe(0.85)
  })

  it('validates and sanitizes a complete backup structure', () => {
    const rawBackup = {
      settings: {
        theme: 'unknown',
        appearanceMode: 'unsupported',
        temperature: 0.9,
      },
      characters: [
        { id: 'char_1', name: 'Alice', theme: 'anime', age: '15' }, // Minor age should clamp to 18
        { invalid: true }, // Should be dropped
      ],
      worlds: [
        { id: 'wld_1', name: 'Cyberpunk' },
      ],
      conversations: [
        {
          id: 'conv_1',
          theme: 'corrupt_theme',
          title: 'My Chat',
          messages: [{ id: 'm1', role: 'user', content: 'Hi' }],
        },
      ],
    }

    const result = validateAndSanitizeBackup(rawBackup)

    expect(result.valid).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.settings.theme).toBe('chatbot')
    expect(result.data!.settings.appearanceMode).toBe('dark')
    expect(result.data!.characters.length).toBe(1)
    expect(result.data!.characters[0].age).toBe('18') // Adult clamp
    expect(result.data!.conversations[0].theme).toBe('chatbot')
  })

  it('rejects completely invalid backup payloads gracefully', () => {
    expect(validateAndSanitizeBackup(null).valid).toBe(false)
    expect(validateAndSanitizeBackup('not a json object').valid).toBe(false)
    expect(validateAndSanitizeBackup([1, 2, 3]).valid).toBe(false)
  })
})
