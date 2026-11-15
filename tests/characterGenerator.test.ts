import { describe, it, expect } from 'vitest'
import {
  extractAndParseJSON,
  repairJsonStructure,
  formatFullCharacterPrompt,
  type GeneratedCharacterProfile,
} from '../src/lib/characterGenerator'

describe('AI Character Generator Reliability & Parsing (characterGenerator)', () => {
  it('parses valid JSON wrapped in markdown code fences', () => {
    const raw = `
Here is your generated character profile:
\`\`\`json
{
  "name": "Kaelen Voss",
  "tagline": "Shadow Operative",
  "gender": "Male",
  "age": "26",
  "appearance": "Tall, dressed in dark tactical gear.",
  "personality": "Pragmatic, reserved, perceptive.",
  "backstory": "Former intelligence agent.",
  "speakingStyle": "Low and precise.",
  "behavior": "Always watches the exits.",
  "likesAndDislikes": "Likes quiet, dislikes noise.",
  "strengthsAndWeaknesses": "High discipline, trust issues.",
  "scenario": "Meeting in a dimly lit alley.",
  "greeting": "*steps out from the shadows* Who sent you?",
  "systemInstructions": "Stay in character, concise answers.",
  "tags": ["stealth", "cyberpunk", "agent"],
  "avatar": "🗡️",
  "avatarColor": "#0ea5e9"
}
\`\`\`
Hope you like this character!
`
    const parsed = extractAndParseJSON(raw)
    expect(parsed.name).toBe('Kaelen Voss')
    expect(parsed.age).toBe('26')
    expect(parsed.tags).toEqual(['stealth', 'cyberpunk', 'agent'])
    expect(parsed.greeting).toBe('*steps out from the shadows* Who sent you?')
  })

  it('repairs trailing commas and unescaped newlines in JSON text', () => {
    const broken = `{
      "name": "Seraphina",
      "tagline": "Starlight Weaver",
      "personality": "Ethereal and poetic.
Likes starry nights.",
      "tags": ["celestial", "magic",],
    }`

    const repaired = repairJsonStructure(broken)
    const parsed = JSON.parse(repaired)
    expect(parsed.name).toBe('Seraphina')
    expect(parsed.personality).toContain('Ethereal and poetic.')
  })

  it('extracts fields using regex fallback when JSON structure is heavily truncated', () => {
    const truncated = `
{
  "name": "Eldrin Thorne",
  "tagline": "The Last Warden",
  "age": "34",
  "personality": "Grounded, stoic, unwavering loyalty to the grove.",
  "appearance": "Weathered green cloak, silver hair tied back
`
    const parsed = extractAndParseJSON(truncated)
    expect(parsed.name).toBe('Eldrin Thorne')
    expect(parsed.tagline).toBe('The Last Warden')
    expect(parsed.personality).toContain('Grounded, stoic')
  })

  it('formats full character prompt with markdown sections', () => {
    const profile: GeneratedCharacterProfile = {
      name: 'Lyra',
      tagline: 'Solar Priestess',
      gender: 'Female',
      age: '24',
      appearance: 'Golden robes and amber eyes.',
      personality: 'Warm and empathetic.',
      backstory: 'Raised in the Sun Temple.',
      speakingStyle: 'Gentle, soothing cadence.',
      behavior: 'Offers tea to visitors.',
      likesAndDislikes: 'Likes sunrise, dislikes storms.',
      strengthsAndWeaknesses: 'Healing magic, overly trusting.',
      scenario: 'Temple courtyard at dawn.',
      greeting: '*smiles warmly* May the sun light your path.',
      systemInstructions: 'Act as a compassionate priestess.',
      tags: ['temple', 'healer', 'fantasy'],
      avatar: '☀️',
      avatarColor: '#ffa34d',
    }

    const formatted = formatFullCharacterPrompt(profile)
    expect(formatted).toContain('# Lyra')
    expect(formatted).toContain('*Solar Priestess*')
    expect(formatted).toContain('## Appearance')
    expect(formatted).toContain('## Personality & Psychology')
    expect(formatted).toContain('## Background & Lore')
    expect(formatted).toContain('## Directives & Roleplay Rules')
  })
})
