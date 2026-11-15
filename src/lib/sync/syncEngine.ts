/**
 * Central Cloud Backup & Synchronization Engine for Eva v2.x
 *
 * Coordinates:
 * - End-to-end zero-knowledge client-side encryption (AES-256-GCM + PBKDF2)
 * - Provider-aware concurrency controls and atomic compare-and-swap conflict resolution
 * - Revision-aware 3-way entity merging without simplistic overwrites
 * - Google Drive appDataFolder with PKCE OAuth and token refresh lifecycle
 * - GitHub Private Repository and Secret Gist with Device Flow authorization
 * - Infinite-loop prevention during store hydration and sync application
 * - Offline change tracking and network reconnection handling
 */

import { useStore } from '@/store/useStore'
import {
  decryptBackup,
  deriveKey,
  encryptBackup,
  generateRandomBytes,
  fromBase64,
  toBase64,
} from './syncCrypto'
import {
  findEvaGist,
  findEvaRepoFile,
  getGitHubUserProfile,
  uploadToGitHubGist,
  uploadToGitHubRepo,
  ConcurrencyConflictError,
  type GitHubStorageType,
} from './githubProvider'
import {
  findEvaGoogleDriveFile,
  getGoogleUserProfile,
  uploadToGoogleDrive,
  buildGoogleAuthUrl,
  exchangeGoogleAuthCode,
  generateOAuthState,
  generatePKCECodes,
  refreshGoogleAccessToken,
  DEFAULT_GOOGLE_CLIENT_ID,
} from './googleDriveProvider'
import { getLocalTombstones, mergeSyncData } from './syncMerge'
import type {
  CloudProviderType,
  EncryptedBackupEnvelope,
  RestorePreview,
  SyncableData,
  SyncConfig,
  SyncEnvelopeMeta,
  SyncResult,
  SyncStatus,
} from './syncTypes'
import { getSecureSecret, setSecureSecret, removeSecureSecret } from '@/lib/credentials'

const CONFIG_STORAGE_KEY = 'eva_sync_config'
const DEVICE_ID_KEY = 'eva_device_id'
const PASSPHRASE_SECRET_KEY = 'sync_passphrase'
const GITHUB_TOKEN_KEY = 'github_sync_token'
const GOOGLE_TOKEN_KEY = 'google_sync_token'
const GOOGLE_REFRESH_TOKEN_KEY = 'google_refresh_token'

export type SyncListener = (config: SyncConfig) => void

class SyncEngine {
  private config: SyncConfig = {
    autoSyncEnabled: false,
    activeProvider: 'none',
    googleAccount: { provider: 'google', connected: false, googleClientId: DEFAULT_GOOGLE_CLIENT_ID },
    githubAccount: { provider: 'github', connected: false, gitHubStorageType: 'repo' },
    hasPassphrase: false,
    syncStatus: 'idle',
    lastSyncMessage: '',
    conflicts: [],
  }

  private listeners: Set<SyncListener> = new Set()
  private cachedKey: CryptoKey | null = null
  private cachedSalt: Uint8Array | null = null
  private isSyncing = false
  private isApplyingRemoteUpdate = false
  private autoSyncTimer: any = null
  private deviceId: string = ''
  private lastRemoteVersion: string | undefined = undefined
  private lastEnvelopeId: string | undefined = undefined
  private hasPendingOfflineChanges = false

  constructor() {
    this.init()
  }

  private async init() {
    this.deviceId = this.getOrCreateDeviceId()
    await this.loadConfig()
    await this.checkPassphraseState()
    this.setupStoreListener()
    this.setupNetworkListeners()
  }

  private getOrCreateDeviceId(): string {
    if (typeof window === 'undefined') return 'server_node'
    let id = window.localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = `eva_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`
      window.localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  }

  private async loadConfig() {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        this.config = {
          ...this.config,
          autoSyncEnabled: !!parsed.autoSyncEnabled,
          activeProvider: parsed.activeProvider || 'none',
          googleAccount: {
            ...this.config.googleAccount,
            ...(parsed.googleAccount || {}),
          },
          githubAccount: {
            ...this.config.githubAccount,
            ...(parsed.githubAccount || {}),
            gitHubStorageType: parsed.githubAccount?.gitHubStorageType || 'repo',
          },
        }
      }

      // Verify stored tokens
      const ghToken = await getSecureSecret(GITHUB_TOKEN_KEY)
      if (ghToken && this.config.githubAccount.connected) {
        try {
          const profile = await getGitHubUserProfile(ghToken)
          this.config.githubAccount.accountIdentity = profile.login
          this.config.githubAccount.avatarUrl = profile.avatar_url
        } catch {
          // Token expired or invalid
        }
      }

      const gToken = await getSecureSecret(GOOGLE_TOKEN_KEY)
      if (gToken && this.config.googleAccount.connected) {
        try {
          const profile = await getGoogleUserProfile(gToken)
          this.config.googleAccount.accountIdentity = profile.email
          this.config.googleAccount.avatarUrl = profile.picture
        } catch {
          // Token expired
        }
      }
    } catch {
      // Ignore
    }
    this.notify()
  }

  private saveConfig() {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        CONFIG_STORAGE_KEY,
        JSON.stringify({
          autoSyncEnabled: this.config.autoSyncEnabled,
          activeProvider: this.config.activeProvider,
          googleAccount: this.config.googleAccount,
          githubAccount: this.config.githubAccount,
        }),
      )
    } catch {
      // Ignore
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener)
    listener(this.getConfig())
    return () => this.listeners.delete(listener)
  }

  private notify() {
    const cfg = this.getConfig()
    for (const l of this.listeners) {
      try {
        l(cfg)
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  public getConfig(): SyncConfig {
    return { ...this.config }
  }

  private setStatus(status: SyncStatus, message: string = '') {
    this.config.syncStatus = status
    this.config.lastSyncMessage = message
    this.notify()
  }

  // --- Network State Observers ---

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('online', () => {
      if (this.config.autoSyncEnabled && this.hasPendingOfflineChanges) {
        this.setStatus('syncing', 'Reconnected to network. Syncing pending changes...')
        void this.syncNow()
      }
    })
    window.addEventListener('offline', () => {
      this.setStatus('idle', 'Offline. Changes will sync when network is restored.')
    })
  }

  // --- Passphrase & Key Management ---

  public async checkPassphraseState(): Promise<boolean> {
    const saved = await getSecureSecret(PASSPHRASE_SECRET_KEY)
    this.config.hasPassphrase = !!saved
    this.notify()
    return this.config.hasPassphrase
  }

  public async setPassphrase(passphrase: string): Promise<void> {
    if (!passphrase || passphrase.trim().length < 8) {
      throw new Error('Passphrase must be at least 8 characters.')
    }
    const clean = passphrase.trim()
    const salt = generateRandomBytes(16)
    const key = await deriveKey(clean, salt)

    this.cachedKey = key
    this.cachedSalt = salt
    await setSecureSecret(PASSPHRASE_SECRET_KEY, clean)
    await setSecureSecret('sync_salt', toBase64(salt))

    this.config.hasPassphrase = true
    this.notify()
  }

  public async getActiveKey(envelopeSaltBase64?: string): Promise<CryptoKey> {
    if (this.cachedKey && (!envelopeSaltBase64 || (this.cachedSalt && toBase64(this.cachedSalt) === envelopeSaltBase64))) {
      return this.cachedKey
    }

    const passphrase = await getSecureSecret(PASSPHRASE_SECRET_KEY)
    if (!passphrase) {
      throw new Error('No encryption passphrase set. Please configure your sync passphrase first.')
    }

    let salt: Uint8Array
    if (envelopeSaltBase64) {
      salt = fromBase64(envelopeSaltBase64)
    } else {
      const storedSalt = await getSecureSecret('sync_salt')
      salt = storedSalt ? fromBase64(storedSalt) : generateRandomBytes(16)
      await setSecureSecret('sync_salt', toBase64(salt))
    }

    const key = await deriveKey(passphrase, salt)
    this.cachedKey = key
    this.cachedSalt = salt
    return key
  }

  // --- GitHub Authentication & Settings ---

  public async connectGitHubWithToken(token: string): Promise<void> {
    const profile = await getGitHubUserProfile(token)
    await setSecureSecret(GITHUB_TOKEN_KEY, token.trim())

    this.config.githubAccount = {
      ...this.config.githubAccount,
      provider: 'github',
      connected: true,
      accountIdentity: profile.login,
      avatarUrl: profile.avatar_url,
    }
    if (this.config.activeProvider === 'none') {
      this.config.activeProvider = 'github'
    }
    this.saveConfig()
    this.notify()
  }

  public setGitHubStorageType(type: GitHubStorageType): void {
    this.config.githubAccount.gitHubStorageType = type
    this.saveConfig()
    this.notify()
  }

  public async disconnectGitHub(): Promise<void> {
    await removeSecureSecret(GITHUB_TOKEN_KEY)
    this.config.githubAccount = {
      provider: 'github',
      connected: false,
      gitHubStorageType: 'repo',
    }
    if (this.config.activeProvider === 'github') {
      this.config.activeProvider = this.config.googleAccount.connected ? 'google' : 'none'
    }
    this.saveConfig()
    this.notify()
  }

  // --- Google OAuth PKCE Flow & Lifecycle ---

  public async getValidGoogleAccessToken(): Promise<string> {
    const token = await getSecureSecret(GOOGLE_TOKEN_KEY)
    if (!token) throw new Error('Google account is not connected.')

    const expiresAt = this.config.googleAccount.tokenExpiresAt || 0
    const needsRefresh = Date.now() >= expiresAt - 60_000 // 1 minute buffer

    if (!needsRefresh) {
      return token
    }

    // Refresh expired token
    const refreshToken = await getSecureSecret(GOOGLE_REFRESH_TOKEN_KEY)
    if (!refreshToken) {
      // Cannot refresh; throw prompt
      throw new Error('Google authorization expired. Please reconnect your Google account.')
    }

    try {
      const refreshed = await refreshGoogleAccessToken(
        this.config.googleAccount.googleClientId || DEFAULT_GOOGLE_CLIENT_ID,
        refreshToken,
      )

      await setSecureSecret(GOOGLE_TOKEN_KEY, refreshed.accessToken)
      if (refreshed.refreshToken) {
        await setSecureSecret(GOOGLE_REFRESH_TOKEN_KEY, refreshed.refreshToken)
      }

      this.config.googleAccount.tokenExpiresAt = Date.now() + refreshed.expiresIn * 1000
      this.saveConfig()
      return refreshed.accessToken
    } catch (err: any) {
      // If invalid grant, disconnect and prompt re-auth
      if (err.message?.includes('expired') || err.message?.includes('revoked')) {
        await this.disconnectGoogle()
      }
      throw err
    }
  }

  public async connectGoogleWithOAuth(
    clientId: string = DEFAULT_GOOGLE_CLIENT_ID,
  ): Promise<void> {
    const { verifier, challenge } = await generatePKCECodes()
    const state = generateOAuthState()

    const desktop = (window as any).evaDesktop
    if (desktop?.startGoogleOAuth) {
      // Desktop Loopback Server Flow
      const redirectUri = 'http://127.0.0.1:54321/oauth2callback'
      const authUrl = buildGoogleAuthUrl(clientId, redirectUri, state, challenge)

      const result = await desktop.startGoogleOAuth(authUrl, 54321)
      if (!result?.code) {
        throw new Error('Failed to obtain authorization code from Google.')
      }

      if (result.state !== state) {
        throw new Error('State validation failed. OAuth request may have been intercepted.')
      }

      const tokens = await exchangeGoogleAuthCode(clientId, result.code, verifier, redirectUri)
      await setSecureSecret(GOOGLE_TOKEN_KEY, tokens.accessToken)
      if (tokens.refreshToken) {
        await setSecureSecret(GOOGLE_REFRESH_TOKEN_KEY, tokens.refreshToken)
      }

      const profile = await getGoogleUserProfile(tokens.accessToken)
      this.config.googleAccount = {
        provider: 'google',
        connected: true,
        accountIdentity: profile.email,
        avatarUrl: profile.picture,
        googleClientId: clientId,
        tokenExpiresAt: Date.now() + tokens.expiresIn * 1000,
      }

      if (this.config.activeProvider === 'none') {
        this.config.activeProvider = 'google'
      }
      this.saveConfig()
      this.notify()
    } else {
      // Web / Fallback flow
      throw new Error(
        'On web/mobile, please connect using an authorized Google token or configure your Google Client ID.',
      )
    }
  }

  public async connectGoogleWithToken(
    accessToken: string,
    refreshToken?: string,
    expiresInSeconds: number = 3600,
  ): Promise<void> {
    const profile = await getGoogleUserProfile(accessToken)
    await setSecureSecret(GOOGLE_TOKEN_KEY, accessToken.trim())
    if (refreshToken) {
      await setSecureSecret(GOOGLE_REFRESH_TOKEN_KEY, refreshToken.trim())
    }

    this.config.googleAccount = {
      ...this.config.googleAccount,
      provider: 'google',
      connected: true,
      accountIdentity: profile.email,
      avatarUrl: profile.picture,
      tokenExpiresAt: Date.now() + expiresInSeconds * 1000,
    }
    if (this.config.activeProvider === 'none') {
      this.config.activeProvider = 'google'
    }
    this.saveConfig()
    this.notify()
  }

  public async disconnectGoogle(): Promise<void> {
    await removeSecureSecret(GOOGLE_TOKEN_KEY)
    await removeSecureSecret(GOOGLE_REFRESH_TOKEN_KEY)
    this.config.googleAccount = {
      provider: 'google',
      connected: false,
    }
    if (this.config.activeProvider === 'google') {
      this.config.activeProvider = this.config.githubAccount.connected ? 'github' : 'none'
    }
    this.saveConfig()
    this.notify()
  }

  public setActiveProvider(provider: 'none' | CloudProviderType): void {
    this.config.activeProvider = provider
    this.saveConfig()
    this.notify()
  }

  public setAutoSync(enabled: boolean): void {
    this.config.autoSyncEnabled = enabled
    this.saveConfig()
    this.notify()
    if (enabled) {
      void this.syncNow()
    }
  }

  // --- Auto-Sync Observer with Infinite-Loop Prevention ---

  private setupStoreListener(): void {
    if (typeof window === 'undefined') return
    useStore.subscribe((state, prevState) => {
      // Guard: Ignore mutations triggered by sync merging itself to prevent infinite loop
      if (this.isApplyingRemoteUpdate) {
        return
      }

      if (!this.config.autoSyncEnabled || this.config.activeProvider === 'none') {
        return
      }

      // Check all mutations
      const charactersChanged = state.characters !== prevState.characters
      const worldsChanged = state.worlds !== prevState.worlds
      const convsChanged = state.conversations !== prevState.conversations
      const settingsChanged = state.settings !== prevState.settings

      if (charactersChanged || worldsChanged || convsChanged || settingsChanged) {
        this.hasPendingOfflineChanges = true
        this.triggerDebouncedSync()
      }
    })
  }

  public triggerDebouncedSync(): void {
    if (!this.config.autoSyncEnabled || this.config.activeProvider === 'none') return
    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer)
    }
    this.autoSyncTimer = setTimeout(() => {
      void this.syncNow()
    }, 4000) // 4 seconds debounce
  }

  // --- Backup, Sync, and Restore Operations ---

  private getLocalSyncableData(): SyncableData {
    const state = useStore.getState()
    const tombstones = getLocalTombstones()
    return {
      characters: state.characters,
      worlds: state.worlds,
      conversations: state.conversations,
      settings: {
        theme: state.settings.theme,
        appearanceMode: state.settings.appearanceMode,
        accentPalette: state.settings.accentPalette,
        frostedGlass: state.settings.frostedGlass,
        customAccentColor: state.settings.customAccentColor,
        customContrastColor: state.settings.customContrastColor,
        themeAccents: state.settings.themeAccents,
        userPersona: state.settings.userPersona,
        globalSystemPrompt: state.settings.globalSystemPrompt,
        model: state.settings.model,
        temperature: state.settings.temperature,
        topP: state.settings.topP,
        maxTokens: state.settings.maxTokens,
        streaming: state.settings.streaming,
        memoryEnabled: state.settings.memoryEnabled,
        showThoughts: state.settings.showThoughts,
        bubbleStyle: state.settings.bubbleStyle,
      },
      tombstones,
      conflicts: this.config.conflicts,
      deviceId: this.deviceId,
    }
  }

  private computeMeta(data: SyncableData): SyncEnvelopeMeta {
    let messageCount = 0
    for (const c of data.conversations) {
      messageCount += c.messages?.length || 0
    }
    return {
      characterCount: data.characters.length,
      worldCount: data.worlds.length,
      conversationCount: data.conversations.length,
      messageCount,
    }
  }

  /**
   * Manual action: Encrypts local data and uploads directly to active cloud provider.
   */
  public async backupNow(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, message: 'Sync or backup already in progress.', timestamp: Date.now() }
    }
    if (this.config.activeProvider === 'none') {
      return { success: false, message: 'No cloud provider connected.', timestamp: Date.now() }
    }

    this.isSyncing = true
    this.setStatus('syncing', 'Creating encrypted backup...')

    try {
      const localData = this.getLocalSyncableData()
      const meta = this.computeMeta(localData)
      const salt = generateRandomBytes(16)
      const key = await this.getActiveKey(toBase64(salt))

      const envelope = await encryptBackup(localData, key, salt, meta, this.deviceId, '2.0.1', {
        parentEnvelopeId: this.lastEnvelopeId,
        remoteRevision: this.lastRemoteVersion,
      })

      if (this.config.activeProvider === 'github') {
        const token = await getSecureSecret(GITHUB_TOKEN_KEY)
        if (!token) throw new Error('GitHub token not found.')

        if (this.config.githubAccount.gitHubStorageType === 'gist') {
          const res = await uploadToGitHubGist(token, envelope, this.lastRemoteVersion)
          this.lastRemoteVersion = res.sha
        } else {
          const sha = await uploadToGitHubRepo(token, envelope, this.lastRemoteVersion)
          this.lastRemoteVersion = sha
        }
        this.config.githubAccount.lastBackupTimestamp = Date.now()
      } else if (this.config.activeProvider === 'google') {
        const token = await this.getValidGoogleAccessToken()
        const res = await uploadToGoogleDrive(token, envelope, this.lastRemoteVersion)
        this.lastRemoteVersion = res.version
        this.config.googleAccount.lastBackupTimestamp = Date.now()
      }

      this.lastEnvelopeId = envelope.envelopeId
      this.hasPendingOfflineChanges = false
      this.saveConfig()
      this.setStatus('success', 'Backup completed successfully.')
      return { success: true, message: 'Backup completed successfully.', timestamp: Date.now() }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err)
      this.setStatus('error', `Backup failed: ${msg}`)
      return { success: false, message: msg, timestamp: Date.now() }
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Two-way synchronization with concurrent-overwrite protection:
   * Downloads remote backup, merges with local state, updates local store safely,
   * and uploads merged snapshot back to cloud using atomic CAS checks.
   */
  public async syncNow(retryCount: number = 0): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress.', timestamp: Date.now() }
    }
    if (this.config.activeProvider === 'none') {
      return { success: false, message: 'No cloud provider selected.', timestamp: Date.now() }
    }

    this.isSyncing = true
    this.setStatus('syncing', 'Connecting to cloud provider...')

    try {
      let remoteEnvelope: EncryptedBackupEnvelope | null = null
      let currentRemoteRevision: string | undefined = undefined

      if (this.config.activeProvider === 'github') {
        const token = await getSecureSecret(GITHUB_TOKEN_KEY)
        if (!token) throw new Error('GitHub account is not connected.')

        if (this.config.githubAccount.gitHubStorageType === 'gist') {
          const found = await findEvaGist(token)
          if (found) {
            remoteEnvelope = found.envelope
            currentRemoteRevision = found.sha
          }
        } else {
          const found = await findEvaRepoFile(token)
          if (found) {
            remoteEnvelope = found.envelope
            currentRemoteRevision = found.sha
          }
        }
      } else if (this.config.activeProvider === 'google') {
        const token = await this.getValidGoogleAccessToken()
        const found = await findEvaGoogleDriveFile(token)
        if (found) {
          remoteEnvelope = found.envelope
          currentRemoteRevision = found.version
        }
      }

      const localData = this.getLocalSyncableData()

      // If no remote backup exists yet, this device creates the initial backup
      if (!remoteEnvelope) {
        this.setStatus('syncing', 'Initializing first cloud backup...')
        const salt = generateRandomBytes(16)
        const key = await this.getActiveKey(toBase64(salt))
        const meta = this.computeMeta(localData)
        const newEnvelope = await encryptBackup(localData, key, salt, meta, this.deviceId, '2.0.1')

        if (this.config.activeProvider === 'github') {
          const token = (await getSecureSecret(GITHUB_TOKEN_KEY))!
          if (this.config.githubAccount.gitHubStorageType === 'gist') {
            const res = await uploadToGitHubGist(token, newEnvelope)
            this.lastRemoteVersion = res.sha
          } else {
            const sha = await uploadToGitHubRepo(token, newEnvelope)
            this.lastRemoteVersion = sha
          }
          this.config.githubAccount.lastSyncTimestamp = Date.now()
        } else {
          const token = await this.getValidGoogleAccessToken()
          const res = await uploadToGoogleDrive(token, newEnvelope)
          this.lastRemoteVersion = res.version
          this.config.googleAccount.lastSyncTimestamp = Date.now()
        }

        this.lastEnvelopeId = newEnvelope.envelopeId
        this.hasPendingOfflineChanges = false
        this.saveConfig()
        this.setStatus('success', 'First cloud sync initialized successfully.')
        return {
          success: true,
          message: 'First cloud backup created.',
          timestamp: Date.now(),
        }
      }

      // Check schema version
      if (remoteEnvelope.schemaVersion > 2) {
        throw new Error(
          'Cloud backup was created by a newer version of Eva. Please update the application to sync.',
        )
      }

      this.setStatus('syncing', 'Decrypting and merging changes...')
      const key = await this.getActiveKey(remoteEnvelope.salt)
      const remoteData = await decryptBackup(remoteEnvelope, key)

      const { merged, stats, conflicts } = mergeSyncData(localData, remoteData)
      this.config.conflicts = conflicts

      // Apply merged data to local store while blocking recursive auto-sync
      this.isApplyingRemoteUpdate = true
      try {
        useStore.getState().replaceAll({
          characters: merged.characters,
          worlds: merged.worlds,
          conversations: merged.conversations,
          settings: merged.settings,
        })
      } finally {
        setTimeout(() => {
          this.isApplyingRemoteUpdate = false
        }, 500)
      }

      // Upload unified merged state back to cloud with concurrency checking
      this.setStatus('syncing', 'Uploading synchronized snapshot...')
      const salt = generateRandomBytes(16)
      const uploadKey = await this.getActiveKey(toBase64(salt))
      const meta = this.computeMeta(merged)
      const updatedEnvelope = await encryptBackup(merged, uploadKey, salt, meta, this.deviceId, '2.0.1', {
        parentEnvelopeId: remoteEnvelope.envelopeId,
        remoteRevision: currentRemoteRevision,
      })

      if (this.config.activeProvider === 'github') {
        const token = (await getSecureSecret(GITHUB_TOKEN_KEY))!
        if (this.config.githubAccount.gitHubStorageType === 'gist') {
          const res = await uploadToGitHubGist(token, updatedEnvelope, currentRemoteRevision)
          this.lastRemoteVersion = res.sha
        } else {
          const sha = await uploadToGitHubRepo(token, updatedEnvelope, currentRemoteRevision)
          this.lastRemoteVersion = sha
        }
        this.config.githubAccount.lastSyncTimestamp = Date.now()
      } else {
        const token = await this.getValidGoogleAccessToken()
        const res = await uploadToGoogleDrive(token, updatedEnvelope, currentRemoteRevision)
        this.lastRemoteVersion = res.version
        this.config.googleAccount.lastSyncTimestamp = Date.now()
      }

      this.lastEnvelopeId = updatedEnvelope.envelopeId
      this.hasPendingOfflineChanges = false
      this.saveConfig()

      let summaryMsg = `Synchronized (${stats.charactersAdded + stats.charactersUpdated} chars, ${stats.conversationsAdded + stats.conversationsUpdated} convs, ${stats.messagesMerged} msgs).`
      if (conflicts.length > 0) {
        summaryMsg += ` (${conflicts.length} field conflicts preserved).`
        this.setStatus('conflict', summaryMsg)
      } else {
        this.setStatus('success', summaryMsg)
      }

      return {
        success: true,
        message: summaryMsg,
        timestamp: Date.now(),
        mergedStats: stats,
        conflicts,
      }
    } catch (err: any) {
      // If concurrent write was detected, automatically re-fetch and retry up to 3 times
      if (err instanceof ConcurrencyConflictError && retryCount < 3) {
        this.isSyncing = false
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retryCount)))
        return this.syncNow(retryCount + 1)
      }

      const msg = err instanceof Error ? err.message : String(err)
      this.setStatus('error', `Sync failed: ${msg}`)
      return { success: false, message: msg, timestamp: Date.now() }
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Downloads remote backup metadata for restoration preview.
   */
  public async fetchRemotePreview(passphraseCandidate?: string): Promise<RestorePreview> {
    if (this.config.activeProvider === 'none') {
      throw new Error('No cloud provider connected.')
    }

    let envelope: EncryptedBackupEnvelope | null = null

    if (this.config.activeProvider === 'github') {
      const token = await getSecureSecret(GITHUB_TOKEN_KEY)
      if (!token) throw new Error('GitHub account is not connected.')

      if (this.config.githubAccount.gitHubStorageType === 'gist') {
        const found = await findEvaGist(token)
        if (found) envelope = found.envelope
      } else {
        const found = await findEvaRepoFile(token)
        if (found) envelope = found.envelope
      }
    } else if (this.config.activeProvider === 'google') {
      const token = await this.getValidGoogleAccessToken()
      const found = await findEvaGoogleDriveFile(token)
      if (found) envelope = found.envelope
    }

    if (!envelope) {
      throw new Error('No existing cloud backup found on this account.')
    }

    if (passphraseCandidate) {
      const key = await deriveKey(passphraseCandidate, fromBase64(envelope.salt))
      await decryptBackup(envelope, key)
      await this.setPassphrase(passphraseCandidate)
    }

    return {
      timestamp: envelope.timestamp,
      deviceId: envelope.deviceId,
      appVersion: envelope.appVersion,
      meta: envelope.meta,
      envelope,
    }
  }

  /**
   * Restores application state from cloud backup.
   */
  public async restoreFromCloud(
    mode: 'merge' | 'replace' = 'merge',
    passphrase?: string,
  ): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, message: 'Operation in progress.', timestamp: Date.now() }
    }

    this.isSyncing = true
    this.setStatus('syncing', 'Restoring from cloud backup...')

    try {
      const preview = await this.fetchRemotePreview(passphrase)
      const envelope = preview.envelope

      const key = await this.getActiveKey(envelope.salt)
      const decryptedData = await decryptBackup(envelope, key)

      this.isApplyingRemoteUpdate = true
      try {
        if (mode === 'replace') {
          // Safety backup of current store in case user wants to rollback
          try {
            const currentStore = window.localStorage.getItem('nexus-chat-store')
            if (currentStore) {
              window.localStorage.setItem(`eva_backup_pre_restore_${Date.now()}`, currentStore)
            }
          } catch {
            // Ignore
          }

          useStore.getState().replaceAll({
            characters: decryptedData.characters,
            worlds: decryptedData.worlds,
            conversations: decryptedData.conversations,
            settings: decryptedData.settings,
          })
        } else {
          const localData = this.getLocalSyncableData()
          const { merged, conflicts } = mergeSyncData(localData, decryptedData)
          this.config.conflicts = conflicts
          useStore.getState().replaceAll({
            characters: merged.characters,
            worlds: merged.worlds,
            conversations: merged.conversations,
            settings: merged.settings,
          })
        }
      } finally {
        setTimeout(() => {
          this.isApplyingRemoteUpdate = false
        }, 500)
      }

      this.setStatus('success', 'Cloud restore completed successfully.')
      return {
        success: true,
        message: 'Data successfully restored from cloud.',
        timestamp: Date.now(),
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err)
      this.setStatus('error', `Restore failed: ${msg}`)
      return { success: false, message: msg, timestamp: Date.now() }
    } finally {
      this.isSyncing = false
    }
  }
}

export const syncEngine = new SyncEngine()
