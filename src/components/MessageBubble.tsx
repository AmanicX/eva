import { useState } from 'react'
import { Check, Copy, RotateCcw, Trash2 } from 'lucide-react'
import type { Character, Message } from '@/types'
import { useStore } from '@/store/useStore'
import { Avatar } from './Avatar'
import { MarkdownText, RawText } from './RichText'
import { cn, copyText, formatTime } from '@/lib/utils'

interface Props {
  message: Message
  character?: Character
  onDelete?: () => void
  onRegenerate?: () => void
  canRegenerate?: boolean
  streaming?: boolean
}

export function MessageBubble({
  message,
  character,
  onDelete,
  onRegenerate,
  canRegenerate,
  streaming,
}: Props) {
  const [copied, setCopied] = useState(false)
  const bubbleStyle = useStore((s) => s.settings.bubbleStyle)
  const isUser = message.role === 'user'
  const isEmptyStreaming = streaming && !message.content

  const handleCopy = async () => {
    await copyText(isUser ? message.raw ?? message.content : message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  if (isUser) {
    return (
      <div className="group anim-rise flex flex-col items-end gap-1">
        <div className="bubble-user max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] sm:max-w-[75%] shadow-sm">
          <RawText text={message.raw ?? message.content} />
        </div>
        <div className="flex items-center gap-1.5 pr-1 opacity-100 transition pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
          <span className="px-1 text-2xs text-faint tabular-nums">
            {formatTime(message.timestamp)}
          </span>
          <button
            onClick={handleCopy}
            className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-fg"
            aria-label="Copy message"
            title="Copy message"
          >
            {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-danger"
              aria-label="Delete message"
              title="Delete message"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    )
  }

  // Assistant Message (Bubble vs Document style)
  const isDocument = bubbleStyle === 'document'

  return (
    <div className="group anim-rise flex items-start gap-3">
      <Avatar
        name={character?.name ?? 'AI'}
        avatar={character?.avatar}
        color={character?.avatarColor}
        size={34}
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 pl-0.5">
          <span className="text-xs font-semibold text-fg">
            {character?.name ?? 'Assistant'}
          </span>
          {character?.source && (
            <span className="rounded bg-surface-2 px-1.5 py-0.2 text-2xs text-faint border border-border">
              {character.source}
            </span>
          )}
        </div>

        <div
          className={cn(
            'inline-block max-w-[95%] text-sm leading-relaxed [overflow-wrap:anywhere]',
            isDocument
              ? 'px-1 py-1 text-fg'
              : 'bubble-bot rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm',
            message.error && 'border border-danger/40 bg-danger/10 text-fg',
          )}
        >
          {isEmptyStreaming ? (
            <span className="caret text-muted text-xs">generating response</span>
          ) : (
            <MarkdownText text={message.content} className={streaming ? 'caret' : undefined} />
          )}
        </div>

        <div className="mt-1 flex items-center gap-1.5 pl-0.5 opacity-100 transition pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
          <span className="px-1 text-2xs text-faint tabular-nums">
            {formatTime(message.timestamp)}
          </span>
          <button
            onClick={handleCopy}
            className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-fg"
            aria-label="Copy message"
            title="Copy message"
          >
            {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
          </button>
          {canRegenerate && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-fg"
              aria-label="Regenerate reply"
              title="Regenerate reply"
            >
              <RotateCcw size={13} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-danger"
              aria-label="Delete message"
              title="Delete message"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
