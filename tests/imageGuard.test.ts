import { describe, expect, it } from 'vitest'
import { isObviousExplicit } from '../src/lib/imageGuard'

describe('imageGuard', () => {
  it('detects explicit keywords and rejects explicit prompts', () => {
    expect(isObviousExplicit('A nude portrait of a character on the bed')).toBe(true)
    expect(isObviousExplicit('Explicit nsfw photo with nudity')).toBe(true)
    expect(isObviousExplicit('Graphic gore and violence scene')).toBe(true)

    // Non-explicit creative visual prompts are accepted
    expect(isObviousExplicit('A futuristic cyberpunk skyline at twilight with neon holograms')).toBe(false)
    expect(isObviousExplicit('A warrior in golden ornate armor holding a glowing crystal staff')).toBe(false)
    expect(isObviousExplicit('A cozy library filled with ancient leatherbound books and warm candlelight')).toBe(false)
  })
})
