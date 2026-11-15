/**
 * Types for Cross-Device Cloud Backup & End-to-End Encrypted Synchronization
 */

import type { Character, Conversation, Settings, World } from '@/types'

export type CloudProviderType = 'google' | 'github'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export interface SyncTombstones {
  characters: Record<string, number> // id -> deletedAt epoch ms
  worlds: Record<string, number>
  conversations: Record<string, number>
  messages: Record<string, number> // messageId -> deletedAt epoch ms
}

export interface SyncableData {
  characters: Character[]
  worlds: World[]
  conversations: Conversation[]
  settings?: Partial<Settings>
  tombstones?: SyncTombstones
}

export interface SyncEnvelopeMeta {
  characterCount: number
  worldCount: number
  conversationCount: number
  messageCount: number
}

/**
 * Encrypted payload envelope stored in Google Drive appDataFolder or GitHub Gist.
 * Never contains plaintext application data.
 */
export interface EncryptedBackupEnvelope {
  version: number // Backup envelope schema format (currently 1)
  schemaVersion: number // Eva application schema version (currently 2)
  deviceId: string
  appVersion: string
  timestamp: string // ISO 8601 UTC
  salt: string // Base64 16-byte random salt for PBKDF2
  iv: string // Base64 12-byte random IV for AES-256-GCM
  kdfVerification: string // Base64 ciphertext of verification token to test passphrase quickly
  ciphertext: string // Base64 AES-256-GCM ciphertext of JSON-stringified SyncableData
  checksum: string // SHA-256 hex checksum of the ciphertext string
  meta: SyncEnvelopeMeta
}

export interface CloudProviderAccount {
  provider: CloudProviderType
  connected: boolean
  accountIdentity?: string // e.g. "user@example.com" or "octocat"
  avatarUrl?: string
  lastSyncTimestamp?: number // epoch ms
  lastBackupTimestamp?: number // epoch ms
  lastError?: string
}

export interface SyncConfig {
  autoSyncEnabled: boolean
  activeProvider: 'none' | CloudProviderType
  googleAccount: CloudProviderAccount
  githubAccount: CloudProviderAccount
  hasPassphrase: boolean
  syncStatus: SyncStatus
  lastSyncMessage?: string
}

export interface RestorePreview {
  timestamp: string
  deviceId: string
  appVersion: string
  meta: SyncEnvelopeMeta
  envelope: EncryptedBackupEnvelope
}

export interface SyncResult {
  success: boolean
  message: string
  timestamp: number
  mergedStats?: {
    charactersAdded: number
    charactersUpdated: number
    worldsAdded: number
    worldsUpdated: number
    conversationsAdded: number
    conversationsUpdated: number
    messagesMerged: number
  }
}
