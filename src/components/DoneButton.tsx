import { useEffect, useRef, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import {
  computeDoneState,
  computeSuccessAction,
  type DoneState,
  type DoneSuccessAction,
} from '@/lib/doneStateMachine'
import { validateKeyFormat } from '@/lib/keyValidation'
import { cn } from '@/lib/utils'

interface DoneButtonProps {
  providerId: string
  currentKey: string
  savedKey: string
  currentExtra?: string
  savedExtra?: string
  onSave: (key: string, extra?: string) => Promise<void> | void
  className?: string
}

export function DoneButton({
  providerId,
  currentKey,
  savedKey,
  currentExtra,
  savedExtra,
  onSave,
  className,
}: DoneButtonProps) {
  const [status, setStatus] = useState<DoneState>('IDLE_DISABLED')
  const [successAction, setSuccessAction] = useState<DoneSuccessAction>('inserted')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Re-evaluate state when inputs change
  useEffect(() => {
    setStatus((prev) => {
      const next = computeDoneState(
        {
          currentKey,
          savedKey,
          currentExtra,
          savedExtra,
        },
        prev,
      )
      // If user altered input while in SUCCESS or error was showing, reset error
      if (next !== 'SUCCESS' && errorMsg) {
        setErrorMsg(null)
      }
      return next
    })
  }, [currentKey, savedKey, currentExtra, savedExtra])

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleClick = async () => {
    setErrorMsg(null)

    const cleanKey = currentKey.trim()
    const isClearing = !cleanKey && !!savedKey.trim()

    // 1. If not clearing, validate format
    if (!isClearing) {
      const validation = validateKeyFormat(providerId, cleanKey, {
        accountId: currentExtra?.trim(),
      })
      if (!validation.valid) {
        setErrorMsg(validation.error || 'Invalid key format.')
        return
      }
    }

    // 2. Perform save
    const action = computeSuccessAction(cleanKey, savedKey)
    setSuccessAction(action)
    await onSave(cleanKey, currentExtra?.trim())

    // 3. Transition to SUCCESS
    setStatus('SUCCESS')

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setStatus('IDLE_DISABLED')
    }, 2000)
  }

  const isSuccess = status === 'SUCCESS'
  const isEnabled = status === 'IDLE_ENABLED'

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={!isEnabled && !isSuccess}
        className={cn(
          'btn shrink-0 min-w-[5.25rem] transition-all duration-200 select-none font-medium',
          isSuccess &&
            'bg-success/15 border-success/40 text-success pointer-events-none scale-[1.02] motion-reduce:scale-100',
          !isEnabled && !isSuccess && 'opacity-40 cursor-not-allowed bg-surface-2 border-border/60 text-muted',
          isEnabled && 'btn-primary text-accent-fg shadow-xs hover:shadow-sm',
          className,
        )}
        aria-label={
          isSuccess
            ? successAction === 'inserted'
              ? 'Key Inserted'
              : 'Key Removed'
            : 'Done'
        }
      >
        {isSuccess ? (
          <span className="inline-flex items-center gap-1.5 transition-opacity duration-150">
            {successAction === 'inserted' ? (
              <>
                <Check size={13} className="stroke-[2.5]" />
                <span>Inserted</span>
              </>
            ) : (
              <>
                <Trash2 size={13} className="stroke-[2.5]" />
                <span>Removed</span>
              </>
            )}
          </span>
        ) : (
          <span>Done</span>
        )}
      </button>

      {errorMsg && (
        <span
          className="text-3xs text-danger flex items-center gap-1 mt-0.5"
          role="alert"
        >
          {errorMsg}
        </span>
      )}
    </div>
  )
}
