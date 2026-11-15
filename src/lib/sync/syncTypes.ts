/**
 * Types for Cross-Device Cloud Backup & End-to-End Encrypted Synchronization
 */

import type { Character, Conversation, Settings, World } from '@/types'

export type CloudProviderType = 'google' | 'github'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'conflict'

export interface SyncTombstones {
  characters: Record<string, number> // id -> deletedAt epoch ms
  worlds: Record<string, number>
  conversations: Record<string, number>
  messages: Record<string, number> // messageId -> deletedAt epoch ms
}

export interface SyncConflictRecord {
  id: string
  entityType: 'character' | 'world' | 'conversation'
  entityId: string
  entityName: string
  field: string
  localValue: any
  remoteValue: any
  timestamp: number
  resolved?: boolean
}

export interface SyncableData {
  characters: Character[]
  worlds: World[]
  conversations: Conversation[]
  settings?: Partial<Settings>
  tombstones?: SyncTombstones
  conflicts?: SyncConflictRecord[]
  revision?: string
  parentRevision?: string
  deviceId?: string
}

export interface SyncEnvelopeMeta {
  characterCount: number
  worldCount: number
  conversationCount: number
  messageCount: number
}

/**
 * Encrypted payload envelope stored in Google Drive appDataFolder, GitHub Private Repo, or Secret Gist.
 * Never contains plaintext application data.
 */
export interface EncryptedBackupEnvelope {
  version: number // Backup envelope schema format (currently 2)
  schemaVersion: number // Eva application schema version (currently 2)
  envelopeId: string // Unique snapshot ID for this upload
  parentEnvelopeId?: string // Previous snapshot ID this was based on (for 3-way parent tracking)
  remoteRevision?: string // Git commit SHA or Drive file version at time of download
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
  gitHubStorageType?: 'repo' | 'gist'
  googleClientId?: string
  lastRemoteVersion?: string // Remote Git commit SHA or Drive version
  tokenExpiresAt?: number
}

export interface SyncConfig {
  autoSyncEnabled: boolean
  activeProvider: 'none' | CloudProviderType
  googleAccount: CloudProviderAccount
  githubAccount: CloudProviderAccount
  hasPassphrase: boolean
  syncStatus: SyncStatus
  lastSyncMessage?: string
  conflicts: SyncConflictRecord[]
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
  conflicts?: SyncConflictRecord[]
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
