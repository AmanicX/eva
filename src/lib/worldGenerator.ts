/**
 * AI World Generator & Section Regeneration for Eva World Studio
 *
 * Transforms natural language world descriptions into complete, structured
 * world bibles matching the existing World Studio schema (premise, rules,
 * player identity, locations, factions, timeline, and starting NPC roster).
 */

import { executeChatWithFallback } from './fallbackEngine'
import type { Settings } from '@/types'

const COLOR_PALETTE = [
  '#7c5cff', '#b45cff', '#ff6fae', '#ff5f9e', '#34d399', '#0ea5e9',
  '#37d7e8', '#ffa34d', '#ff8a5c', '#f472b6', '#a78bfa', '#66d0ff',
  '#e0466a', '#8fd8a8',
]

export interface GeneratedNPC {
  name: string
  role: string
  tagline: string
  description: string
  reputation: number // -100 to 100
  avatar: string
  avatarColor: string
}

export interface GeneratedWorldProfile {
  name: string
  genre: string
  description: string
  rules: string
  playerName: string
  playerRole: string
  playerAppearance: string
  locations: string
  factions: string
  lore: string
  avatar: string
  avatarColor: string
  color?: string
  npcs: GeneratedNPC[]
}

export type WorldSectionKey =
  | 'name'
  | 'genre'
  | 'description'
  | 'rules'
  | 'playerName'
  | 'playerRole'
  | 'playerAppearance'
  | 'locations'
  | 'factions'
  | 'lore'
  | 'npcs'

export interface GenerateWorldOptions {
  description: string
  genre?: string
  lookupReference?: string
  settings: Settings
  preferredModel?: { providerId?: string; model?: string } | null
  signal?: AbortSignal
}

export function extractWorldJson(raw: string, defaultGenre = 'Fictional Universe'): GeneratedWorldProfile {
  const cleanJson = raw.replace(/^```json|^```|```$/gm, '').trim()
  const firstBrace = cleanJson.indexOf('{')
  const lastBrace = cleanJson.lastIndexOf('}')
  const jsonSlice = firstBrace !== -1 && lastBrace !== -1 ? cleanJson.slice(firstBrace, lastBrace + 1) : cleanJson

  const parsed = JSON.parse(jsonSlice)
  return {
    name: String(parsed.name || 'Unnamed World').trim(),
    genre: String(parsed.genre || defaultGenre).trim(),
    description: String(parsed.description || '').trim(),
    rules: String(parsed.rules || '').trim(),
    playerName: String(parsed.playerName || 'Traveler').trim(),
    playerRole: String(parsed.playerRole || 'Observer').trim(),
    playerAppearance: String(parsed.playerAppearance || '').trim(),
    locations: String(parsed.locations || '').trim(),
    factions: String(parsed.factions || '').trim(),
    lore: String(parsed.lore || '').trim(),
    avatar: String(parsed.avatar || '🪐').trim(),
    avatarColor: String(parsed.avatarColor || parsed.color || '#38bdf8').trim(),
    color: String(parsed.color || parsed.avatarColor || '#38bdf8').trim(),
    npcs: Array.isArray(parsed.npcs)
      ? parsed.npcs.map((n: any) => ({
          name: String(n.name || 'NPC').trim(),
          role: String(n.role || 'Inhabitant').trim(),
          tagline: String(n.tagline || '').trim(),
          description: String(n.description || '').trim(),
          reputation: Number(n.reputation) || 0,
          avatar: String(n.avatar || '👤').trim(),
          avatarColor: String(n.avatarColor || '#818cf8').trim(),
        }))
      : [],
  }
}

export async function generateWorldProfile(
  opts: GenerateWorldOptions,
): Promise<GeneratedWorldProfile> {
  const { description, genre = 'Fictional Universe', lookupReference, settings, preferredModel, signal } = opts

  if (!description.trim()) {
    throw new Error('Please enter a description for the world you want to build.')
  }

  const systemPrompt = `You are a visionary worldbuilding architect, fantasy novelist, and sci-fi lore master.
Transform the user's concept into a rich, living, immersive fictional universe.

Output MUST be valid, parseable JSON matching the following schema with NO markdown fences, preamble, or commentary:
{
  "name": "Evocative world/city/realm name",
  "genre": "Genre descriptor (e.g. Cyberpunk Noir, High Fantasy, Space Opera...)",
  "description": "Comprehensive premise and overview: atmosphere, daily reality, core themes, and central conflicts (2-3 rich paragraphs)",
  "rules": "Laws of nature, magic system limits, technology constraints, or societal taboos that govern this universe",
  "playerName": "Suggested protagonist name",
  "playerRole": "Protagonist social standing, occupation, or role in the world",
  "playerAppearance": "Detailed physical description of protagonist: clothing, gear, distinctive markers",
  "locations": "Detailed descriptions of 3 to 5 key districts, landmarks, taverns, or sectors",
  "factions": "2 to 4 major rival factions, corporations, guilds, or syndicates with their agendas and power dynamics",
  "lore": "Chronological timeline of pivotal historical events that shaped the current era",
  "avatar": "A single evocative emoji for this world (e.g. 🪐, 🏰, 🌆, 🌌, 🌋)",
  "avatarColor": "A hex color code from: ${COLOR_PALETTE.join(', ')}",
  "npcs": [
    {
      "name": "NPC name",
      "role": "NPC role or occupation",
      "tagline": "Short evocative title",
      "description": "Personality, motivations, and secrets",
      "reputation": 0,
      "avatar": "Single emoji",
      "avatarColor": "Hex color code"
    }
  ]
}`

  const userPrompt = `Build a complete world bible based on this concept:
"""
${description.trim()}
"""
${genre ? `Genre guideline: ${genre}` : ''}
${lookupReference ? `Online Canon Reference Material:\n"""\n${lookupReference}\n"""\n` : ''}

Generate the world as a JSON object now:`

  const result = await executeChatWithFallback({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    preferredCandidate: preferredModel,
    settings,
    temperature: 0.75,
    maxTokens: 2500,
    signal,
  })

  return extractWorldJson(result.content, genre)
}

/**
 * Regenerates an individual section of a world without altering other fields.
 */
export async function regenerateWorldSection(opts: {
  world: GeneratedWorldProfile
  section: WorldSectionKey
  instruction?: string
  prompt?: string
  settings: Settings
  preferredModel?: { providerId?: string; model?: string } | null
  signal?: AbortSignal
}): Promise<GeneratedWorldProfile> {
  const { world, section, instruction, prompt, settings, preferredModel, signal } = opts
  const userInstruction = instruction || prompt || ''

  const systemPrompt = `You are a worldbuilding designer. Regenerate ONLY the requested section of the world.
World Name: "${world.name}" (${world.genre})
Premise: "${world.description.slice(0, 300)}"

Respond ONLY with the new content for this section. No markdown fences, no conversational text.`

  const userPrompt = `Section to regenerate: "${section}".
${userInstruction ? `Specific direction: ${userInstruction}` : 'Make it fresh, evocative, and deeply atmospheric.'}
${section === 'npcs' ? 'Output MUST be a valid JSON array of NPC objects.' : 'Output plain formatted text.'}`

  const result = await executeChatWithFallback({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    preferredCandidate: preferredModel,
    settings,
    temperature: 0.8,
    maxTokens: 1000,
    signal,
  })

  const raw = result.content.trim()

  if (section === 'npcs') {
    try {
      const cleanJson = raw.replace(/^```json|^```|```$/gm, '').trim()
      const parsed = JSON.parse(cleanJson)
      if (Array.isArray(parsed)) {
        const npcs = parsed.map((n: any) => ({
          name: String(n.name || 'NPC').trim(),
          role: String(n.role || 'Inhabitant').trim(),
          tagline: String(n.tagline || '').trim(),
          description: String(n.description || '').trim(),
          reputation: Number(n.reputation) || 0,
          avatar: String(n.avatar || '👤').trim(),
          avatarColor: String(n.avatarColor || '#818cf8').trim(),
        }))
        return { ...world, npcs }
      }
    } catch {
      return world
    }
  }

  return { ...world, [section]: raw }
}
