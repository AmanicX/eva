import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
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
  hideCloseButton?: boolean
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
  hideCloseButton = false,
}: ModalProps) {
  const dragControls = useDragControls()
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 640
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 639px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
        <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden sm:items-center sm:p-6">
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
            drag={isMobile ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 60 || info.velocity.y > 200) {
                onClose()
              }
            }}
            initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
            transition={
              isMobile
                ? { type: 'spring', damping: 30, stiffness: 320 }
                : { type: 'spring', stiffness: 400, damping: 36 }
            }
            className={cn(
              'modal-glass relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:my-auto sm:max-h-[88dvh] sm:rounded-2xl border border-border/80',
              SIZES[size],
            )}
          >
            {/* Mobile drag handle / tap to go back */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              onClick={onClose}
              className="group flex flex-col items-center justify-center pt-3 pb-2 px-6 cursor-pointer sm:hidden select-none touch-none active:opacity-70 transition-opacity"
              role="button"
              aria-label="Tap or drag down to dismiss"
              title="Tap or drag down to dismiss"
            >
              <span className="h-1.5 w-12 rounded-full bg-border-strong group-hover:bg-fg/50 group-active:bg-accent transition-colors" />
            </div>

            {(title || icon) && (
              <div
                onPointerDown={(e) => {
                  const target = e.target as HTMLElement
                  if (!target.closest('button, a, input, select')) {
                    dragControls.start(e)
                  }
                }}
                onClick={(e) => {
                  const target = e.target as HTMLElement
                  if (!target.closest('button, a, input, select') && window.innerWidth < 640) {
                    onClose()
                  }
                }}
                className="flex items-start gap-3 border-b border-border px-5 py-3 sm:px-6 cursor-pointer sm:cursor-auto select-none sm:select-auto touch-none sm:touch-auto"
              >
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
                {!hideCloseButton && (
                  <button
                    onClick={onClose}
                    className="btn btn-ghost -mr-1.5 -mt-1 hidden sm:grid size-8 shrink-0 place-items-center rounded-lg p-0 text-faint hover:text-fg"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                )}
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
