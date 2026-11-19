import { Monitor, Moon, Sun } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { getTheme, nextTheme, setTheme, subscribeTheme, type Theme } from '@/lib/theme'

const labels: Record<Theme, string> = { system: 'System', light: 'Hell', dark: 'Dunkel' }
const icons = { system: Monitor, light: Sun, dark: Moon } as const

/**
 * Cycles System → Hell → Dunkel. Server and first client render use "system" (getServerSnapshot),
 * the stored value is applied right after hydration – no hydration mismatch on the prerendered pages.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, (): Theme => 'system')
  const Icon = icons[theme]
  const next = nextTheme(theme)
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Darstellung: ${labels[theme]}. Wechseln zu ${labels[next]}.`}
      title={`Darstellung: ${labels[theme]}`}
      onClick={() => setTheme(next)}
    >
      <Icon aria-hidden="true" className="size-5" />
    </Button>
  )
}
