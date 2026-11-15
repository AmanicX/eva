import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ConcurrencyConflictError,
  uploadToGitHubRepo,
} from '../src/lib/sync/githubProvider'
import { uploadToGoogleDrive } from '../src/lib/sync/googleDriveProvider'
import type { EncryptedBackupEnvelope } from '../src/lib/sync/syncTypes'

describe('Concurrency & Race-Condition Protection', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const mockEnvelope: EncryptedBackupEnvelope = {
    version: 2,
    schemaVersion: 2,
    envelopeId: 'env_test_123',
    deviceId: 'device_a',
    appVersion: '2.0.1',
    timestamp: new Date().toISOString(),
    salt: 'c2FsdF9leGFtcGxl',
    iv: 'aXZfZXhhbXBsZQ==',
    kdfVerification: 'dmVyaWZ5X3Rva2Vu',
    ciphertext: 'Y2lwaGVydGV4dF9kYXRh',
    checksum: 'mock_checksum_hash_12345',
    meta: {
      characterCount: 1,
      worldCount: 1,
      conversationCount: 1,
      messageCount: 5,
    },
  }

  it('identifies ConcurrencyConflictError as custom Error instance', () => {
    const err = new ConcurrencyConflictError('Write conflict on remote')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ConcurrencyConflictError')
    expect(err.message).toBe('Write conflict on remote')
  })

  it('throws ConcurrencyConflictError when GitHub returns 409 Conflict', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/user')) {
        return {
          ok: true,
          json: async () => ({ login: 'testuser', name: 'Test User' }),
        } as any
      }
      if (url.includes('/repos/testuser/eva-cloud-backup/contents/')) {
        // Return 409 Conflict simulating another device having pushed in the interim
        return {
          ok: false,
          status: 409,
          statusText: 'Conflict',
          text: async () => 'Resource does not match provided sha',
        } as any
      }
      // Repository existence check
      return { ok: true, json: async () => ({}) } as any
    })

    await expect(
      uploadToGitHubRepo('ghp_test_token', mockEnvelope, 'old_sha_123'),
    ).rejects.toThrow(ConcurrencyConflictError)
  })

  it('throws ConcurrencyConflictError when Google Drive remote version diverges', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes('/files/existing_file_id')) {
        // Return file metadata where remote version is 'ver_remote_updated_by_phone'
        return {
          ok: true,
          json: async () => ({
            version: 'ver_remote_updated_by_phone',
            modifiedTime: '2026-11-15T18:00:00Z',
          }),
        } as any
      }
      return { ok: true, json: async () => ({}) } as any
    })

    await expect(
      uploadToGoogleDrive('mock_google_token', mockEnvelope, 'ver_stale_local_version', 'existing_file_id'),
    ).rejects.toThrow(ConcurrencyConflictError)
  })
})
