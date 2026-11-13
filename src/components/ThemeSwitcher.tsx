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
    <div className="seg grid w-full grid-cols-3">
      {THEME_ORDER.map((id) => {
        const t = THEMES[id]
        const active = id === theme
        return (
          <button
            key={id}
            data-active={active}
            onClick={() => setTheme(id)}
            className="flex items-center justify-center gap-1.5"
          >
            <span className={active ? 'text-accent' : 'text-faint'}>
              {THEME_ICONS[id]}
            </span>
            <span>{t.name}</span>
          </button>
        )
      })}
    </div>
  )
}
