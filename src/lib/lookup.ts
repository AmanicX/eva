/**
 * Internet Lookup Engine for Character & World Generation
 *
 * Uses keyless, public, CORS-compliant MediaWiki APIs (Wikipedia and Fandom wikis)
 * to retrieve background lore, appearance details, and canon descriptions.
 * Never leaks private keys or user conversations in search queries.
 */

export interface LookupResult {
  title: string
  snippet: string
  source: string
  url: string
}

export interface LookupSummary {
  query: string
  sources: { title: string; url: string }[]
  content: string
}

export function buildMediaWikiSearchUrl(endpoint: string, query: string): string {
  const base = endpoint.replace(/\?.*$/, '')
  return `${base}?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`
}

export function formatWikiSummary(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '') // Strip HTML tags
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Searches Wikipedia and returns plain text summary extracts.
 */
export async function lookupOnlineInfo(
  query: string,
  signal?: AbortSignal,
): Promise<LookupSummary | null> {
  const cleanQuery = query.trim()
  if (!cleanQuery) return null

  try {
    // 1. Search for matching articles
    const searchUrl = buildMediaWikiSearchUrl('https://en.wikipedia.org/w/api.php', cleanQuery)
    const searchRes = await fetch(searchUrl, { signal })
    if (!searchRes.ok) return null
    const searchJson = await searchRes.json()
    const searchHits = searchJson?.query?.search
    if (!Array.isArray(searchHits) || searchHits.length === 0) {
      return null
    }

    const topHit = searchHits[0]
    const pageTitle = topHit.title

    // 2. Fetch page introductory extract
    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`
    const extractRes = await fetch(extractUrl, { signal })
    if (!extractRes.ok) return null
    const extractJson = await extractRes.json()

    const pages = extractJson?.query?.pages
    if (!pages) return null

    const pageId = Object.keys(pages)[0]
    const extract = pages[pageId]?.extract || ''

    if (!extract.trim()) {
      // Fallback to search snippets if extract is empty
      const snippets = searchHits
        .slice(0, 3)
        .map((hit: any) => hit.snippet.replace(/<[^>]+>/g, ''))
        .join('\n')
      return {
        query: cleanQuery,
        sources: [{ title: pageTitle, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}` }],
        content: snippets.slice(0, 1200),
      }
    }

    return {
      query: cleanQuery,
      sources: [
        {
          title: `Wikipedia: ${pageTitle}`,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
        },
      ],
      content: extract.slice(0, 1500),
    }
  } catch {
    // Lookup is best-effort; return null gracefully on network failure
    return null
  }
}
