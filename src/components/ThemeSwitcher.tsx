import { MessageSquare, Sparkles, Globe2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useStore } from '@/store/useStore'
import { THEMES, THEME_ORDER } from '@/data/themes'
import { springSnappy } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { ThemeId } from '@/types'

const THEME_ICONS: Record<ThemeId, React.ReactNode> = {
  chatbot: <MessageSquare size={13} />,
  anime: <Sparkles size={13} />,
  world: <Globe2 size={13} />,
}

export function ThemeSwitcher() {
  const theme = useStore((s) => s.settings.theme)
  const setTheme = useStore((s) => s.setTheme)

  return (
    <div
      role="tablist"
      aria-label="Application Mode"
      className="seg relative grid w-full grid-cols-3 select-none"
    >
      {THEME_ORDER.map((id) => {
        const t = THEMES[id]
        const active = id === theme
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => setTheme(id)}
            className={cn(
              'relative z-10 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium transition-colors !bg-transparent !shadow-none',
              active ? 'text-fg font-semibold' : 'text-muted hover:text-fg',
            )}
          >
            {active && (
              <motion.div
                layoutId="activeThemePill"
                className="absolute inset-0 -z-10 rounded-[calc(var(--radius-lg)-3px)] bg-surface shadow-xs border border-border/60 pointer-events-none"
                transition={springSnappy}
              />
            )}
            <span
              className={cn(
                'transition-colors duration-150',
                active ? 'text-accent scale-105' : 'text-faint',
              )}
            >
              {THEME_ICONS[id]}
            </span>
            <span className="truncate">{t.name}</span>
          </button>
        )
      })}
    </div>
  )
}
