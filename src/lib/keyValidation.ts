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
 * Does not perform any network requests.
 */
export function validateKeyFormat(
  providerId: string,
  key: string,
  extra?: { accountId?: string },
): { valid: boolean; error?: string } {
  const cleanKey = (key ?? '').trim()
  const rule = PROVIDER_KEY_RULES[providerId]

  // If local server or no rule, allow empty or loose string
  if (providerId === 'ollama' || providerId === 'lmstudio') {
    return { valid: true }
  }

  // Pollinations key is optional; empty is valid (free tier)
  if (providerId === 'pollinations' && !cleanKey) {
    return { valid: true }
  }

  if (!cleanKey && providerId !== 'cloudflare') {
    return { valid: false, error: 'API key cannot be empty.' }
  }

  if (!rule) {
    // Custom endpoint: loose validation
    if (cleanKey.length < 3) {
      return { valid: false, error: 'Key must be at least 3 characters.' }
    }
    return { valid: true }
  }

  if (rule.validate) {
    return rule.validate(cleanKey, extra)
  }

  if (rule.startsWith && !rule.startsWith.some((prefix) => cleanKey.startsWith(prefix))) {
    return {
      valid: false,
      error: `Invalid format: ${rule.name} key must start with ${rule.startsWith.map((s) => `"${s}"`).join(' or ')}.`,
    }
  }

  if (rule.fixedLength && cleanKey.length !== rule.fixedLength) {
    return {
      valid: false,
      error: `Invalid length: ${rule.name} key must be exactly ${rule.fixedLength} characters (currently ${cleanKey.length}).`,
    }
  }

  if (rule.minLength && cleanKey.length < rule.minLength) {
    return {
      valid: false,
      error: `Key too short: ${rule.name} key must be at least ${rule.minLength} characters.`,
    }
  }

  if (rule.pattern && !rule.pattern.test(cleanKey)) {
    return {
      valid: false,
      error: `Invalid characters or structure for ${rule.name} key. ${rule.hint}`,
    }
  }

  return { valid: true }
}
