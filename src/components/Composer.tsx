import { useEffect, useRef } from 'react'
import { ArrowUp, HelpCircle, Square, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  onShowHelp: () => void
  streaming: boolean
  disabled?: boolean
  characterName?: string
}

const SNIPPETS: { label: string; title: string; left: string; right: string }[] = [
  { label: '( )', title: 'Your thoughts', left: '(', right: ')' },
  { label: '" "', title: 'Your actions', left: '"', right: '"' },
  { label: '(: Name)', title: "Another's thoughts", left: '(', right: ': Name)' },
  { label: '"" : Name', title: "Another's actions", left: '"', right: '": Name' },
  { label: '< >', title: 'God command — rewrite reality', left: '<', right: '>' },
  { label: '[ ]', title: 'World command — change the world', left: '[', right: ']' },
]

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  onShowHelp,
  streaming,
  disabled,
  characterName,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  const insert = (left: string, right: string) => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = value.slice(0, start) + left + value.slice(start, end) + right + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const caret = start + left.length
      el.setSelectionRange(caret, caret)
    })
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="hairline-top material-composer pad-bottom px-3 pt-2.5 pb-3 sm:px-5 sm:pb-4 transition-colors">
      <div className="mx-auto max-w-3xl">
        {/* Command Quick Chips */}
        <div className="scrollbar-none mb-2 -mx-3 flex items-center gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
          {SNIPPETS.map((s) => (
            <button
              key={s.label}
              onClick={() => insert(s.left, s.right)}
              title={s.title}
              className="chip shrink-0 font-mono text-2xs py-1"
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={onShowHelp}
            title="Command reference"
            className="chip ml-auto shrink-0 gap-1 text-2xs py-1"
          >
            <HelpCircle size={12} /> Commands
          </button>
        </div>

        {/* Input & Send control */}
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 items-end rounded-2xl border border-border bg-surface px-3.5 py-1 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
            <textarea
              ref={ref}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              enterKeyHint="send"
              autoCapitalize="sentences"
              autoCorrect="on"
              placeholder={
                characterName
                  ? `Message ${characterName}… (thoughts) "actions" <god> [world]`
                  : 'Write a message…'
              }
              className="scroll-thin max-h-52 flex-1 resize-none bg-transparent py-2 text-sm leading-relaxed text-fg outline-none placeholder:text-faint"
            />
          </div>
          {streaming ? (
            <button
              onClick={onStop}
              className="btn btn-accent size-10 shrink-0 rounded-xl p-0 shadow-md transition active:scale-95"
              title="Stop generating"
              aria-label="Stop generation"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={disabled || !value.trim()}
              className={cn(
                'btn size-10 shrink-0 rounded-xl p-0 transition active:scale-95',
                value.trim()
                  ? 'btn-accent shadow-md'
                  : 'bg-surface-2 text-faint border-border opacity-50 cursor-not-allowed',
              )}
              title="Send"
              aria-label="Send message"
            >
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="mt-1.5 flex items-center justify-between px-1.5 text-2xs text-faint">
          <span className="flex items-center gap-1">
            <Zap size={11} className="text-accent" />
            <span>Enter to send</span>
            <span className="hidden sm:inline">· Shift+Enter for new line</span>
          </span>
          <span className="hidden sm:inline font-mono text-2xs">
            (thoughts) "actions" &lt;god&gt; [world]
          </span>
        </div>
      </div>
    </div>
  )
}
