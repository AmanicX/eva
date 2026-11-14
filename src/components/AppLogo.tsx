import iconDark from '@/assets/icon-dark.png'
import iconLight from '@/assets/icon-light.png'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

interface AppLogoProps {
  className?: string
  alt?: string
}

export function AppLogo({ className, alt = 'Nexus' }: AppLogoProps) {
  const appearanceMode = useStore((s) => s.settings.appearanceMode)
  const isLight = appearanceMode === 'light'
  return (
    <img
      src={isLight ? iconLight : iconDark}
      alt={alt}
      className={cn('rounded-xl object-cover shrink-0', className)}
    />
  )
}
