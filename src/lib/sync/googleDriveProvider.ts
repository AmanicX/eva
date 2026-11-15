/**
 * Google Drive Cloud Provider Integration for Eva
 *
 * Uses the isolated Google Drive Application Data Folder (appDataFolder).
 * Scope: https://www.googleapis.com/auth/drive.appdata
 * Files placed in appDataFolder are completely hidden from user's standard Drive and other apps.
 *
 * Implements:
 * - RFC 7636 PKCE OAuth 2.0 authorization
 * - Automatic token refresh with expiration tracking and invalid_grant recovery
 * - Concurrency conflict detection using remote file versions
 */

import type { EncryptedBackupEnvelope } from './syncTypes'
import { ConcurrencyConflictError } from './githubProvider'

export const GOOGLE_BACKUP_FILENAME = 'eva-backup.enc.json'
export const GOOGLE_DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
export const GOOGLE_USERINFO_SCOPE = 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email'

// Public default Google OAuth client ID (for public native client PKCE)
export const DEFAULT_GOOGLE_CLIENT_ID = '934524183887-o3s125v1b0f5j0p05h7g4t98c76i8u9k.apps.googleusercontent.com'

export interface GoogleUserProfile {
  email: string
  name: string
  picture: string
}

export interface GoogleRemoteFileInfo {
  fileId: string
  version: string
  modifiedTime: string
  envelope: EncryptedBackupEnvelope
}

/**
 * Validates a Google OAuth access token and retrieves user identity.
 */
export async function getGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
    },
  })

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Google access token is invalid or expired.')
    }
    throw new Error(`Google userinfo request failed: ${res.statusText} (${res.status})`)
  }

  const data = await res.json()
  return {
    email: data.email || 'Google User',
    name: data.name || data.email || 'User',
    picture: data.picture || '',
  }
}

/**
 * Generates PKCE code verifier and code challenge for Google OAuth 2.0.
 */
export async function generatePKCECodes(): Promise<{ verifier: string; challenge: string }> {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const verifier = Array.from(randomBytes)
    .map((b) => ('0' + b.toString(16)).slice(-2))
    .join('')

  const enc = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', enc)
  const hashArray = Array.from(new Uint8Array(hash))
  const binary = hashArray.map((b) => String.fromCharCode(b)).join('')
  const challenge = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return { verifier, challenge }
}

/**
 * Generates a cryptographically random OAuth state token to protect against CSRF.
 */
export function generateOAuthState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generates an OAuth 2.0 authorization URL for Google Drive appDataFolder access.
 */
export function buildGoogleAuthUrl(
  clientId: string = DEFAULT_GOOGLE_CLIENT_ID,
  redirectUri: string,
  state: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: `${GOOGLE_DRIVE_APPDATA_SCOPE} ${GOOGLE_USERINFO_SCOPE}`,
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchanges authorization code for access and refresh tokens.
 */
export async function exchangeGoogleAuthCode(
  clientId: string,
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId.trim(),
      code: code.trim(),
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(`Google token exchange failed: ${errData.error_description || res.statusText}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

/**
 * Refreshes an expired Google access token using the stored refresh token.
 */
export async function refreshGoogleAccessToken(
  clientId: string,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId.trim(),
      refresh_token: refreshToken.trim(),
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    if (errData.error === 'invalid_grant') {
      throw new Error('Google authorization has expired or was revoked. Please reconnect your account.')
    }
    throw new Error(`Google token refresh failed: ${errData.error_description || res.statusText}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in,
  }
}

/**
 * Searches the user's appDataFolder for existing eva-backup.enc.json.
 */
export async function findEvaGoogleDriveFile(
  accessToken: string,
): Promise<GoogleRemoteFileInfo | null> {
  const query = encodeURIComponent(`name = '${GOOGLE_BACKUP_FILENAME}' and trashed = false`)
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime,version,size)`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to query Google Drive appDataFolder: ${res.statusText}`)
  }

  const data = await res.json()
  if (!data.files || data.files.length === 0) {
    return null
  }

  const file = data.files[0]
  const envelope = await downloadFromGoogleDrive(accessToken, file.id)

  return {
    fileId: file.id,
    version: file.version || file.modifiedTime,
    modifiedTime: file.modifiedTime,
    envelope,
  }
}

/**
 * Downloads the encrypted backup envelope from Google Drive.
 */
export async function downloadFromGoogleDrive(
  accessToken: string,
  fileId: string,
): Promise<EncryptedBackupEnvelope> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to download backup from Google Drive: ${res.statusText}`)
  }

  return (await res.json()) as EncryptedBackupEnvelope
}

/**
 * Uploads an encrypted backup envelope to Google Drive appDataFolder with concurrency protection.
 */
export async function uploadToGoogleDrive(
  accessToken: string,
  envelope: EncryptedBackupEnvelope,
  lastKnownVersion?: string,
  existingFileId?: string,
): Promise<{ fileId: string; version: string }> {
  let fileId = existingFileId
  if (!fileId) {
    const found = await findEvaGoogleDriveFile(accessToken)
    if (found) {
      fileId = found.fileId
      if (lastKnownVersion && found.version !== lastKnownVersion) {
        throw new ConcurrencyConflictError(
          'Remote Google Drive backup was updated by another device. Sync will re-fetch and merge.',
        )
      }
    }
  } else if (lastKnownVersion) {
    // Check if remote version changed
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=version,modifiedTime`,
      {
        headers: { Authorization: `Bearer ${accessToken.trim()}` },
      },
    )
    if (metaRes.ok) {
      const meta = await metaRes.json()
      const currentVer = meta.version || meta.modifiedTime
      if (currentVer !== lastKnownVersion) {
        throw new ConcurrencyConflictError(
          'Remote Google Drive backup was updated by another device. Sync will re-fetch and merge.',
        )
      }
    }
  }

  const fileContent = JSON.stringify(envelope, null, 2)

  if (fileId) {
    // Overwrite existing file content in appDataFolder
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
          'Content-Type': 'application/json',
        },
        body: fileContent,
      },
    )

    if (!res.ok) {
      throw new Error(`Failed to update backup file in Google Drive: ${res.statusText}`)
    }

    const data = await res.json()
    return { fileId: data.id, version: data.version || new Date().toISOString() }
  } else {
    // Multipart upload to create file in appDataFolder
    const metadata = {
      name: GOOGLE_BACKUP_FILENAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    }

    const boundary = '-------314159265358979323846'
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelimiter = `\r\n--${boundary}--`

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      closeDelimiter

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      },
    )

    if (!res.ok) {
      throw new Error(`Failed to create backup in Google Drive: ${res.statusText}`)
    }

    const data = await res.json()
    return { fileId: data.id, version: data.version || new Date().toISOString() }
  }
}
