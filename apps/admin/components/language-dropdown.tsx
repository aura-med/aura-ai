'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
  { code: 'es', label: 'ES' },
]

interface LanguageDropdownProps {
  currentLocale: string
}

export function LanguageDropdown({ currentLocale }: LanguageDropdownProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function setLocale(locale: string) {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex gap-0.5 rounded-lg border p-0.5" style={{ borderColor: 'var(--sophi-border)' }}>
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          className="min-h-7 rounded-md px-2 text-[11px] font-semibold"
          onClick={() => setLocale(code)}
          style={
            currentLocale === code
              ? { background: 'var(--sophi-green-bg)', color: 'var(--sophi-green)' }
              : { color: 'var(--sophi-text3)' }
          }
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  )
}
