/**
 * Cloud Backup & Sync Settings Component for Eva
 *
 * Implements:
 * - Google Drive appDataFolder and GitHub Private Gist account linking
 * - Client-side AES-256-GCM zero-knowledge encryption passphrase and recovery key management
 * - Automatic debounced cross-device synchronization toggle
 * - Manual Backup Now, Sync Now, and Restore from Cloud actions
 * - Restore preview with 3-way merge or clean replacement
 */

import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { syncEngine } from '@/lib/sync/syncEngine'
import { generateRecoveryKey } from '@/lib/sync/syncCrypto'
import type { RestorePreview, SyncConfig } from '@/lib/sync/syncTypes'

export function SyncSettings() {
  const [config, setConfig] = useState<SyncConfig>(syncEngine.getConfig())
  const [passphraseInput, setPassphraseInput] = useState('')
  const [showPassphraseModal, setShowPassphraseModal] = useState(false)
  const [generatedKey, setGeneratedKey] = useState('')
  const [copiedKey, setCopiedKey] = useState(false)

  // GitHub connection modal state
  const [showGitHubModal, setShowGitHubModal] = useState(false)
  const [gitHubTokenInput, setGitHubTokenInput] = useState('')
  const [gitHubLoading, setGitHubLoading] = useState(false)
  const [gitHubError, setGitHubError] = useState('')

  // Google connection modal state
  const [showGoogleModal, setShowGoogleModal] = useState(false)
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
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((newConfig) => {
      setConfig(newConfig)
    })
    return () => unsubscribe()
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

  const handleConnectGitHub = async () => {
    if (!gitHubTokenInput.trim()) return
    setGitHubLoading(true)
    setGitHubError('')
    try {
      await syncEngine.connectGitHubWithToken(gitHubTokenInput.trim())
      setShowGitHubModal(false)
      setGitHubTokenInput('')
      setActionFeedback({ type: 'success', text: 'GitHub account connected for cloud backup.' })
    } catch (err: any) {
      setGitHubError(err.message || 'Failed to authenticate with GitHub.')
    } finally {
      setGitHubLoading(false)
    }
  }

  const handleConnectGoogle = async () => {
    if (!googleTokenInput.trim()) return
    setGoogleLoading(true)
    setGoogleError('')
    try {
      await syncEngine.connectGoogleWithToken(googleTokenInput.trim())
      setShowGoogleModal(false)
      setGoogleTokenInput('')
      setActionFeedback({ type: 'success', text: 'Google account connected for cloud backup.' })
    } catch (err: any) {
      setGoogleError(err.message || 'Failed to authenticate with Google Drive.')
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
      <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="text-cyan-400" size={18} />
            <h3 className="text-sm font-semibold text-white">End-to-End Encrypted Cloud Sync</h3>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
            AES-256-GCM + PBKDF2
          </span>
        </div>
        <p className="text-xs text-white/60 leading-relaxed">
          Optionally synchronize your characters, conversations, and worlds across devices.
          All application data is encrypted client-side using your personal passphrase before leaving your device.
          Neither Google, GitHub, nor any third party can read your data.
        </p>
      </div>

      {/* Sync Status Feedback */}
      {config.syncStatus === 'syncing' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
          <RefreshCw className="animate-spin" size={14} />
          <span>{config.lastSyncMessage || 'Synchronizing with cloud...'}</span>
        </div>
      )}

      {actionFeedback && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}
        >
          {actionFeedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* Cloud Accounts Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">Cloud Providers</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Google Account Card */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              config.googleAccount.connected
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-sm">
                  G
                </div>
                <div>
                  <h5 className="text-sm font-medium text-white">Google Drive</h5>
                  <p className="text-xs text-white/50">Isolated appDataFolder</p>
                </div>
              </div>
              {config.googleAccount.connected ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium flex items-center gap-1">
                  <CheckCircle2 size={10} /> Connected
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                  Not Connected
                </span>
              )}
            </div>

            {config.googleAccount.connected && (
              <div className="mt-3 pt-3 border-t border-white/5 text-xs text-white/70 space-y-1">
                <div className="flex justify-between">
                  <span className="text-white/40">Account:</span>
                  <span className="font-mono text-white/90 truncate max-w-[150px]">
                    {config.googleAccount.accountIdentity || 'Google User'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Last Sync:</span>
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
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {config.activeProvider === 'google' ? 'Active Target' : 'Use Google'}
                  </button>
                  <button
                    onClick={() => syncEngine.disconnectGoogle()}
                    className="py-1.5 px-3 rounded-lg text-xs font-medium border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowGoogleModal(true)}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-medium border border-white/10 bg-white/10 text-white hover:bg-white/20 transition"
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
                : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-sm">
                  GH
                </div>
                <div>
                  <h5 className="text-sm font-medium text-white">GitHub Gists</h5>
                  <p className="text-xs text-white/50">Private Encrypted Gist</p>
                </div>
              </div>
              {config.githubAccount.connected ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium flex items-center gap-1">
                  <CheckCircle2 size={10} /> Connected
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                  Not Connected
                </span>
              )}
            </div>

            {config.githubAccount.connected && (
              <div className="mt-3 pt-3 border-t border-white/5 text-xs text-white/70 space-y-1">
                <div className="flex justify-between">
                  <span className="text-white/40">Account:</span>
                  <span className="font-mono text-white/90">
                    @{config.githubAccount.accountIdentity || 'GitHub User'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Last Sync:</span>
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
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {config.activeProvider === 'github' ? 'Active Target' : 'Use GitHub'}
                  </button>
                  <button
                    onClick={() => syncEngine.disconnectGitHub()}
                    className="py-1.5 px-3 rounded-lg text-xs font-medium border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowGitHubModal(true)}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-medium border border-white/10 bg-white/10 text-white hover:bg-white/20 transition"
                >
                  Connect GitHub
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Sync and Encryption Controls */}
      <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-white">Enable automatic sync</h4>
            <p className="text-xs text-white/50">
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
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-40"></div>
          </label>
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={15} className={config.hasPassphrase ? 'text-emerald-400' : 'text-amber-400'} />
            <div>
              <p className="text-xs font-medium text-white">
                {config.hasPassphrase ? 'Passphrase Protected' : 'No Passphrase Configured'}
              </p>
              <p className="text-[11px] text-white/50">
                {config.hasPassphrase
                  ? 'Client-side AES-256 key is derived and secured on this device.'
                  : 'A passphrase is required before syncing data to the cloud.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPassphraseModal(true)}
            className="py-1 px-2.5 rounded-lg text-xs border border-white/10 bg-white/5 hover:bg-white/10 text-white transition flex items-center gap-1.5"
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
          className="py-2.5 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <RefreshCw size={14} className={config.syncStatus === 'syncing' ? 'animate-spin' : ''} />
          Sync now
        </button>

        <button
          onClick={handleBackupNow}
          disabled={!isConnected || config.syncStatus === 'syncing'}
          className="py-2.5 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Upload size={14} />
          Back up now
        </button>

        <button
          onClick={handleOpenRestoreModal}
          disabled={!isConnected || config.syncStatus === 'syncing'}
          className="py-2.5 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Download size={14} />
          Restore from cloud
        </button>
      </div>

      {/* GitHub Token Modal */}
      {showGitHubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-neutral-900 border border-white/10 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white">Connect GitHub Cloud Backup</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Eva stores an encrypted backup in a private GitHub Gist on your account. To connect, generate a Personal Access Token with the <code className="bg-white/10 px-1 py-0.5 rounded text-white">gist</code> scope.
            </p>

            <a
              href="https://github.com/settings/tokens/new?scopes=gist&description=Eva+CrossDevice+Sync"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition"
            >
              Generate token on GitHub <ExternalLink size={12} />
            </a>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/70">Personal Access Token (classic or fine-grained)</label>
              <input
                type="password"
                placeholder="ghp_..."
                value={gitHubTokenInput}
                onChange={(e) => setGitHubTokenInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            {gitHubError && <p className="text-xs text-red-400">{gitHubError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowGitHubModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConnectGitHub}
                disabled={gitHubLoading || !gitHubTokenInput.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
              >
                {gitHubLoading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Token Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-neutral-900 border border-white/10 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white">Connect Google Drive</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Eva uses Google Drive’s private <code className="bg-white/10 px-1 py-0.5 rounded text-white">appDataFolder</code>. Your backups are completely hidden from regular Drive views. Provide an authorized OAuth access token to link your account.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/70">Google OAuth Access Token</label>
              <input
                type="password"
                placeholder="ya29...."
                value={googleTokenInput}
                onChange={(e) => setGoogleTokenInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            {googleError && <p className="text-xs text-red-400">{googleError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowGoogleModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConnectGoogle}
                disabled={googleLoading || !googleTokenInput.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
              >
                {googleLoading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passphrase Modal */}
      {showPassphraseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-neutral-900 border border-white/10 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white">Configure Encryption Passphrase</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Your passphrase derives an AES-256-GCM key with 600,000 PBKDF2 iterations.
              You will need this same passphrase on any other device you wish to sync with.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/70">Passphrase (Minimum 8 characters)</label>
              <input
                type="text"
                placeholder="Enter memorable passphrase or recovery key"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/70">Or generate a high-entropy key:</span>
                <button
                  type="button"
                  onClick={handleGenerateKey}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  Generate Key
                </button>
              </div>
              {generatedKey && (
                <div className="flex items-center justify-between gap-2 p-2 rounded bg-black/40 border border-white/10">
                  <span className="font-mono text-xs text-emerald-400 select-all truncate">{generatedKey}</span>
                  <button
                    type="button"
                    onClick={handleCopyGeneratedKey}
                    className="p-1 rounded hover:bg-white/10 text-white/70"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPassphraseModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSetPassphrase}
                disabled={passphraseInput.trim().length < 8}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
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
          <div className="w-full max-w-lg p-6 rounded-2xl bg-neutral-900 border border-white/10 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white">Restore from Cloud Backup</h3>

            {restoreLoading && !restorePreview && (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-white/60 text-xs">
                <RefreshCw className="animate-spin text-blue-400" size={24} />
                <span>Reading remote backup from cloud...</span>
              </div>
            )}

            {restoreError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{restoreError}</span>
              </div>
            )}

            {restorePreview && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/50">Backup Timestamp:</span>
                    <span className="font-medium text-white">{formatTimestamp(restorePreview.timestamp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Originating App Version:</span>
                    <span className="font-mono text-white">{restorePreview.appVersion}</span>
                  </div>
                  <div className="pt-2 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-black/30">
                      <div className="text-sm font-bold text-white">{restorePreview.meta.characterCount}</div>
                      <div className="text-[10px] text-white/40">Characters</div>
                    </div>
                    <div className="p-2 rounded bg-black/30">
                      <div className="text-sm font-bold text-white">{restorePreview.meta.worldCount}</div>
                      <div className="text-[10px] text-white/40">Worlds</div>
                    </div>
                    <div className="p-2 rounded bg-black/30">
                      <div className="text-sm font-bold text-white">{restorePreview.meta.conversationCount}</div>
                      <div className="text-[10px] text-white/40">Conversations</div>
                    </div>
                  </div>
                </div>

                {!config.hasPassphrase && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/70">Enter Decryption Passphrase or Recovery Key</label>
                    <input
                      type="password"
                      placeholder="Enter passphrase"
                      value={restorePassphrase}
                      onChange={(e) => setRestorePassphrase(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/70">Restoration Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRestoreMode('merge')}
                      className={`p-3 rounded-xl border text-left transition ${
                        restoreMode === 'merge'
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-semibold">Merge (Recommended)</div>
                      <div className="text-[10px] text-white/50 mt-1">
                        Combines cloud data with local data without losing local conversations.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRestoreMode('replace')}
                      className={`p-3 rounded-xl border text-left transition ${
                        restoreMode === 'replace'
                          ? 'border-amber-500 bg-amber-500/10 text-white'
                          : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-semibold text-amber-300">Clean Replace</div>
                      <div className="text-[10px] text-white/50 mt-1">
                        Replaces local state entirely with cloud backup. Creates safety backup first.
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={restoreLoading || !restorePreview}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
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
