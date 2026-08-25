'use client'

import { Moon, Sun } from 'lucide-react'
import { useTransition } from 'react'
import { saveThemePreference } from '@/lib/actions/preferences'
import { useUiStore } from '@/stores/uiStore'

export function ThemeToggle() {
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const [isPending, startTransition] = useTransition()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  function handleToggle() {
    setTheme(nextTheme)

    startTransition(async () => {
      const result = await saveThemePreference(nextTheme)
      if (!result.success) {
        console.warn(`Theme preference was not saved: ${result.error}`)
      }
    })
  }

  return (
    <button
      aria-label="Toggle theme"
      aria-pressed={theme === 'light'}
      className="flex size-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--sophi-green)]"
      disabled={isPending}
      onClick={handleToggle}
      style={{ color: 'var(--sophi-text2)' }}
      title={nextTheme === 'light' ? 'Light mode' : 'Dark mode'}
      type="button"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
