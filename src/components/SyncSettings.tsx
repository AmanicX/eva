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

function CompactSwitch({
  checked,
  onChange,
  label,
  id,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  id?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      id={id}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex shrink-0 items-center justify-center p-0.5 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="switch" data-on={checked}>
        <span />
      </span>
    </button>
  )
}

function GoogleIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  )
}

function GitHubIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  )
}

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
      <div className="p-4 sm:p-5 rounded-xl border border-border bg-surface-2 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
              <Shield size={16} />
            </div>
            <h3 className="text-sm font-semibold text-fg">End-to-End Encrypted Cloud Sync</h3>
          </div>
          <span className="self-start sm:self-auto text-[10px] px-2.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-mono font-medium shrink-0">
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
        <div className="p-3.5 sm:p-4 rounded-xl border border-border bg-surface-2 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              {storageInfo.isHardwareEncrypted ? (
                <HardDrive className="size-4 text-emerald-500 shrink-0" />
              ) : (
                <Smartphone className="size-4 text-amber-500 shrink-0" />
              )}
              <span className="text-xs font-semibold text-fg">Local Credential Security</span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                  storageInfo.isHardwareEncrypted
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
                }`}
              >
                {storageInfo.platform}
              </span>
            </div>

            {!storageInfo.isHardwareEncrypted && (
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-muted hover:text-fg transition self-start sm:self-auto">
                <input
                  type="checkbox"
                  checked={webConsent}
                  onChange={(e) => handleWebConsentToggle(e.target.checked)}
                  className="size-3.5 rounded border-border bg-surface text-accent focus:ring-1 focus:ring-accent accent-accent cursor-pointer"
                />
                <span className="text-[11px]">Allow browser persistence</span>
              </label>
            )}
          </div>

          <p className="text-[11px] text-faint leading-relaxed sm:pl-6">
            {storageInfo.description}
          </p>
        </div>
      )}

      {/* Conflict Alert Banner */}
      {config.conflicts && config.conflicts.length > 0 && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle size={15} />
            <span>{config.conflicts.length} Concurrent Conflict(s) Preserved</span>
          </div>
          <p className="text-muted text-[11px] leading-relaxed">
            Another device modified the same character fields concurrently. To prevent data loss, Eva preserved both versions: your local version remains active, and the remote version has been saved as a branched copy.
          </p>
        </div>
      )}

      {/* Sync Status Feedback */}
      {config.syncStatus === 'syncing' && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-xs text-accent">
          <RefreshCw className="animate-spin shrink-0" size={14} />
          <span>{config.lastSyncMessage || 'Synchronizing with cloud...'}</span>
        </div>
      )}

      {actionFeedback && (
        <div
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300'
              : actionFeedback.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-300'
              : 'bg-accent/10 border-accent/20 text-accent'
          }`}
        >
          {actionFeedback.type === 'success' ? <CheckCircle2 className="shrink-0" size={14} /> : <AlertCircle className="shrink-0" size={14} />}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* Cloud Accounts Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-faint">Cloud Providers</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          {/* Google Drive Card */}
          <div
            className={`flex flex-col justify-between p-4 sm:p-5 rounded-xl border transition-all ${
              config.googleAccount.connected
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-border bg-surface-2'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="size-9 rounded-lg bg-surface-3 border border-border/60 flex items-center justify-center shrink-0">
                  <GoogleIcon className="size-5 shrink-0" />
                </div>
                {config.googleAccount.connected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
                    <CheckCircle2 size={11} /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-surface-3 text-muted border border-border/50 shrink-0">
                    Not Connected
                  </span>
                )}
              </div>

              <div>
                <h5 className="text-sm font-semibold text-fg tracking-tight">Google Drive</h5>
                <p className="text-2xs text-muted mt-0.5">Private appDataFolder</p>
              </div>

              {/* Card middle description/account info - fixed minimum height for perfect symmetry */}
              <div className="my-3 py-2.5 px-3 rounded-lg bg-surface/50 border border-border/60 min-h-[4.5rem] flex flex-col justify-center">
                {config.googleAccount.connected ? (
                  <div className="text-xs text-muted space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xs font-medium text-faint">Account</span>
                      <span className="font-mono text-2xs text-fg truncate max-w-[150px]">
                        {config.googleAccount.accountIdentity || 'Google User'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xs font-medium text-faint">Last Sync</span>
                      <span className="text-2xs text-fg">{formatTimestamp(config.googleAccount.lastSyncTimestamp)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-2xs text-muted leading-relaxed">
                    Zero-knowledge encrypted backups stored in your personal Google Drive hidden app folder, invisible to third parties.
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Actions - identical h-9 height */}
            <div className="pt-1 mt-auto">
              {config.googleAccount.connected ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => syncEngine.setActiveProvider('google')}
                    className={`flex-1 h-9 px-3 rounded-lg text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                      config.activeProvider === 'google'
                        ? 'bg-accent border-accent text-accent-fg shadow-sm'
                        : 'bg-surface-3 border-border text-muted hover:text-fg hover:bg-surface'
                    }`}
                  >
                    {config.activeProvider === 'google' ? 'Active Target' : 'Use Google'}
                  </button>
                  <button
                    type="button"
                    onClick={() => syncEngine.disconnectGoogle()}
                    className="h-9 px-3 rounded-lg text-xs font-medium border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(true)}
                  className="w-full h-9 px-3 rounded-lg text-xs font-medium border border-border bg-surface-3 text-fg hover:bg-surface transition-colors flex items-center justify-center gap-2"
                >
                  Connect Google
                </button>
              )}
            </div>
          </div>

          {/* GitHub Cloud Card */}
          <div
            className={`flex flex-col justify-between p-4 sm:p-5 rounded-xl border transition-all ${
              config.githubAccount.connected
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-border bg-surface-2'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="size-9 rounded-lg bg-surface-3 border border-border/60 flex items-center justify-center shrink-0">
                  <GitHubIcon className="size-5 shrink-0" />
                </div>
                {config.githubAccount.connected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
                    <CheckCircle2 size={11} /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-surface-3 text-muted border border-border/50 shrink-0">
                    Not Connected
                  </span>
                )}
              </div>

              <div>
                <h5 className="text-sm font-semibold text-fg tracking-tight">GitHub Cloud</h5>
                <p className="text-2xs text-muted mt-0.5">
                  {config.githubAccount.gitHubStorageType === 'gist'
                    ? 'Secret Gist (Unlisted)'
                    : 'Private Repository (Access-Controlled)'}
                </p>
              </div>

              {/* Card middle description/account info - fixed minimum height for perfect symmetry */}
              <div className="my-3 py-2.5 px-3 rounded-lg bg-surface/50 border border-border/60 min-h-[4.5rem] flex flex-col justify-center">
                {config.githubAccount.connected ? (
                  <div className="text-xs text-muted space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xs font-medium text-faint">Account</span>
                      <span className="font-mono text-2xs text-fg truncate max-w-[150px]">
                        @{config.githubAccount.accountIdentity || 'GitHub User'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xs font-medium text-faint">Last Sync</span>
                      <span className="text-2xs text-fg">{formatTimestamp(config.githubAccount.lastSyncTimestamp)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-2xs text-muted leading-relaxed">
                    Zero-knowledge encrypted backups saved to your private GitHub repository or secret gist with full revision history.
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Actions - identical h-9 height */}
            <div className="pt-1 mt-auto">
              {config.githubAccount.connected ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => syncEngine.setActiveProvider('github')}
                    className={`flex-1 h-9 px-3 rounded-lg text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                      config.activeProvider === 'github'
                        ? 'bg-accent border-accent text-accent-fg shadow-sm'
                        : 'bg-surface-3 border-border text-muted hover:text-fg hover:bg-surface'
                    }`}
                  >
                    {config.activeProvider === 'github' ? 'Active Target' : 'Use GitHub'}
                  </button>
                  <button
                    type="button"
                    onClick={() => syncEngine.disconnectGitHub()}
                    className="h-9 px-3 rounded-lg text-xs font-medium border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowGitHubModal(true)}
                  className="w-full h-9 px-3 rounded-lg text-xs font-medium border border-border bg-surface-3 text-fg hover:bg-surface transition-colors flex items-center justify-center gap-2"
                >
                  Connect GitHub
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Sync and Encryption Controls */}
      <div className="rounded-xl border border-border bg-surface-2 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-fg">Enable automatic sync</h4>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Debounced background synchronization when characters or conversations change.
            </p>
          </div>
          <div className="shrink-0 flex items-center">
            <CompactSwitch
              checked={config.autoSyncEnabled}
              disabled={!isConnected}
              onChange={(checked) => syncEngine.setAutoSync(checked)}
              label="Enable automatic sync"
            />
          </div>
        </div>

        <div className="pt-3.5 border-t border-border/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
              config.hasPassphrase ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
            }`}>
              <Lock size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-fg">
                {config.hasPassphrase ? 'Passphrase Protected' : 'No Passphrase Configured'}
              </p>
              <p className="text-2xs text-muted leading-relaxed">
                {config.hasPassphrase
                  ? 'Client-side AES-256 key is derived and secured on this device.'
                  : 'A passphrase is required before syncing data to the cloud.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPassphraseModal(true)}
            className="h-8 px-3 rounded-lg text-xs font-medium border border-border bg-surface-3 hover:bg-surface text-fg transition-colors flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto"
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
          className="h-10 px-3 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 text-fg text-xs font-medium transition flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <RefreshCw size={14} className={config.syncStatus === 'syncing' ? 'animate-spin' : ''} />
          Sync now
        </button>

        <button
          onClick={handleBackupNow}
          disabled={!isConnected || config.syncStatus === 'syncing'}
          className="h-10 px-3 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 text-fg text-xs font-medium transition flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Upload size={14} />
          Back up now
        </button>

        <button
          onClick={handleOpenRestoreModal}
          disabled={!isConnected || config.syncStatus === 'syncing'}
          className="h-10 px-3 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 text-fg text-xs font-medium transition flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Download size={14} />
          Restore from cloud
        </button>
      </div>

      {/* GitHub Authorization Modal */}
      {showGitHubModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
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
