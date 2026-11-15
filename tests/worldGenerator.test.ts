import { describe, it, expect } from 'vitest'
import {
  extractWorldJson,
} from '../src/lib/worldGenerator'
import { buildMediaWikiSearchUrl, formatWikiSummary } from '../src/lib/lookup'

describe('AI World Generator & MediaWiki Lookup', () => {
  it('parses valid world JSON from LLM output', () => {
    const raw = `
\`\`\`json
{
  "name": "Aethelgard",
  "genre": "High Fantasy",
  "description": "A realm suspended over the eternal abyss.",
  "rules": "Magic requires physical blood sacrifice.",
  "playerName": "Rowan",
  "playerRole": "Wandering Scholar",
  "playerAppearance": "Clothed in traveler robes with a copper compass.",
  "locations": "The Spire of Dawn, The Sunken Crypts",
  "factions": "The Silver Order, The Ash Seekers",
  "lore": "Five centuries ago, the moon shattered.",
  "color": "#7c5cff"
}
\`\`\`
`
    const parsed = extractWorldJson(raw)
    expect(parsed.name).toBe('Aethelgard')
    expect(parsed.genre).toBe('High Fantasy')
    expect(parsed.playerName).toBe('Rowan')
    expect(parsed.color).toBe('#7c5cff')
  })

  it('constructs correct MediaWiki API URLs for Wikipedia and Fandom', () => {
    const wikiUrl = buildMediaWikiSearchUrl('https://en.wikipedia.org/w/api.php', 'Neon Genesis Evangelion')
    expect(wikiUrl).toContain('origin=*')
    expect(wikiUrl).toContain('action=query')
    expect(wikiUrl).toContain('format=json')
    expect(wikiUrl).toContain('Neon%20Genesis%20Evangelion')
  })

  it('formats wiki summaries cleanly without extra markup', () => {
    const rawWikiSnippet = '<span>Evangelion</span> is an anime series created by Hideaki Anno.'
    const cleaned = formatWikiSummary(rawWikiSnippet)
    expect(cleaned).not.toContain('<span>')
    expect(cleaned).toContain('Evangelion is an anime series')
  })
})
