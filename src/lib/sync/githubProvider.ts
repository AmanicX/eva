/**
 * GitHub Cloud Provider Integration for Eva
 *
 * Stores encrypted backups in a Private Gist named "eva-backup.enc.json".
 * Requires only the 'gist' scope.
 * Supports:
 * - Personal Access Token (PAT)
 * - GitHub OAuth Device Authorization Flow (RFC 8628)
 */

import type { EncryptedBackupEnvelope } from './syncTypes'

export const GITHUB_BACKUP_FILENAME = 'eva-backup.enc.json'
export const GITHUB_GIST_DESCRIPTION = 'Eva App Cloud Backup (Encrypted)'

export interface GitHubUserProfile {
  login: string
  name: string | null
  avatar_url: string
}

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

/**
 * Validates a GitHub token and retrieves user identity.
 */
export async function getGitHubUserProfile(token: string): Promise<GitHubUserProfile> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Eva-CrossDevice-Sync',
    },
  })

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Invalid or expired GitHub token. Please verify token permissions.')
    }
    throw new Error(`GitHub user request failed: ${res.statusText} (${res.status})`)
  }

  const data = await res.json()
  return {
    login: data.login,
    name: data.name,
    avatar_url: data.avatar_url,
  }
}

/**
 * Initiates GitHub Device Authorization Flow (RFC 8628).
 */
export async function startGitHubDeviceFlow(clientId: string): Promise<DeviceCodeResponse> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId.trim(),
      scope: 'gist',
    }),
  })

  if (!res.ok) {
    throw new Error(`Failed to initiate GitHub device flow: ${res.statusText}`)
  }

  return await res.json()
}

/**
 * Polls for user authorization in GitHub Device Flow.
 */
export async function pollGitHubDeviceFlow(
  clientId: string,
  deviceCode: string,
  intervalSeconds: number = 5,
  signal?: AbortSignal,
): Promise<string> {
  const startTime = Date.now()
  const maxWaitMs = 15 * 60 * 1000 // 15 minutes timeout

  while (Date.now() - startTime < maxWaitMs) {
    if (signal?.aborted) {
      throw new Error('Device authorization cancelled by user.')
    }

    await new Promise((resolve) => setTimeout(resolve, Math.max(intervalSeconds, 5) * 1000))

    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId.trim(),
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
      signal,
    })

    if (!res.ok) continue

    const data = await res.json()
    if (data.access_token) {
      return data.access_token
    }

    if (data.error) {
      if (data.error === 'authorization_pending') {
        continue
      }
      if (data.error === 'slow_down') {
        intervalSeconds += 5
        continue
      }
      if (data.error === 'expired_token') {
        throw new Error('The authorization code has expired. Please try again.')
      }
      if (data.error === 'access_denied') {
        throw new Error('Authorization was cancelled or denied on GitHub.')
      }
      throw new Error(`Device flow error: ${data.error_description || data.error}`)
    }
  }

  throw new Error('Device authorization timed out.')
}

/**
 * Finds the Eva backup Gist on the user's account.
 */
export async function findEvaGist(
  token: string,
): Promise<{ gistId: string; envelope: EncryptedBackupEnvelope } | null> {
  const res = await fetch('https://api.github.com/gists?per_page=100', {
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Eva-CrossDevice-Sync',
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to list GitHub gists: ${res.statusText}`)
  }

  const gists: any[] = await res.json()
  const targetGist = gists.find(
    (g) =>
      g.files &&
      (g.files[GITHUB_BACKUP_FILENAME] ||
        g.description === GITHUB_GIST_DESCRIPTION),
  )

  if (!targetGist) {
    return null
  }

  const gistId = targetGist.id
  const fileMeta = targetGist.files[GITHUB_BACKUP_FILENAME]

  if (!fileMeta) {
    return null
  }

  let content = fileMeta.content
  // If content was truncated by the list endpoint, fetch full gist
  if (!content || fileMeta.truncated) {
    const fullRes = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Eva-CrossDevice-Sync',
      },
    })
    if (!fullRes.ok) {
      throw new Error(`Failed to fetch full gist content: ${fullRes.statusText}`)
    }
    const fullData = await fullRes.json()
    content = fullData.files[GITHUB_BACKUP_FILENAME]?.content
  }

  if (!content) {
    return null
  }

  try {
    const envelope = JSON.parse(content) as EncryptedBackupEnvelope
    return { gistId, envelope }
  } catch {
    throw new Error('Failed to parse remote backup envelope from GitHub Gist.')
  }
}

/**
 * Uploads an encrypted backup envelope to GitHub Private Gists.
 * Creates a new private Gist if one does not exist, or updates the existing one atomically.
 */
export async function uploadToGitHubGist(
  token: string,
  envelope: EncryptedBackupEnvelope,
  existingGistId?: string,
): Promise<string> {
  const content = JSON.stringify(envelope, null, 2)

  let gistId = existingGistId
  if (!gistId) {
    const found = await findEvaGist(token)
    if (found) {
      gistId = found.gistId
    }
  }

  if (gistId) {
    // Update existing gist
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Eva-CrossDevice-Sync',
      },
      body: JSON.stringify({
        description: GITHUB_GIST_DESCRIPTION,
        files: {
          [GITHUB_BACKUP_FILENAME]: {
            content,
          },
        },
      }),
    })

    if (!res.ok) {
      throw new Error(`Failed to update GitHub Gist: ${res.statusText} (${res.status})`)
    }

    const data = await res.json()
    return data.id
  } else {
    // Create new private gist
    const res = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Eva-CrossDevice-Sync',
      },
      body: JSON.stringify({
        description: GITHUB_GIST_DESCRIPTION,
        public: false,
        files: {
          [GITHUB_BACKUP_FILENAME]: {
            content,
          },
        },
      }),
    })

    if (!res.ok) {
      throw new Error(`Failed to create private GitHub Gist: ${res.statusText} (${res.status})`)
    }

    const data = await res.json()
    return data.id
  }
}
