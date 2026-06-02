'use client'

import { useRouter } from 'next/navigation'
import { Sun, Moon } from 'lucide-react'
import { useUiStore } from '@/stores/uiStore'

const LOCALES = ['pt', 'en', 'es'] as const
type Locale = (typeof LOCALES)[number]

export function AuthControls() {
  const router = useRouter()
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const locale = useUiStore((s) => s.locale)
  const setLocale = useUiStore((s) => s.setLocale)

  function handleLocale(loc: Locale) {
    setLocale(loc)
    router.refresh()
  }

  return (
    <div className="absolute top-4 right-4 flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {LOCALES.map((loc) => (
          <button
            key={loc}
            onClick={() => handleLocale(loc)}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase transition-colors"
            style={{
              background: locale === loc ? 'var(--aura-green)' : 'transparent',
              color: locale === loc ? 'var(--aura-bg)' : 'var(--aura-text3)',
              border: `1px solid ${locale === loc ? 'var(--aura-green)' : 'var(--aura-border2)'}`,
            }}
          >
            {loc}
          </button>
        ))}
      </div>

      <button
        onClick={toggleTheme}
        className="p-1 rounded transition-colors"
        style={{ color: 'var(--aura-text3)', border: '1px solid var(--aura-border2)' }}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
      </button>
    </div>
  )
}
