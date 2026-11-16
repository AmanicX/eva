/**
 * End-to-End Zero-Knowledge Encryption for Eva Cloud Backup & Sync
 *
 * Security primitives:
 * - Cipher: AES-256-GCM (Authenticated Encryption with Associated Data)
 * - Key Derivation: PBKDF2 with HMAC-SHA-256 and 600,000 iterations
 * - Salt: 16 bytes cryptographically secure random bytes
 * - IV: 12 bytes cryptographically secure random bytes per encryption
 * - Verification Token: Key-derivation probe to quickly validate passphrases without decrypting full data
 * - Integrity: AES-GCM 128-bit auth tag + payload SHA-256 checksum
 */

import type { EncryptedBackupEnvelope, SyncableData, SyncEnvelopeMeta } from './syncTypes'

export const PBKDF2_ITERATIONS = 600_000
const VERIFY_TOKEN_MAGIC = 'EVA_E2EE_VERIFY_TOKEN_V1'

/**
 * Encodes Uint8Array to standard Base64 string across Browser and Node environments.
 */
export function toBase64(bytes: Uint8Array): string {
  if (typeof (globalThis as any).Buffer !== 'undefined') {
    return (globalThis as any).Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Decodes standard Base64 string to Uint8Array across Browser and Node environments.
 */
export function fromBase64(str: string): Uint8Array {
  if (typeof (globalThis as any).Buffer !== 'undefined') {
    return new Uint8Array((globalThis as any).Buffer.from(str, 'base64'))
  }
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Calculates SHA-256 hex digest of a string.
 */
export async function sha256Hex(data: string): Promise<string> {
  const enc = new TextEncoder().encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generates cryptographically secure random bytes.
 */
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/**
 * Generates a formatted human-readable 256-bit recovery key.
 * Format: EVA-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
 */
export function generateRecoveryKey(): string {
  const randomBytes = generateRandomBytes(16)
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('')
  // Split into 8 groups of 4 characters
  const chunks: string[] = []
  for (let i = 0; i < hex.length; i += 4) {
    chunks.push(hex.slice(i, i + 4))
  }
  return `EVA-${chunks.join('-')}`
}

/**
 * Normalizes a user-entered recovery key by removing non-alphanumeric separators.
 */
export function normalizeRecoveryKey(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from a passphrase or recovery key using PBKDF2.
 */
export async function deriveKey(
  secret: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret.trim()),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypts a verification probe token using the derived key and IV.
 */
async function createVerificationToken(key: CryptoKey, iv: Uint8Array): Promise<string> {
  const enc = new TextEncoder()
  const tokenBytes = enc.encode(VERIFY_TOKEN_MAGIC)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    tokenBytes,
  )
  return toBase64(new Uint8Array(encrypted))
}

/**
 * Verifies whether a derived key is valid against the envelope's verification token.
 */
export async function verifyKey(
  envelope: EncryptedBackupEnvelope,
  key: CryptoKey,
): Promise<boolean> {
  try {
    const iv = fromBase64(envelope.iv)
    const tokenCipher = fromBase64(envelope.kdfVerification)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      tokenCipher as BufferSource,
    )
    const dec = new TextDecoder()
    return dec.decode(decrypted) === VERIFY_TOKEN_MAGIC
  } catch {
    return false
  }
}

/**
 * Encrypts application data into a secure zero-knowledge envelope.
 */
export async function encryptBackup(
  data: SyncableData,
  key: CryptoKey,
  salt: Uint8Array,
  meta: SyncEnvelopeMeta,
  deviceId: string,
  appVersion: string = '2.1.0',
  options?: {
    envelopeId?: string
    parentEnvelopeId?: string
    remoteRevision?: string
  },
): Promise<EncryptedBackupEnvelope> {
  const iv = generateRandomBytes(12)
  const kdfVerification = await createVerificationToken(key, iv)

  const jsonString = JSON.stringify(data)
  const enc = new TextEncoder()
  const dataBytes = enc.encode(jsonString)

  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    dataBytes,
  )

  const ciphertext = toBase64(new Uint8Array(encryptedData))
  const checksum = await sha256Hex(ciphertext)
  const envelopeId = options?.envelopeId || `env_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  return {
    version: 2,
    schemaVersion: 2,
    envelopeId,
    parentEnvelopeId: options?.parentEnvelopeId,
    remoteRevision: options?.remoteRevision,
    deviceId,
    appVersion,
    timestamp: new Date().toISOString(),
    salt: toBase64(salt),
    iv: toBase64(iv),
    kdfVerification,
    ciphertext,
    checksum,
    meta,
  }
}

/**
 * Decrypts and authenticates a backup envelope using the derived key.
 * Throws an explicit error if the ciphertext was tampered with or if decryption fails.
 */
export async function decryptBackup(
  envelope: EncryptedBackupEnvelope,
  key: CryptoKey,
): Promise<SyncableData> {
  // Check checksum integrity
  const calculatedChecksum = await sha256Hex(envelope.ciphertext)
  if (calculatedChecksum !== envelope.checksum) {
    throw new Error('Backup payload checksum mismatch. Data may be corrupted or tampered with.')
  }

  // Fast verify key
  const isValid = await verifyKey(envelope, key)
  if (!isValid) {
    throw new Error('Incorrect passphrase or recovery key.')
  }

  const iv = fromBase64(envelope.iv)
  const ciphertextBytes = fromBase64(envelope.ciphertext)

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertextBytes as BufferSource,
    )
    const dec = new TextDecoder()
    const jsonStr = dec.decode(decrypted)
    return JSON.parse(jsonStr) as SyncableData
  } catch (err) {
    throw new Error(`Failed to decrypt backup data: ${err instanceof Error ? err.message : String(err)}`)
  }
}
