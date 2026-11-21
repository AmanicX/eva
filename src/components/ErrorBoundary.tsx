import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { eraseEverything } from '@/lib/reset'
import { useStore, DEFAULT_SETTINGS } from '@/store/useStore'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('Eva Uncaught Application Error:', error, errorInfo)
  }

  handleResetSettings = () => {
    try {
      useStore.getState().updateSettings({
        ...DEFAULT_SETTINGS,
      })
      this.setState({ hasError: false, error: null, errorInfo: null })
      window.location.reload()
    } catch {
      window.location.reload()
    }
  }

  handleEraseAndRestart = async () => {
    const confirm = window.confirm(
      'Are you sure you want to reset all application data? This will clear all local conversations and preferences.',
    )
    if (confirm) {
      await eraseEverything()
      window.location.reload()
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#0a0a0f] text-neutral-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#14141e] border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-amber-500/10 border border-amber-500/20 grid place-items-center text-amber-500">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h1 className="font-semibold text-lg text-neutral-100">Something went wrong</h1>
                <p className="text-xs text-neutral-400">Eva encountered an unexpected error.</p>
              </div>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-black/40 border border-neutral-800/80 rounded-xl font-mono text-2xs text-rose-300 break-words max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="text-xs text-neutral-400 leading-relaxed">
              This usually happens if an imported backup or saved state contained invalid parameters.
              You can restore safe defaults below without losing your conversations.
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={this.handleResetSettings}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-accent text-white font-medium text-xs hover:opacity-90 transition shadow-sm"
              >
                <RotateCcw size={15} />
                Reset Settings to Safe Defaults
              </button>

              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs transition"
              >
                <RefreshCw size={14} />
                Try Reloading
              </button>

              <button
                onClick={this.handleEraseAndRestart}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-rose-400 hover:bg-rose-500/10 font-medium text-xs transition"
              >
                <Trash2 size={14} />
                Clear Corrupted Data & Restart
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
