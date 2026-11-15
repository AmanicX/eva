/**
 * GitHub Cloud Provider Integration for Eva
 *
 * Supports two storage targets:
 * 1. Dedicated Private Repository (Recommended):
 *    Strictly access-controlled by GitHub. Stored in a private repository named "eva-cloud-backup".
 *    Enforces atomic compare-and-swap concurrency checks via git commit SHA.
 *
 * 2. Encrypted Secret Gist (Unlisted):
 *    Stored as an unlisted Gist. Note: GitHub secret Gists are unlisted (hidden from search)
 *    rather than access-controlled private repositories. All data is zero-knowledge encrypted
 *    with AES-256-GCM before transmission.
 *
 * Authentication:
 * - GitHub OAuth Device Authorization Flow (RFC 8628)
 * - Personal Access Token (PAT)
 */

import type { EncryptedBackupEnvelope } from './syncTypes'

export const GITHUB_BACKUP_FILENAME = 'eva-backup.enc.json'
export const GITHUB_BACKUP_REPO_NAME = 'eva-cloud-backup'
export const GITHUB_GIST_DESCRIPTION = 'Eva App Cloud Backup (Encrypted Unlisted Gist)'

// Standard public client ID for Eva Device Flow (can be overridden by user)
export const DEFAULT_GITHUB_CLIENT_ID = 'Ov23li8uFjX6xXnE5m1a'

export type GitHubStorageType = 'repo' | 'gist'

export class ConcurrencyConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConcurrencyConflictError'
  }
}

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

export interface RemoteFileInfo {
  sha: string // Git blob or commit SHA for concurrency checks
  envelope: EncryptedBackupEnvelope
  updatedAt: string
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
      throw new Error('Invalid or expired GitHub token. Please re-authenticate.')
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
 * Scopes: 'repo' for private repository storage, or 'gist' for secret gist storage.
 */
export async function startGitHubDeviceFlow(
  clientId: string = DEFAULT_GITHUB_CLIENT_ID,
  scope: 'repo' | 'gist' = 'repo',
): Promise<DeviceCodeResponse> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId.trim(),
      scope,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Failed to initiate GitHub device authorization: ${errText}`)
  }

  return await res.json()
}

/**
 * Polls for user authorization in GitHub Device Flow.
 */
export async function pollGitHubDeviceFlow(
  clientId: string = DEFAULT_GITHUB_CLIENT_ID,
  deviceCode: string,
  intervalSeconds: number = 5,
  signal?: AbortSignal,
): Promise<string> {
  const startTime = Date.now()
  const maxWaitMs = 15 * 60 * 1000 // 15 minutes timeout
  let currentInterval = intervalSeconds > 0 ? intervalSeconds : 5

  while (Date.now() - startTime < maxWaitMs) {
    if (signal?.aborted) {
      throw new Error('Device authorization cancelled by user.')
    }

    await new Promise((resolve) => setTimeout(resolve, currentInterval * 1000))

    if (signal?.aborted) {
      throw new Error('Device authorization cancelled by user.')
    }

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
        currentInterval += 5
        continue
      }
      if (data.error === 'expired_token') {
        throw new Error('The device code has expired. Please try connecting again.')
      }
      if (data.error === 'access_denied') {
        throw new Error('Authorization was denied on GitHub.')
      }
      throw new Error(`Device authorization error: ${data.error_description || data.error}`)
    }
  }

  throw new Error('Device authorization timed out.')
}

// ============================================================================
// 1. DEDICATED PRIVATE REPOSITORY IMPLEMENTATION (RECOMMENDED)
// ============================================================================

/**
 * Ensures the dedicated private backup repository exists on user's account.
 */
export async function ensurePrivateRepo(token: string, repoName: string = GITHUB_BACKUP_REPO_NAME): Promise<string> {
  const user = await getGitHubUserProfile(token)
  const checkRes = await fetch(`https://api.github.com/repos/${user.login}/${repoName}`, {
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Eva-CrossDevice-Sync',
    },
  })

  if (checkRes.ok) {
    return repoName
  }

  if (checkRes.status === 404) {
    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Eva-CrossDevice-Sync',
      },
      body: JSON.stringify({
        name: repoName,
        description: 'Eva App Encrypted Cloud Backup — End-to-End Encrypted',
        private: true,
        auto_init: true,
      }),
    })

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => createRes.statusText)
      throw new Error(`Failed to create private backup repository: ${errText}`)
    }

    return repoName
  }

  throw new Error(`Failed to access GitHub repository: ${checkRes.statusText}`)
}

/**
 * Fetches the encrypted backup envelope from the user's private repository.
 */
export async function findEvaRepoFile(
  token: string,
  repoName: string = GITHUB_BACKUP_REPO_NAME,
): Promise<RemoteFileInfo | null> {
  const user = await getGitHubUserProfile(token)
  const url = `https://api.github.com/repos/${user.login}/${repoName}/contents/${GITHUB_BACKUP_FILENAME}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Eva-CrossDevice-Sync',
    },
  })

  if (res.status === 404) {
    return null
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch backup from private repository: ${res.statusText}`)
  }

  const data = await res.json()
  const content = atob(data.content.replace(/\n/g, ''))
  const envelope = JSON.parse(content) as EncryptedBackupEnvelope

  return {
    sha: data.sha,
    envelope,
    updatedAt: envelope.timestamp,
  }
}

/**
 * Uploads an encrypted backup envelope to the private repository with atomic CAS concurrency check.
 */
export async function uploadToGitHubRepo(
  token: string,
  envelope: EncryptedBackupEnvelope,
  lastKnownSha?: string,
  repoName: string = GITHUB_BACKUP_REPO_NAME,
): Promise<string> {
  await ensurePrivateRepo(token, repoName)
  const user = await getGitHubUserProfile(token)
  const url = `https://api.github.com/repos/${user.login}/${repoName}/contents/${GITHUB_BACKUP_FILENAME}`

  const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(envelope, null, 2))))

  let targetSha = lastKnownSha
  if (!targetSha) {
    const existing = await findEvaRepoFile(token, repoName)
    if (existing) {
      targetSha = existing.sha
    }
  }

  const bodyPayload: any = {
    message: `Sync update: ${envelope.deviceId} at ${envelope.timestamp}`,
    content: contentBase64,
  }
  if (targetSha) {
    bodyPayload.sha = targetSha
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Eva-CrossDevice-Sync',
    },
    body: JSON.stringify(bodyPayload),
  })

  if (res.status === 409) {
    throw new ConcurrencyConflictError(
      'Remote repository was updated by another device. Automatic sync will merge changes and retry.',
    )
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Failed to save backup to private repository: ${errText}`)
  }

  const data = await res.json()
  return data.content.sha
}

// ============================================================================
// 2. SECRET GIST IMPLEMENTATION (UNLISTED)
// ============================================================================

/**
 * Finds the Eva backup Gist on the user's account.
 */
export async function findEvaGist(
  token: string,
): Promise<{ gistId: string; sha: string; envelope: EncryptedBackupEnvelope } | null> {
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
        g.description?.includes('Eva App Cloud Backup')),
  )

  if (!targetGist) {
    return null
  }

  const gistId = targetGist.id
  const fullRes = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Eva-CrossDevice-Sync',
    },
  })

  if (!fullRes.ok) {
    throw new Error(`Failed to fetch Gist contents: ${fullRes.statusText}`)
  }

  const fullData = await fullRes.json()
  const fileMeta = fullData.files[GITHUB_BACKUP_FILENAME]
  if (!fileMeta || !fileMeta.content) {
    return null
  }

  const latestCommitSha = fullData.history?.[0]?.version || fullData.id
  const envelope = JSON.parse(fileMeta.content) as EncryptedBackupEnvelope

  return {
    gistId,
    sha: latestCommitSha,
    envelope,
  }
}

/**
 * Uploads an encrypted backup envelope to an unlisted secret Gist.
 * Verifies remote commit version to prevent concurrent blind overwrites.
 */
export async function uploadToGitHubGist(
  token: string,
  envelope: EncryptedBackupEnvelope,
  lastKnownCommitSha?: string,
  existingGistId?: string,
): Promise<{ gistId: string; sha: string }> {
  const content = JSON.stringify(envelope, null, 2)

  let gistId = existingGistId
  if (!gistId) {
    const found = await findEvaGist(token)
    if (found) {
      gistId = found.gistId
      if (lastKnownCommitSha && found.sha !== lastKnownCommitSha) {
        throw new ConcurrencyConflictError(
          'Remote Gist was updated by another device. Sync will re-fetch and merge.',
        )
      }
    }
  } else if (lastKnownCommitSha) {
    const found = await findEvaGist(token)
    if (found && found.sha !== lastKnownCommitSha) {
      throw new ConcurrencyConflictError(
        'Remote Gist was updated by another device. Sync will re-fetch and merge.',
      )
    }
  }

  if (gistId) {
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
    const sha = data.history?.[0]?.version || data.id
    return { gistId: data.id, sha }
  } else {
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
        public: false, // Unlisted Gist
        files: {
          [GITHUB_BACKUP_FILENAME]: {
            content,
          },
        },
      }),
    })

    if (!res.ok) {
      throw new Error(`Failed to create secret GitHub Gist: ${res.statusText} (${res.status})`)
    }

    const data = await res.json()
    const sha = data.history?.[0]?.version || data.id
    return { gistId: data.id, sha }
  }
}
