/**
 * Scene Suggestion Generator for In-Chat Image Generation
 *
 * Prompts the chosen LLM with recent chat history, character appearance, and world lore
 * to produce 4 to 6 vivid visual scene descriptions formatted as strict JSON.
 */

import { executeChatWithFallback } from './fallbackEngine'
import type { Character, Conversation, Settings, World } from '@/types'

export interface SceneSuggestion {
  title: string
  prompt: string
}

export interface GenerateSceneOptions {
  conversation: Conversation
  character?: Character
  world?: World
  settings: Settings
  preferredChatModel?: { providerId?: string; model?: string } | null
  signal?: AbortSignal
}

export async function generateSceneSuggestions(
  conversationOrOpts: Conversation | GenerateSceneOptions,
  characterArg?: Character,
  worldArg?: World | undefined,
  settingsArg?: Settings,
  preferredChatModelArg?: { providerId?: string; model?: string } | null,
  signalArg?: AbortSignal,
): Promise<SceneSuggestion[]> {
  const opts: GenerateSceneOptions =
    'conversation' in conversationOrOpts
      ? conversationOrOpts
      : {
          conversation: conversationOrOpts,
          character: characterArg,
          world: worldArg,
          settings: settingsArg!,
          preferredChatModel: preferredChatModelArg,
          signal: signalArg,
        }

  const { conversation, character, world, settings, preferredChatModel, signal } = opts

  // 1. Gather recent context window (last 6 messages)
  const charName = character?.name || 'Character'
  const recentMessages = conversation.messages
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : charName}: ${m.content.slice(0, 300)}`)
    .join('\n')

  // 2. Extract character appearance
  const appearance = character?.description || character?.tagline || ''
  const worldContext = world
    ? `World: ${world.name} (${world.genre}). Overview: ${world.description.slice(0, 200)}.`
    : ''

  const systemPrompt = `You are a creative visual art director for an AI story studio.
Your task is to generate 4 to 6 distinct, vivid scene ideas based on the current scene and character.
Each scene must include:
- A short descriptive title (2-5 words)
- A detailed visual image prompt for an art generator specifying subject(s), appearance, environment/setting, camera composition, lighting, and atmospheric mood.

IMPORTANT REQUIREMENTS:
- Prompts must be strictly NON-EXPLICIT, NON-SEXUAL, and safe for all audiences. Focus on emotional intimacy, cinematic framing, action, or evocative scenery.
- Respond ONLY with a valid JSON array of objects. Do not write markdown text, greetings, or conversational filler.
Format:
[
  {
    "title": "Short Title",
    "prompt": "Detailed cinematic prompt with subjects, setting, lighting, style..."
  }
]`

  const charInfo = character
    ? `Character: ${character.name} (${character.tagline || ''})`
    : 'Characters: Dialogue participants'
  const userPrompt = `${charInfo}
${appearance ? `Appearance details: ${appearance.slice(0, 300)}` : ''}
${worldContext}

Recent dialogue & story moments:
${recentMessages || 'Scene start.'}

Generate 4 to 6 creative visual scene prompts as a JSON array:`

  const attemptGeneration = async (): Promise<SceneSuggestion[]> => {
    const result = await executeChatWithFallback({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      preferredCandidate: preferredChatModel,
      settings,
      temperature: 0.7,
      maxTokens: 1200,
      signal,
    })

    const raw = result.content.trim()
    const cleanJson = raw.replace(/^```json|^```|```$/gm, '').trim()

    // Find JSON array in output
    const match = cleanJson.match(/\[[\s\S]*\]/)
    if (!match) {
      throw new Error('LLM did not return a valid JSON array of scenes.')
    }

    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Scene suggestions array was empty.')
    }

    return parsed.map((item: any) => ({
      title: String(item.title || 'Untitled Scene').trim(),
      prompt: String(item.prompt || '').trim(),
    })).filter((s) => s.prompt.length > 10)
  }

  try {
    return await attemptGeneration()
  } catch {
    // Retry once on malformed JSON
    return await attemptGeneration()
  }
}
