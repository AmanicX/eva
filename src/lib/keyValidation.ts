/**
 * API Key Format Validation Configuration & Engine for AI Providers
 *
 * Performs format-only checks without making network requests.
 * All patterns are kept in one config object for maintainability.
 */

export interface ProviderValidationRule {
  name: string
  pattern?: RegExp
  minLength?: number
  maxLength?: number
  fixedLength?: number
  startsWith?: string[]
  validate?: (key: string, extra?: { accountId?: string }) => { valid: boolean; error?: string }
  hint: string
  example: string
}

export const PROVIDER_KEY_RULES: Record<string, ProviderValidationRule> = {
  groq: {
    name: 'Groq',
    pattern: /^gsk_[A-Za-z0-9]{20,}$/,
    startsWith: ['gsk_'],
    minLength: 24,
    hint: 'Groq API keys start with "gsk_" followed by letters and numbers.',
    example: 'gsk_...',
  },
  openrouter: {
    name: 'OpenRouter',
    pattern: /^sk-or-(v1-)?[A-Za-z0-9_-]{16,}$/,
    startsWith: ['sk-or-'],
    minLength: 20,
    hint: 'OpenRouter API keys start with "sk-or-".',
    example: 'sk-or-v1-...',
  },
  openai: {
    name: 'OpenAI',
    pattern: /^sk-(proj-)?[A-Za-z0-9_-]{20,}$/,
    startsWith: ['sk-'],
    minLength: 23,
    hint: 'OpenAI API keys start with "sk-" or "sk-proj-".',
    example: 'sk-proj-...',
  },
  google: {
    name: 'Google AI Studio',
    pattern: /^AIza[0-9A-Za-z\-_]{35}$/,
    startsWith: ['AIza'],
    fixedLength: 39,
    hint: 'Google AI Studio keys start with "AIza" and are exactly 39 characters long.',
    example: 'AIzaSy...',
  },
  cloudflare: {
    name: 'Cloudflare Workers AI',
    validate: (token: string, extra?: { accountId?: string }) => {
      const accountId = (extra?.accountId ?? '').trim()
      const apiToken = token.trim()

      if (!accountId) {
        return { valid: false, error: 'Account ID is required.' }
      }
      if (!/^[0-9a-fA-F]{32}$/.test(accountId)) {
        return { valid: false, error: 'Account ID must be a 32-character hexadecimal string.' }
      }
      if (!apiToken) {
        return { valid: false, error: 'API token is required.' }
      }
      if (!/^[A-Za-z0-9_-]{20,}$/.test(apiToken)) {
        return { valid: false, error: 'API token must be a valid URL-safe string.' }
      }
      return { valid: true }
    },
    hint: 'Requires a 32-char hex Account ID and a URL-safe API token.',
    example: 'Account ID: 32 hex chars · Token: URL-safe string',
  },
  ollamacloud: {
    name: 'Ollama Cloud',
    // Ollama Cloud keys can start with ollama_ or be token strings
    pattern: /^(ollama_)?[A-Za-z0-9_\-.]{8,}$/,
    minLength: 8,
    hint: 'Ollama Cloud keys start with "ollama_" or provide a valid auth token.',
    example: 'ollama_...',
  },
  pollinations: {
    name: 'Pollinations.ai',
    // Pollinations is free/open by default; optional API key/token
    pattern: /^[A-Za-z0-9_\-.:]{4,}$/,
    minLength: 4,
    hint: 'Pollinations accepts an optional API token or key.',
    example: 'pk_... or token',
  },
  lmstudio: {
    name: 'LM Studio',
    // Local server, no key required
    hint: 'Local server — key is optional.',
    example: 'not needed',
  },
  ollama: {
    name: 'Ollama (Local)',
    // Local server, no key required
    hint: 'Local server — key is optional.',
    example: 'not needed',
  },
}

/**
 * Validates the format of an API key for a given provider.
 * Format checking system has been disabled to allow any custom, proxy,
 * or direct provider keys without blocking the user.
 */
export function validateKeyFormat(
  _providerId: string,
  _key: string,
  _extra?: { accountId?: string },
): { valid: boolean; error?: string } {
  return { valid: true }
}
