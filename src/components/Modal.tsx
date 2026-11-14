import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: ReactNode
  bodyClassName?: string
}

const SIZES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-4xl',
}

export function Modal({
  open,
  onClose,
  children,
  title,
  subtitle,
  icon,
  size = 'md',
  footer,
  bodyClassName,
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, transform: 'scale(0.96) translateY(24px)' }}
            animate={{ opacity: 1, transform: 'scale(1) translateY(0px)' }}
            exit={{ opacity: 0, transform: 'scale(0.97) translateY(18px)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            className={cn(
              'modal-glass relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:my-auto sm:max-h-[88dvh] sm:rounded-2xl border border-border/80',
              SIZES[size],
            )}
          >
            {/* Mobile drag handle */}
            <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
              <span className="h-1.5 w-10 rounded-full bg-border-strong" />
            </div>

            {(title || icon) && (
              <div className="flex items-start gap-3 border-b border-border px-5 py-3.5 sm:px-6">
                {icon && (
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-grad text-accent-fg shadow-md">
                    {icon}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {title && (
                    <h2 className="font-display text-base font-semibold tracking-tight text-fg">
                      {title}
                    </h2>
                  )}
                  {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="btn btn-ghost -mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg p-0 text-faint hover:text-fg"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div
              className={cn(
                'scroll-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6',
                bodyClassName,
              )}
            >
              {children}
            </div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-border/80 material px-5 py-3 sm:px-6">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
