/**
 * Cloud Backup & Sync Settings Component for Eva v2.x
 *
 * Implements:
 * - Real Google Drive OAuth 2.0 PKCE flow with automatic token refresh
 * - Real GitHub Device Authorization Flow (RFC 8628) with live user code & polling
 * - Storage target selection: Dedicated Private Repository vs Unlisted Secret Gist
 * - Client-side AES-256-GCM zero-knowledge encryption with PBKDF2 & recovery keys
 * - Hardware credential storage diagnostics & web storage explicit consent
 * - Safe conflict detection and resolution previews
 */

import { useEffect, useState, useRef } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Upload,
  Download,
  Key,
  Shield,
  ExternalLink,
  Lock,
  Copy,
  Check,
  Smartphone,
  HardDrive,
} from 'lucide-react'
import { syncEngine } from '@/lib/sync/syncEngine'
import { generateRecoveryKey } from '@/lib/sync/syncCrypto'
import {
  startGitHubDeviceFlow,
  pollGitHubDeviceFlow,
  DEFAULT_GITHUB_CLIENT_ID,
  type DeviceCodeResponse,
} from '@/lib/sync/githubProvider'
import { DEFAULT_GOOGLE_CLIENT_ID } from '@/lib/sync/googleDriveProvider'
import {
  getCredentialStorageInfo,
  isWebPersistenceAllowed,
  setWebPersistenceAllowed,
  type CredentialStorageInfo,
} from '@/lib/credentials'
import type { RestorePreview, SyncConfig } from '@/lib/sync/syncTypes'

export function SyncSettings() {
  const [config, setConfig] = useState<SyncConfig>(syncEngine.getConfig())
  const [passphraseInput, setPassphraseInput] = useState('')
  const [showPassphraseModal, setShowPassphraseModal] = useState(false)
  const [generatedKey, setGeneratedKey] = useState('')
  const [copiedKey, setCopiedKey] = useState(false)

  // Platform Storage Diagnostics & Web Consent
  const [storageInfo, setStorageInfo] = useState<CredentialStorageInfo | null>(null)
  const [webConsent, setWebConsent] = useState(isWebPersistenceAllowed())

  // GitHub Device Flow State
  const [showGitHubModal, setShowGitHubModal] = useState(false)
  const [gitHubMode, setGitHubMode] = useState<'device' | 'token'>('device')
  const [gitHubDeviceCode, setGitHubDeviceCode] = useState<DeviceCodeResponse | null>(null)
  const [gitHubPolling, setGitHubPolling] = useState(false)
  const [gitHubCopiedUserCode, setGitHubCopiedUserCode] = useState(false)
  const [gitHubTokenInput, setGitHubTokenInput] = useState('')
  const [gitHubError, setGitHubError] = useState('')
  const gitHubAbortRef = useRef<AbortController | null>(null)

  // Google OAuth Flow State
  const [showGoogleModal, setShowGoogleModal] = useState(false)
  const [googleMode, setGoogleMode] = useState<'oauth' | 'token'>('oauth')
  const [googleClientIdInput, setGoogleClientIdInput] = useState(
    config.googleAccount.googleClientId || DEFAULT_GOOGLE_CLIENT_ID,
  )
  const [googleTokenInput, setGoogleTokenInput] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')

  // Restore preview modal state
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null)
  const [restorePassphrase, setRestorePassphrase] = useState('')
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge')
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreError, setRestoreError] = useState('')

  // Sync action feedback
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((newConfig) => {
      setConfig(newConfig)
    })
    void getCredentialStorageInfo().then(setStorageInfo)
    return () => {
      unsubscribe()
      if (gitHubAbortRef.current) {
        gitHubAbortRef.current.abort()
      }
    }
  }, [])

  const handleSetPassphrase = async () => {
    if (!passphraseInput || passphraseInput.trim().length < 8) {
      alert('Passphrase must be at least 8 characters long.')
      return
    }
    try {
      await syncEngine.setPassphrase(passphraseInput.trim())
      setShowPassphraseModal(false)
      setPassphraseInput('')
      setActionFeedback({ type: 'success', text: 'Encryption passphrase configured successfully.' })
    } catch (err: any) {
      alert(err.message || 'Failed to set passphrase.')
    }
  }

  const handleGenerateKey = () => {
    const key = generateRecoveryKey()
    setGeneratedKey(key)
    setPassphraseInput(key)
  }

  const handleCopyGeneratedKey = () => {
    if (!generatedKey) return
    navigator.clipboard.writeText(generatedKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const handleWebConsentToggle = (allowed: boolean) => {
    setWebPersistenceAllowed(allowed)
    setWebConsent(allowed)
    void getCredentialStorageInfo().then(setStorageInfo)
    setActionFeedback({
      type: 'info',
      text: allowed
        ? 'Browser persistence enabled. Credentials will persist in this browser.'
        : 'In-memory storage enabled. Credentials will clear upon closing this tab.',
    })
  }

  // --- Real GitHub Device Flow ---

  const handleStartGitHubDeviceFlow = async () => {
    setGitHubError('')
    setGitHubPolling(true)
    const controller = new AbortController()
    gitHubAbortRef.current = controller

    try {
      const scope = config.githubAccount.gitHubStorageType === 'gist' ? 'gist' : 'repo'
      const deviceRes = await startGitHubDeviceFlow(DEFAULT_GITHUB_CLIENT_ID, scope)
      setGitHubDeviceCode(deviceRes)

      // Automatically poll for completion
      const token = await pollGitHubDeviceFlow(
        DEFAULT_GITHUB_CLIENT_ID,
        deviceRes.device_code,
        deviceRes.interval,
        controller.signal,
      )

      await syncEngine.connectGitHubWithToken(token)
      setShowGitHubModal(false)
      setGitHubDeviceCode(null)
      setGitHubPolling(false)
      setActionFeedback({ type: 'success', text: 'GitHub account connected successfully.' })
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setGitHubError(err.message || 'GitHub device authorization failed.')
      setGitHubPolling(false)
    }
  }

  const handleCancelGitHubDeviceFlow = () => {
    if (gitHubAbortRef.current) {
      gitHubAbortRef.current.abort()
      gitHubAbortRef.current = null
    }
    setGitHubPolling(false)
    setGitHubDeviceCode(null)
    setGitHubError('')
  }

  const handleCopyGitHubUserCode = () => {
    if (!gitHubDeviceCode?.user_code) return
    navigator.clipboard.writeText(gitHubDeviceCode.user_code)
    setGitHubCopiedUserCode(true)
    setTimeout(() => setGitHubCopiedUserCode(false), 2000)
  }

  const handleConnectGitHubManualToken = async () => {
    if (!gitHubTokenInput.trim()) return
    setGitHubError('')
    try {
      await syncEngine.connectGitHubWithToken(gitHubTokenInput.trim())
      setShowGitHubModal(false)
      setGitHubTokenInput('')
      setActionFeedback({ type: 'success', text: 'GitHub account connected with access token.' })
    } catch (err: any) {
      setGitHubError(err.message || 'Failed to authenticate with GitHub token.')
    }
  }

  // --- Real Google PKCE Flow ---

  const handleConnectGoogleOAuth = async () => {
    setGoogleLoading(true)
    setGoogleError('')
    try {
      await syncEngine.connectGoogleWithOAuth(googleClientIdInput.trim() || DEFAULT_GOOGLE_CLIENT_ID)
      setShowGoogleModal(false)
      setActionFeedback({ type: 'success', text: 'Google Drive connected successfully via PKCE.' })
    } catch (err: any) {
      setGoogleError(err.message || 'Google authorization failed.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleConnectGoogleManualToken = async () => {
    if (!googleTokenInput.trim()) return
    setGoogleLoading(true)
    setGoogleError('')
    try {
      await syncEngine.connectGoogleWithToken(googleTokenInput.trim())
      setShowGoogleModal(false)
      setGoogleTokenInput('')
      setActionFeedback({ type: 'success', text: 'Google Drive connected with access token.' })
    } catch (err: any) {
      setGoogleError(err.message || 'Failed to authenticate with Google token.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleSyncNow = async () => {
    if (!config.hasPassphrase) {
      setShowPassphraseModal(true)
      return
    }
    setActionFeedback(null)
    const result = await syncEngine.syncNow()
    setActionFeedback({
      type: result.success ? 'success' : 'error',
      text: result.message,
    })
  }

  const handleBackupNow = async () => {
    if (!config.hasPassphrase) {
      setShowPassphraseModal(true)
      return
    }
    setActionFeedback(null)
    const result = await syncEngine.backupNow()
    setActionFeedback({
      type: result.success ? 'success' : 'error',
      text: result.message,
    })
  }

  const handleOpenRestoreModal = async () => {
    setRestoreError('')
    setRestoreLoading(true)
    setShowRestoreModal(true)
    try {
      const preview = await syncEngine.fetchRemotePreview()
      setRestorePreview(preview)
    } catch (err: any) {
      setRestoreError(err.message || 'Could not fetch cloud backup.')
    } finally {
      setRestoreLoading(false)
    }
  }

  const handleConfirmRestore = async () => {
    setRestoreLoading(true)
    setRestoreError('')
    try {
      const result = await syncEngine.restoreFromCloud(restoreMode, restorePassphrase.trim() || undefined)
      if (result.success) {
        setShowRestoreModal(false)
        setActionFeedback({ type: 'success', text: result.message })
      } else {
        setRestoreError(result.message)
      }
    } catch (err: any) {
      setRestoreError(err.message || 'Restoration failed.')
    } finally {
      setRestoreLoading(false)
    }
  }

  const formatTimestamp = (ts?: number | string) => {
    if (!ts) return 'Never'
    const date = new Date(typeof ts === 'string' ? ts : ts)
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isConnected = config.googleAccount.connected || config.githubAccount.connected

  return (
    <div className="space-y-6">
      {/* Overview & Zero-Knowledge Banner */}
      <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="text-accent" size={18} />
            <h3 className="text-sm font-semibold text-fg">End-to-End Encrypted Cloud Sync</h3>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-mono">
            AES-256-GCM + PBKDF2
          </span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Optionally synchronize characters, conversations, and worlds across devices with 3-way merge conflict protection.
          Data is zero-knowledge encrypted on your device before transmission. Neither Google, GitHub, nor third parties can read your messages.
        </p>
      </div>

      {/* Hardware Credential Storage Diagnostics Banner */}
      {storageInfo && (
        <div className="p-3 rounded-xl border border-border bg-surface-2 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            {storageInfo.isHardwareEncrypted ? (
              <HardDrive className="text-emerald-500 shrink-0" size={16} />
            ) : (
              <Smartphone className="text-amber-500 shrink-0" size={16} />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-fg">Local Credential Security:</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    storageInfo.isHardwareEncrypted
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                  }`}
                >
                  {storageInfo.platform}
                </span>
              </div>
              <p className="text-faint text-[11px] mt-0.5">{storageInfo.description}</p>
            </div>
          </div>

          {!storageInfo.isHardwareEncrypted && (
            <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={webConsent}
                onChange={(e) => handleWebConsentToggle(e.target.checked)}
                className="rounded border-border bg-surface text-accent"
              />
              <span className="text-[11px] text-muted">Allow browser persistence</span>
            </label>
          )}
        </div>
      )}

      {/* Conflict Alert Banner */}
      {config.conflicts && config.conflicts.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle size={15} />
            <span>{config.conflicts.length} Concurrent Conflict(s) Preserved</span>
          </div>
          <p className="text-muted text-[11px]">
            Another device modified the same character fields concurrently. To prevent data loss, Eva preserved both versions: your local version remains active, and the remote version has been saved as a branched copy.
          </p>
        </div>
      )}

      {/* Sync Status Feedback */}
      {config.syncStatus === 'syncing' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20 text-xs text-accent">
          <RefreshCw className="animate-spin" size={14} />
          <span>{config.lastSyncMessage || 'Synchronizing with cloud...'}</span>
        </div>
      )}

      {actionFeedback && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300'
              : actionFeedback.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-300'
              : 'bg-accent/10 border-accent/20 text-accent'
          }`}
        >
          {actionFeedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* Cloud Accounts Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-faint">Cloud Providers</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Google Account Card */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              config.googleAccount.connected
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-border bg-surface-2'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center font-bold text-sm text-fg">
                  G
                </div>
                <div>
                  <h5 className="text-sm font-medium text-fg">Google Drive</h5>
                  <p className="text-xs text-faint">Private appDataFolder</p>
                </div>
              </div>
              {config.googleAccount.connected ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-medium flex items-center gap-1">
                  <CheckCircle2 size={10} /> Connected
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-3 text-muted">
                  Not Connected
                </span>
              )}
            </div>

            {config.googleAccount.connected && (
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted space-y-1">
                <div className="flex justify-between">
                  <span className="text-faint">Account:</span>
                  <span className="font-mono text-fg truncate max-w-[150px]">
                    {config.googleAccount.accountIdentity || 'Google User'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-faint">Last Sync:</span>
                  <span>{formatTimestamp(config.googleAccount.lastSyncTimestamp)}</span>
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              {config.googleAccount.connected ? (
                <>
                  <button
                    onClick={() => syncEngine.setActiveProvider('google')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition ${
                      config.activeProvider === 'google'
                        ? 'bg-accent border-accent text-accent-fg'
                        : 'bg-surface-3 border-border text-muted hover:text-fg hover:bg-surface'
                    }`}
                  >
                    {config.activeProvider === 'google' ? 'Active Target' : 'Use Google'}
                  </button>
                  <button
                    onClick={() => syncEngine.disconnectGoogle()}
                    className="py-1.5 px-3 rounded-lg text-xs font-medium border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowGoogleModal(true)}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-medium border border-border bg-surface-3 text-fg hover:bg-surface transition"
                >
                  Connect Google
                </button>
              )}
            </div>
          </div>

          {/* GitHub Account Card */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              config.githubAccount.connected
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-border bg-surface-2'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center font-bold text-sm text-fg">
                  GH
                </div>
                <div>
                  <h5 className="text-sm font-medium text-fg">GitHub Cloud</h5>
                  <p className="text-xs text-faint">
                    {config.githubAccount.gitHubStorageType === 'gist'
                      ? 'Secret Gist (Unlisted)'
                      : 'Private Repository (Access-Controlled)'}
                  </p>
                </div>
              </div>
              {config.githubAccount.connected ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-medium flex items-center gap-1">
                  <CheckCircle2 size={10} /> Connected
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-3 text-muted">
                  Not Connected
                </span>
              )}
            </div>

            {config.githubAccount.connected && (
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted space-y-1">
                <div className="flex justify-between">
                  <span className="text-faint">Account:</span>
                  <span className="font-mono text-fg">
                    @{config.githubAccount.accountIdentity || 'GitHub User'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-faint">Storage:</span>
                  <span className="text-fg font-medium">
                    {config.githubAccount.gitHubStorageType === 'gist' ? 'Secret Gist' : 'Private Repo'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-faint">Last Sync:</span>
                  <span>{formatTimestamp(config.githubAccount.lastSyncTimestamp)}</span>
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              {config.githubAccount.connected ? (
                <>
                  <button
                    onClick={() => syncEngine.setActiveProvider('github')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition ${
                      config.activeProvider === 'github'
                        ? 'bg-accent border-accent text-accent-fg'
                        : 'bg-surface-3 border-border text-muted hover:text-fg hover:bg-surface'
                    }`}
                  >
                    {config.activeProvider === 'github' ? 'Active Target' : 'Use GitHub'}
                  </button>
                  <button
                    onClick={() => syncEngine.disconnectGitHub()}
                    className="py-1.5 px-3 rounded-lg text-xs font-medium border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowGitHubModal(true)}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-medium border border-border bg-surface-3 text-fg hover:bg-surface transition"
                >
                  Connect GitHub
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Sync and Encryption Controls */}
      <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-fg">Enable automatic sync</h4>
            <p className="text-xs text-faint">
              Debounced background synchronization when characters or conversations change.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoSyncEnabled}
              disabled={!isConnected}
              onChange={(e) => syncEngine.setAutoSync(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-disabled:opacity-40"></div>
          </label>
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={15} className={config.hasPassphrase ? 'text-emerald-500' : 'text-amber-500'} />
            <div>
              <p className="text-xs font-medium text-fg">
                {config.hasPassphrase ? 'Passphrase Protected' : 'No Passphrase Configured'}
              </p>
              <p className="text-[11px] text-faint">
                {config.hasPassphrase
                  ? 'Client-side AES-256 key is derived and secured on this device.'
                  : 'A passphrase is required before syncing data to the cloud.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPassphraseModal(true)}
            className="py-1 px-2.5 rounded-lg text-xs border border-border bg-surface-3 hover:bg-surface text-fg transition flex items-center gap-1.5"
          >
            <Key size={13} />
            {config.hasPassphrase ? 'Change Passphrase' : 'Set Passphrase'}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          onClick={handleSyncNow}
          disabled={!isConnected || config.syncStatus === 'syncing'}
          className="py-2.5 px-3 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 text-fg text-xs font-medium transition flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <RefreshCw size={14} className={config.syncStatus === 'syncing' ? 'animate-spin' : ''} />
          Sync now
        </button>

        <button
          onClick={handleBackupNow}
          disabled={!isConnected || config.syncStatus === 'syncing'}
          className="py-2.5 px-3 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 text-fg text-xs font-medium transition flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Upload size={14} />
          Back up now
        </button>

        <button
          onClick={handleOpenRestoreModal}
          disabled={!isConnected || config.syncStatus === 'syncing'}
          className="py-2.5 px-3 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 text-fg text-xs font-medium transition flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Download size={14} />
          Restore from cloud
        </button>
      </div>

      {/* GitHub Authorization Modal */}
      {showGitHubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-surface-elevated border border-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-fg">Connect GitHub Cloud Backup</h3>
              <div className="flex bg-surface-3 rounded-lg p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setGitHubMode('device')}
                  className={`px-2 py-0.5 rounded-md ${gitHubMode === 'device' ? 'bg-accent text-accent-fg font-medium' : 'text-muted'}`}
                >
                  Device Flow
                </button>
                <button
                  type="button"
                  onClick={() => setGitHubMode('token')}
                  className={`px-2 py-0.5 rounded-md ${gitHubMode === 'token' ? 'bg-accent text-accent-fg font-medium' : 'text-muted'}`}
                >
                  Manual Token
                </button>
              </div>
            </div>

            {/* Storage Target Selector with Transparent Security Explanation */}
            <div className="space-y-1.5 p-3 rounded-xl bg-surface-2 border border-border">
              <label className="text-xs font-medium text-fg block">Storage Target on GitHub:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => syncEngine.setGitHubStorageType('repo')}
                  className={`p-2 rounded-lg border text-left transition ${
                    config.githubAccount.gitHubStorageType !== 'gist'
                      ? 'border-accent bg-accent/10 text-fg'
                      : 'border-border bg-surface text-muted hover:bg-surface-3'
                  }`}
                >
                  <div className="text-xs font-semibold">Private Repo (Recommended)</div>
                  <div className="text-[10px] text-faint mt-0.5">Strict access-control via GitHub permissions</div>
                </button>

                <button
                  type="button"
                  onClick={() => syncEngine.setGitHubStorageType('gist')}
                  className={`p-2 rounded-lg border text-left transition ${
                    config.githubAccount.gitHubStorageType === 'gist'
                      ? 'border-accent bg-accent/10 text-fg'
                      : 'border-border bg-surface text-muted hover:bg-surface-3'
                  }`}
                >
                  <div className="text-xs font-semibold">Secret Gist (Unlisted)</div>
                  <div className="text-[10px] text-faint mt-0.5">Hidden from search, but anyone with link can view</div>
                </button>
              </div>
            </div>

            {gitHubMode === 'device' ? (
              <div className="space-y-3">
                <p className="text-xs text-muted leading-relaxed">
                  Connect without pasting passwords using GitHub OAuth Device Authorization (RFC 8628).
                </p>

                {gitHubDeviceCode ? (
                  <div className="p-4 rounded-xl bg-surface-2 border border-border text-center space-y-3">
                    <span className="text-xs text-faint block">Enter this code on GitHub:</span>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xl font-mono font-bold tracking-widest text-emerald-500">
                        {gitHubDeviceCode.user_code}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyGitHubUserCode}
                        className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface text-muted hover:text-fg"
                        title="Copy Code"
                      >
                        {gitHubCopiedUserCode ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>

                    <a
                      href={gitHubDeviceCode.verification_uri}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-accent-fg text-xs font-medium hover:opacity-90 transition shadow-lg"
                    >
                      Open GitHub Activation Page <ExternalLink size={13} />
                    </a>

                    {gitHubPolling && (
                      <div className="flex items-center justify-center gap-1.5 text-[11px] text-faint pt-1">
                        <RefreshCw className="animate-spin" size={12} />
                        <span>Waiting for you to authorize on GitHub...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartGitHubDeviceFlow}
                    disabled={gitHubPolling}
                    className="w-full py-2.5 rounded-xl bg-accent text-accent-fg text-xs font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
                  >
                    {gitHubPolling ? <RefreshCw className="animate-spin" size={14} /> : null}
                    Start Device Authorization
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted leading-relaxed">
                  Provide a Personal Access Token with <code className="bg-surface-3 px-1 py-0.5 rounded text-fg">{config.githubAccount.gitHubStorageType === 'gist' ? 'gist' : 'repo'}</code> scope.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted">Personal Access Token</label>
                  <input
                    type="password"
                    placeholder="ghp_..."
                    value={gitHubTokenInput}
                    onChange={(e) => setGitHubTokenInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-fg text-xs font-mono focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={handleConnectGitHubManualToken}
                    disabled={!gitHubTokenInput.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40"
                  >
                    Save Token
                  </button>
                </div>
              </div>
            )}

            {gitHubError && <p className="text-xs text-red-500">{gitHubError}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => {
                  handleCancelGitHubDeviceFlow()
                  setShowGitHubModal(false)
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-fg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Authorization Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-surface-elevated border border-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-fg">Connect Google Drive</h3>
              <div className="flex bg-surface-3 rounded-lg p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setGoogleMode('oauth')}
                  className={`px-2 py-0.5 rounded-md ${googleMode === 'oauth' ? 'bg-accent text-accent-fg font-medium' : 'text-muted'}`}
                >
                  PKCE OAuth
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleMode('token')}
                  className={`px-2 py-0.5 rounded-md ${googleMode === 'token' ? 'bg-accent text-accent-fg font-medium' : 'text-muted'}`}
                >
                  Manual Token
                </button>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Backups are saved to Google Drive’s private <code className="bg-surface-3 px-1 py-0.5 rounded text-fg">appDataFolder</code>. Files are completely invisible to regular Drive views.
            </p>

            {googleMode === 'oauth' ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted flex items-center justify-between">
                    <span>Google OAuth Client ID</span>
                    <span className="text-[10px] text-faint">Public native client</span>
                  </label>
                  <input
                    type="text"
                    value={googleClientIdInput}
                    onChange={(e) => setGoogleClientIdInput(e.target.value)}
                    placeholder="Enter Google Client ID"
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-fg text-xs font-mono focus:outline-none focus:border-accent"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleConnectGoogleOAuth}
                  disabled={googleLoading}
                  className="w-full py-2.5 rounded-xl bg-accent text-accent-fg text-xs font-medium hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {googleLoading ? <RefreshCw className="animate-spin" size={14} /> : null}
                  Authorize with Google Account
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted">Google OAuth Access Token</label>
                  <input
                    type="password"
                    placeholder="ya29...."
                    value={googleTokenInput}
                    onChange={(e) => setGoogleTokenInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-fg text-xs font-mono focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={handleConnectGoogleManualToken}
                    disabled={googleLoading || !googleTokenInput.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40"
                  >
                    Save Token
                  </button>
                </div>
              </div>
            )}

            {googleError && <p className="text-xs text-red-500">{googleError}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowGoogleModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-fg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passphrase Modal */}
      {showPassphraseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-surface-elevated border border-border shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-fg">Configure Encryption Passphrase</h3>
            <p className="text-xs text-muted leading-relaxed">
              Your passphrase derives an AES-256-GCM key with 600,000 PBKDF2 iterations.
              You will need this same passphrase on any other device you wish to sync with.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted">Passphrase (Minimum 8 characters)</label>
              <input
                type="text"
                placeholder="Enter memorable passphrase or recovery key"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-fg text-xs focus:outline-none focus:border-accent"
              />
            </div>

            <div className="p-3 rounded-lg bg-surface-2 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Or generate a high-entropy recovery key:</span>
                <button
                  type="button"
                  onClick={handleGenerateKey}
                  className="text-xs text-accent hover:underline font-medium"
                >
                  Generate Key
                </button>
              </div>
              {generatedKey && (
                <div className="flex items-center justify-between gap-2 p-2 rounded bg-surface border border-border">
                  <span className="font-mono text-xs text-emerald-500 select-all truncate">{generatedKey}</span>
                  <button
                    type="button"
                    onClick={handleCopyGeneratedKey}
                    className="p-1 rounded hover:bg-surface-3 text-muted hover:text-fg"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPassphraseModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-fg"
              >
                Cancel
              </button>
              <button
                onClick={handleSetPassphrase}
                disabled={passphraseInput.trim().length < 8}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40"
              >
                Save Passphrase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Preview Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-surface-elevated border border-border shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-fg">Restore from Cloud Backup</h3>

            {restoreLoading && !restorePreview && (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted text-xs">
                <RefreshCw className="animate-spin text-accent" size={24} />
                <span>Reading remote backup from cloud...</span>
              </div>
            )}

            {restoreError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{restoreError}</span>
              </div>
            )}

            {restorePreview && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-surface-2 border border-border space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-faint">Backup Timestamp:</span>
                    <span className="font-medium text-fg">{formatTimestamp(restorePreview.timestamp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-faint">Originating App Version:</span>
                    <span className="font-mono text-fg">{restorePreview.appVersion}</span>
                  </div>
                  <div className="pt-2 border-t border-border grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-surface">
                      <div className="text-sm font-bold text-fg">{restorePreview.meta.characterCount}</div>
                      <div className="text-[10px] text-faint">Characters</div>
                    </div>
                    <div className="p-2 rounded bg-surface">
                      <div className="text-sm font-bold text-fg">{restorePreview.meta.worldCount}</div>
                      <div className="text-[10px] text-faint">Worlds</div>
                    </div>
                    <div className="p-2 rounded bg-surface">
                      <div className="text-sm font-bold text-fg">{restorePreview.meta.conversationCount}</div>
                      <div className="text-[10px] text-faint">Conversations</div>
                    </div>
                  </div>
                </div>

                {!config.hasPassphrase && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted">Enter Decryption Passphrase or Recovery Key</label>
                    <input
                      type="password"
                      placeholder="Enter passphrase"
                      value={restorePassphrase}
                      onChange={(e) => setRestorePassphrase(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-fg text-xs font-mono focus:outline-none focus:border-accent"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted">Restoration Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRestoreMode('merge')}
                      className={`p-3 rounded-xl border text-left transition ${
                        restoreMode === 'merge'
                          ? 'border-accent bg-accent/10 text-fg'
                          : 'border-border bg-surface-2 text-muted hover:bg-surface-3'
                      }`}
                    >
                      <div className="text-xs font-semibold">Merge (Recommended)</div>
                      <div className="text-[10px] text-faint mt-1">
                        Combines cloud data with local data without losing local conversations.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRestoreMode('replace')}
                      className={`p-3 rounded-xl border text-left transition ${
                        restoreMode === 'replace'
                          ? 'border-amber-500 bg-amber-500/10 text-fg'
                          : 'border-border bg-surface-2 text-muted hover:bg-surface-3'
                      }`}
                    >
                      <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">Clean Replace</div>
                      <div className="text-[10px] text-faint mt-1">
                        Replaces local state entirely with cloud backup. Creates safety backup first.
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-fg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={restoreLoading || !restorePreview}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent text-accent-fg hover:opacity-90 disabled:opacity-40"
              >
                {restoreLoading ? 'Restoring...' : 'Restore Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
