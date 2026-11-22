import { describe, expect, it } from 'vitest'
import { applyImageStyle } from '@/lib/imageStyles'

describe('Explicit image style editor action', () => {
  it('leaves manual prompts byte-for-byte unchanged with As written', () => {
    expect(applyImageStyle('  My words.\n', 'natural')).toBe('  My words.\n')
  })
  it('adds a visible style directive only when requested', () => {
    expect(applyImageStyle('A red kite', 'anime')).toBe('A red kite\n\nStyle: Anime illustration, expressive linework, cel shading and carefully composed color.')
  })
})
