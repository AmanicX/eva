import { chatGroq, providerNeedsKey } from './groq'
import { MIN_AGE } from '@/store/useStore'

export interface GeneratedCharacterProfile {
  name: string
  tagline: string
  gender: string
  age: string
  appearance: string
  personality: string
  backstory: string
  speakingStyle: string
  behavior: string
  likesAndDislikes: string
  strengthsAndWeaknesses: string
  scenario: string
  greeting: string
  systemInstructions: string
  tags: string[]
  avatar: string
  avatarColor: string
}

export type CharacterComplexity = 'simple' | 'detailed' | 'very_detailed'
export type WritingStyle = 'standard' | 'literary' | 'anime' | 'cinematic' | 'gritty'
export type RoleplayFocus = 'roleplay' | 'companion' | 'adventure' | 'general'

export interface GeneratorOptions {
  description: string
  complexity?: CharacterComplexity
  writingStyle?: WritingStyle
  roleplayFocus?: RoleplayFocus
}

export type CharacterSectionKey =
  | 'name'
  | 'tagline'
  | 'gender'
  | 'age'
  | 'appearance'
  | 'personality'
  | 'backstory'
  | 'speakingStyle'
  | 'behavior'
  | 'likesAndDislikes'
  | 'strengthsAndWeaknesses'
  | 'scenario'
  | 'greeting'
  | 'systemInstructions'
  | 'tags'

export interface SectionMeta {
  key: CharacterSectionKey
  label: string
  description: string
  multiline: boolean
  rows?: number
  placeholder: string
}

export const CHARACTER_SECTIONS: SectionMeta[] = [
  {
    key: 'personality',
    label: 'Personality & Psychology',
    description: 'Temperament, core psychological traits, mindset, quirks, and emotional disposition.',
    multiline: true,
    rows: 4,
    placeholder: 'Describe their core personality traits, psychological motivations, demeanor...',
  },
  {
    key: 'appearance',
    label: 'Appearance & Visuals',
    description: 'Physical build, height, facial features, eyes, hair, clothing, and distinctive marks.',
    multiline: true,
    rows: 4,
    placeholder: 'Physical description, clothing, distinct visual markers...',
  },
  {
    key: 'backstory',
    label: 'Background & Lore',
    description: 'Origin, personal history, past events, relationships, secrets, and formative experiences.',
    multiline: true,
    rows: 4,
    placeholder: 'Origin, formative events, history, personal relationships...',
  },
  {
    key: 'speakingStyle',
    label: 'Speaking Style & Dialogue',
    description: 'Tone of voice, vocabulary, speech cadence, quirks, catchphrases, and sample dialogue.',
    multiline: true,
    rows: 3,
    placeholder: 'Speech cadence, distinctive phrases, tone, vocabulary level...',
  },
  {
    key: 'behavior',
    label: 'Behavior & Mannerisms',
    description: 'Habits, non-verbal communication, posture, micro-actions, and how they react to others.',
    multiline: true,
    rows: 3,
    placeholder: 'Habits, unconscious mannerisms, body language, social dynamics...',
  },
  {
    key: 'likesAndDislikes',
    label: 'Likes & Dislikes',
    description: 'Specific passions, hobbies, pet peeves, hatreds, and personal preferences.',
    multiline: true,
    rows: 2,
    placeholder: 'Likes: ... Dislikes: ...',
  },
  {
    key: 'strengthsAndWeaknesses',
    label: 'Strengths & Flaws',
    description: 'Key competencies, gifts, cognitive biases, emotional vulnerabilities, and physical flaws.',
    multiline: true,
    rows: 2,
    placeholder: 'Strengths: ... Weaknesses: ...',
  },
  {
    key: 'scenario',
    label: 'Roleplay Scenario & Setting',
    description: 'The initial scene, location, immediate context, and premise when the chat begins.',
    multiline: true,
    rows: 3,
    placeholder: 'The scene setting, current situation, premise of interaction...',
  },
  {
    key: 'greeting',
    label: 'Opening Greeting (First Message)',
    description: 'The opening line or action the character sends when starting a new conversation.',
    multiline: true,
    rows: 3,
    placeholder: '*Looks over attentively with a subtle smirk.* "You took your time finding me..."',
  },
  {
    key: 'systemInstructions',
    label: 'System & Roleplay Directives',
    description: 'Specific operational rules and constraints for the AI roleplaying as this character.',
    multiline: true,
    rows: 3,
    placeholder: 'Roleplay directives, emotional pacing, response style guidelines...',
  },
]

const EMOJI_PALETTE = ['✦', '❀', '☾', '🌙', '⚔️', '🔥', '❄️', '⚡', '🌸', '🖤', '🐉', '🦊', '👑', '🎭', '🕊️', '🐺', '🌊', '🍥', '⛩️', '💫', '🌺', '🃏', '🗡️', '🛡️', '🎴', '🧿', '🪷', '☯️', '🍡', '🌌', '🔮', '✨', '🥀', '🦋']
const COLOR_PALETTE = ['#7c5cff', '#b45cff', '#ff6fae', '#ff5f9e', '#34d399', '#0ea5e9', '#37d7e8', '#ffa34d', '#ff8a5c', '#f472b6', '#a78bfa', '#66d0ff', '#e0466a', '#8fd8a8']

/**
 * Robust JSON parser that handles code blocks, unescaped characters, and partial payloads.
 */
function extractAndParseJSON(raw: string): any {
  let cleaned = raw.trim()

  // Remove markdown code fences if present
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (codeBlockMatch?.[1]) {
    cleaned = codeBlockMatch[1].trim()
  }

  // Find first { and last }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  try {
    return JSON.parse(cleaned)
  } catch {
    // Try cleaning trailing commas
    const withoutTrailingCommas = cleaned.replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(withoutTrailingCommas)
  }
}

/**
 * Builds the full persona markdown prompt from structured character profile.
 */
export function formatFullCharacterPrompt(p: GeneratedCharacterProfile): string {
  const parts: string[] = []

  parts.push(`# ${p.name || 'Unnamed Character'}`)
  if (p.tagline) parts.push(`*${p.tagline}*`)
  parts.push('')

  const quickStats: string[] = []
  if (p.gender) quickStats.push(`**Gender:** ${p.gender}`)
  if (p.age) quickStats.push(`**Age:** ${p.age}`)
  if (p.tags?.length) quickStats.push(`**Tags:** ${p.tags.join(', ')}`)
  if (quickStats.length) {
    parts.push(quickStats.join(' · '))
    parts.push('')
  }

  if (p.appearance) {
    parts.push(`## Appearance`)
    parts.push(p.appearance)
    parts.push('')
  }

  if (p.personality) {
    parts.push(`## Personality & Psychology`)
    parts.push(p.personality)
    parts.push('')
  }

  if (p.backstory) {
    parts.push(`## Background & Lore`)
    parts.push(p.backstory)
    parts.push('')
  }

  if (p.speakingStyle) {
    parts.push(`## Speaking Style & Cadence`)
    parts.push(p.speakingStyle)
    parts.push('')
  }

  if (p.behavior) {
    parts.push(`## Behavior & Mannerisms`)
    parts.push(p.behavior)
    parts.push('')
  }

  if (p.likesAndDislikes) {
    parts.push(`## Likes & Dislikes`)
    parts.push(p.likesAndDislikes)
    parts.push('')
  }

  if (p.strengthsAndWeaknesses) {
    parts.push(`## Strengths & Weaknesses`)
    parts.push(p.strengthsAndWeaknesses)
    parts.push('')
  }

  if (p.scenario) {
    parts.push(`## Setting & Scenario`)
    parts.push(p.scenario)
    parts.push('')
  }

  if (p.systemInstructions) {
    parts.push(`## Directives & Roleplay Rules`)
    parts.push(p.systemInstructions)
    parts.push('')
  }

  return parts.join('\n').trim()
}

/**
 * Generates a complete structured character from a natural language prompt.
 */
export async function generateCharacterProfile(opts: {
  description: string
  complexity?: CharacterComplexity
  writingStyle?: WritingStyle
  roleplayFocus?: RoleplayFocus
  provider: {
    apiKey: string
    baseUrl?: string
    model: string
  }
  signal?: AbortSignal
}): Promise<GeneratedCharacterProfile> {
  const { description, complexity = 'detailed', writingStyle = 'standard', roleplayFocus = 'roleplay', provider, signal } = opts

  if (!description.trim()) {
    throw new Error('Please provide a character description.')
  }

  if (providerNeedsKey(provider.baseUrl) && !provider.apiKey.trim()) {
    throw new Error('No API key configured. Open Settings → Connection and enter your API key.')
  }

  const complexityInstructions = {
    simple: 'Concise and impactful. Focus on core distinctive traits without extraneous filler.',
    detailed: 'Rich, vivid, and multi-layered. Explore psychological nuances, subtle mannerisms, and distinctive vocal texture.',
    very_detailed: 'Highly elaborate and deeply fleshed out. Include deep backstory elements, unconscious habits, subtle contradictions, and evocative sensory details.',
  }[complexity]

  const styleInstructions = {
    standard: 'Balanced, engaging, evocative modern English suitable for high-immersion roleplay.',
    literary: 'Sophisticated prose, elegant vocabulary, poetic imagery, and psychological depth.',
    anime: 'Dynamic anime/light-novel flair, memorable tropes elevated with genuine emotional resonance.',
    cinematic: 'Atmospheric, punchy, visually striking descriptions akin to a high-budget film screenplay.',
    gritty: 'Raw, grounded, realistic, unvarnished portrayal with moral complexity and visceral weight.',
  }[writingStyle]

  const focusInstructions = {
    roleplay: 'Tailored for interactive roleplay and dialogue. Emphasize how the character engages with the user in active scenes.',
    companion: 'Focus on emotional connection, warmth, ongoing relationship dynamics, and supportive banter.',
    adventure: 'Focus on combat competencies, world exploration, factional alignments, and quests.',
    general: 'Versatile persona adaptable to diverse conversations, advice, creative storytelling, and queries.',
  }[roleplayFocus]

  const systemPrompt = `You are a master character designer, narrative novelist, and roleplay architect.
Your mission is to transform the user's natural language description into an extraordinary, complete, multi-dimensional character profile.

Rules:
1. Preserve every explicit detail the user requested (name, hair, age, traits, abilities, quirks). Never contradict their intent.
2. Develop all missing dimensions organically so the character feels fully alive, coherent, and captivating.
3. The character must be at least ${MIN_AGE} years of age.
4. Output MUST be valid, parseable JSON only with NO markdown fences, NO preamble, and NO extra conversational commentary.

JSON Schema to output:
{
  "name": "Full character name",
  "tagline": "A punchy, memorable one-line descriptor / epithet",
  "gender": "Gender identity (e.g. Female, Male, Non-binary...)",
  "age": "Age as a number string (e.g. \\"22\\", must be >= ${MIN_AGE})",
  "appearance": "Detailed physical description: build, facial structure, eyes, hair color/style, clothing, signature accessories, posture",
  "personality": "Core psychological profile: values, emotional temperament, defense mechanisms, quirks, contradictions that make them human",
  "backstory": "Formative history: origins, pivotal events, relationships, secrets, triumphs or trauma that shaped who they are today",
  "speakingStyle": "Voice & dialogue: vocal tone, pacing, vocabulary preferences, verbal habits/catchphrases, and sample dialogue lines",
  "behavior": "Physical mannerisms: unconscious gestures, habits when nervous or amused, posture, how they physically occupy a room",
  "likesAndDislikes": "Sensory, culinary, social, or philosophical likes and pet peeves",
  "strengthsAndWeaknesses": "Key talents, virtues, cognitive biases, emotional vulnerabilities, physical limits",
  "scenario": "Immediate scene setting: where the character is right now, the atmospheric backdrop, and the initial interactive hook",
  "greeting": "The opening in-character message starting the conversation, including action asterisks and dialogue (*looks up with curiosity* \\"...\\")",
  "systemInstructions": "Key instructions for the AI playing this character: speech rules, relationship progression, boundary behavior",
  "tags": ["3 to 6 short keywords", "personality", "genre", "aesthetic"],
  "avatar": "A single evocative emoji representing this character (e.g. 🌙, ⚔️, 🔮, 🦊, 🌸...)",
  "avatarColor": "A hex color code matching their visual aesthetic from: ${COLOR_PALETTE.join(', ')}"
}`

  const userPrompt = `Create a character profile based on the following input:

User Description:
"""
${description.trim()}
"""

Design Preferences:
- Depth & Complexity: ${complexityInstructions}
- Tone & Writing Style: ${styleInstructions}
- Character Role: ${focusInstructions}

Generate the complete JSON character profile now.`

  const rawOutput = await chatGroq({
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: provider.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.75,
    maxTokens: 2500,
    signal,
  })

  let parsed: any
  try {
    parsed = extractAndParseJSON(rawOutput)
  } catch (err: any) {
    throw new Error(`Failed to parse character profile from AI: ${err.message || 'Invalid format'}. Please try again.`)
  }

  // Validate and sanitize fields
  const safeAge = String(parsed.age || '22').replace(/\D/g, '')
  const numericAge = Number(safeAge) || 22
  const finalAge = String(Math.max(MIN_AGE, Math.min(120, numericAge)))

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 8)
    : ['original', 'character']

  const randomColor = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]
  const randomEmoji = EMOJI_PALETTE[Math.floor(Math.random() * EMOJI_PALETTE.length)]

  return {
    name: String(parsed.name || 'Unnamed Character').trim(),
    tagline: String(parsed.tagline || '').trim(),
    gender: String(parsed.gender || 'Unknown').trim(),
    age: finalAge,
    appearance: String(parsed.appearance || '').trim(),
    personality: String(parsed.personality || '').trim(),
    backstory: String(parsed.backstory || '').trim(),
    speakingStyle: String(parsed.speakingStyle || '').trim(),
    behavior: String(parsed.behavior || '').trim(),
    likesAndDislikes: String(parsed.likesAndDislikes || '').trim(),
    strengthsAndWeaknesses: String(parsed.strengthsAndWeaknesses || '').trim(),
    scenario: String(parsed.scenario || '').trim(),
    greeting: String(parsed.greeting || '').trim(),
    systemInstructions: String(parsed.systemInstructions || '').trim(),
    tags,
    avatar: String(parsed.avatar || randomEmoji).trim().slice(0, 4) || randomEmoji,
    avatarColor: String(parsed.avatarColor || randomColor).trim(),
  }
}

/**
 * Regenerates an individual section of the character profile while strictly preserving
 * all other sections and maintaining full character consistency.
 */
export async function regenerateCharacterSection(opts: {
  currentProfile: GeneratedCharacterProfile
  sectionKey: CharacterSectionKey
  originalDescription: string
  customInstruction?: string
  provider: {
    apiKey: string
    baseUrl?: string
    model: string
  }
  signal?: AbortSignal
}): Promise<string | string[]> {
  const { currentProfile, sectionKey, originalDescription, customInstruction, provider, signal } = opts

  if (providerNeedsKey(provider.baseUrl) && !provider.apiKey.trim()) {
    throw new Error('No API key configured. Open Settings → Connection and enter your API key.')
  }

  const sectionMeta = CHARACTER_SECTIONS.find((s) => s.key === sectionKey)
  const sectionLabel = sectionMeta?.label ?? sectionKey

  const systemPrompt = `You are a master character designer and narrative editor.
You are regenerating ONLY the "${sectionLabel}" section of an established character profile.

CRITICAL INSTRUCTIONS:
1. Maintain total narrative and psychological consistency with the character's established identity:
   - Name: ${currentProfile.name}
   - Tagline: ${currentProfile.tagline}
   - Gender: ${currentProfile.gender}, Age: ${currentProfile.age}
   - Core Personality: ${currentProfile.personality.slice(0, 300)}...
   - Backstory context: ${currentProfile.backstory.slice(0, 300)}...
2. Do NOT change, contradict, or invalidate any other established traits.
3. Follow the user's specific directive for this section if provided.
4. Output MUST be valid JSON with a single key "${sectionKey}".
   For text fields: { "${sectionKey}": "new regenerated content..." }
   For tags: { "${sectionKey}": ["tag1", "tag2", "tag3"] }
   No conversational filler, no markdown code block wrapper.`

  const userPrompt = `Established Character Context:
- Name: ${currentProfile.name}
- Age & Gender: ${currentProfile.age}, ${currentProfile.gender}
- Core Concept: ${originalDescription}
- Current "${sectionLabel}":
"""
${Array.isArray(currentProfile[sectionKey]) ? (currentProfile[sectionKey] as string[]).join(', ') : currentProfile[sectionKey]}
"""

${customInstruction?.trim() ? `User's Specific Refinement Instruction for this section:\n"""\n${customInstruction.trim()}\n"""\n` : ''}
Please regenerate and enhance ONLY the "${sectionLabel}" section now. Return valid JSON: { "${sectionKey}": ... }`

  const rawOutput = await chatGroq({
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: provider.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    maxTokens: 1000,
    signal,
  })

  let parsed: any
  try {
    parsed = extractAndParseJSON(rawOutput)
  } catch (err: any) {
    // Fallback: If model returned plain text instead of JSON, use the raw text
    const cleanText = rawOutput.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
    if (cleanText) return cleanText
    throw new Error(`Failed to parse regenerated section: ${err.message}`)
  }

  const result = parsed[sectionKey] ?? parsed.value ?? parsed.content ?? parsed.result
  if (result === undefined || result === null) {
    // If the object has only one key, use its value
    const keys = Object.keys(parsed)
    if (keys.length === 1) return parsed[keys[0]]
    throw new Error(`The AI response did not contain the updated ${sectionLabel}.`)
  }

  if (sectionKey === 'tags') {
    if (Array.isArray(result)) {
      return result.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    }
    if (typeof result === 'string') {
      return result.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    }
  }

  return String(result).trim()
}
