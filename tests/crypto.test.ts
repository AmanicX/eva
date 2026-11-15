import { describe, it, expect } from 'vitest'
import {
  deriveKey,
  encryptBackup,
  decryptBackup,
  generateRecoveryKey,
  normalizeRecoveryKey,
  generateRandomBytes,
} from '../src/lib/sync/syncCrypto'
import type { SyncableData, SyncEnvelopeMeta } from '../src/lib/sync/syncTypes'

describe('End-to-End Encryption (syncCrypto)', () => {
  const sampleData: SyncableData = {
    characters: [
      {
        id: 'char_test_1',
        name: 'Aria Silver',
        tagline: 'Elite Archivist',
        description: 'Quiet archivist with silver hair',
        greeting: '*nods gently* Welcome.',
        theme: 'anime',
        avatar: '🌸',
        avatarColor: '#7c5cff',
        age: '22',
        gender: 'Female',
        createdAt: 1700000000000,
        updatedAt: 1700000001000,
      },
    ],
    worlds: [
      {
        id: 'world_test_1',
        name: 'Neo Arcadia',
        genre: 'Cyberpunk Fantasy',
        description: 'Sprawling neon metropolis',
        rules: 'Magic and technology coexist',
        color: '#34d399',
        avatar: '🌍',
        createdAt: 1700000000000,
      },
    ],
    conversations: [
      {
        id: 'conv_test_1',
        title: 'First Encounter',
        characterId: 'char_test_1',
        theme: 'anime',
        messages: [
          {
            id: 'msg_1',
            role: 'assistant',
            content: 'Hello traveler.',
            timestamp: 1700000002000,
          },
          {
            id: 'msg_2',
            role: 'user',
            content: 'Nice to meet you Aria.',
            timestamp: 1700000003000,
          },
        ],
        memory: 'User likes tea and archives.',
        createdAt: 1700000000000,
        updatedAt: 1700000003000,
      },
    ],
    settings: {
      theme: 'anime',
      appearanceMode: 'dark',
      accentPalette: 'violet',
      apiKey: '',
    },
  }

  const meta: SyncEnvelopeMeta = {
    characterCount: 1,
    worldCount: 1,
    conversationCount: 1,
    messageCount: 2,
  }

  it('generates well-formatted recovery keys', () => {
    const key = generateRecoveryKey()
    expect(key.startsWith('EVA-')).toBe(true)
    const normalized = normalizeRecoveryKey(key)
    expect(normalized.startsWith('EVA')).toBe(true)
    expect(normalized.length).toBe(35) // 'EVA' + 32 hex chars
  })

  it('encrypts and decrypts state accurately with AES-256-GCM', async () => {
    const passphrase = 'SuperSecretPassphrase2026!'
    const salt = generateRandomBytes(16)
    // For fast test execution, use fewer PBKDF2 iterations in unit tests
    const key = await deriveKey(passphrase, salt, 10_000)

    const envelope = await encryptBackup(sampleData, key, salt, meta, 'device_test_123', '2.0.0')

    expect(envelope.version).toBe(2)
    expect(envelope.schemaVersion).toBe(2)
    expect(envelope.deviceId).toBe('device_test_123')
    expect(envelope.envelopeId).toBeDefined()
    expect(envelope.ciphertext).toBeDefined()
    expect(envelope.checksum).toBeDefined()
    expect(envelope.meta.characterCount).toBe(1)

    // Decrypt with valid key
    const decrypted = await decryptBackup(envelope, key)
    expect(decrypted.characters[0].name).toBe('Aria Silver')
    expect(decrypted.worlds[0].name).toBe('Neo Arcadia')
    expect(decrypted.conversations[0].messages.length).toBe(2)
    expect(decrypted.conversations[0].messages[1].content).toBe('Nice to meet you Aria.')
    expect(decrypted.conversations[0].memory).toBe('User likes tea and archives.')
  })

  it('fails cleanly with an explicit error when incorrect passphrase is provided', async () => {
    const correctPassphrase = 'CorrectPassphrase123!'
    const wrongPassphrase = 'WrongPassword456!'
    const salt = generateRandomBytes(16)

    const key = await deriveKey(correctPassphrase, salt, 10_000)
    const wrongKey = await deriveKey(wrongPassphrase, salt, 10_000)

    const envelope = await encryptBackup(sampleData, key, salt, meta, 'device_test')

    await expect(decryptBackup(envelope, wrongKey)).rejects.toThrow(
      'Incorrect passphrase or recovery key.',
    )
  })

  it('detects tampered ciphertext and aborts with checksum error', async () => {
    const passphrase = 'PassphraseToTamper!'
    const salt = generateRandomBytes(16)
    const key = await deriveKey(passphrase, salt, 10_000)

    const envelope = await encryptBackup(sampleData, key, salt, meta, 'device_test')

    // Tamper with ciphertext by altering a character deterministically
    const firstChar = envelope.ciphertext[0]
    const tamperedCiphertext = (firstChar === 'A' ? 'B' : 'A') + envelope.ciphertext.slice(1)
    const tamperedEnvelope = {
      ...envelope,
      ciphertext: tamperedCiphertext,
    }

    await expect(decryptBackup(tamperedEnvelope, key)).rejects.toThrow(
      'Backup payload checksum mismatch',
    )
  })
})
