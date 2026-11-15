import { MessageSquare, Sparkles, Globe2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { THEMES, THEME_ORDER } from '@/data/themes'
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
      className="seg grid w-full grid-cols-3 select-none"
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
            className="flex items-center justify-center gap-1.5 transition-all duration-200"
          >
            <span
              className={`transition-colors duration-200 ${
                active ? 'text-accent scale-105' : 'text-faint'
              }`}
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
