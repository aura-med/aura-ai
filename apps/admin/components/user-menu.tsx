'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronDown, LogOut, Moon, Settings, Sun, UserCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/actions'

const LEVEL_COLORS: Record<string, string> = {
  owner:   'var(--aura-green)',
  admin:   'var(--aura-blue)',
  support: 'var(--aura-warn)',
  analyst: 'var(--aura-text3)',
}

const LOCALES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'pt', label: 'PT', name: 'Português' },
  { code: 'es', label: 'ES', name: 'Español' },
]

interface UserMenuProps {
  email?: string
  fullName?: string | null
  level: string
  currentLocale: string
}

export function UserMenu({ email, fullName, level, currentLocale }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [, startTransition] = useTransition()

  useEffect(() => {
    const stored = localStorage.getItem('aura-theme')
    setTheme(stored === 'light' ? 'light' : 'dark')
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(next)
    localStorage.setItem('aura-theme', next)
    setTheme(next)
  }

  function setLocale(locale: string) {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`
    startTransition(() => router.refresh())
  }

  const displayName = fullName ?? email ?? 'Aura admin'
  const levelColor = LEVEL_COLORS[level] ?? 'var(--aura-text3)'

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/5"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <UserCircle size={16} style={{ color: 'var(--aura-text3)' }} />
        <span
          className="hidden max-w-32 truncate text-xs font-medium sm:block"
          style={{ color: 'var(--aura-text)' }}
        >
          {displayName}
        </span>
        <ChevronDown size={12} style={{ color: 'var(--aura-text3)' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-60 rounded-xl border shadow-lg"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border2)' }}
        >
          {/* User info header */}
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--aura-border)' }}>
            <div className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>
              {displayName}
            </div>
            {fullName && (
              <div className="text-xs" style={{ color: 'var(--aura-text3)' }}>
                {email}
              </div>
            )}
            <span
              className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
              style={{
                background: `color-mix(in srgb, ${levelColor} 12%, transparent)`,
                color: levelColor,
                fontFamily: 'var(--font-dm-mono)',
              }}
            >
              {level}
            </span>
          </div>

          {/* Preferences section */}
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--aura-border)' }}>
            <p
              className="mb-2 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}
            >
              Preferences
            </p>
            {/* Language */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--aura-text2)' }}>
                Language
              </span>
              <div className="flex gap-1" role="group" aria-label="Choose language">
                {LOCALES.map(({ code, label, name }) => (
                  <button
                    key={code}
                    onClick={() => setLocale(code)}
                    type="button"
                    aria-label={name}
                    aria-pressed={currentLocale === code}
                    className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase transition-colors"
                    style={{
                      background: currentLocale === code ? 'var(--aura-green-bg)' : 'var(--aura-bg3)',
                      color: currentLocale === code ? 'var(--aura-green)' : 'var(--aura-text2)',
                      border: `1px solid ${currentLocale === code ? 'rgba(0,229,160,0.3)' : 'var(--aura-border)'}`,
                      fontFamily: 'var(--font-dm-mono)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Theme */}
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--aura-text2)' }}>
                Theme
              </span>
              <button
                onClick={toggleTheme}
                type="button"
                className="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors hover:bg-white/5"
                style={{ color: 'var(--aura-text2)' }}
              >
                {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
                {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
            </div>
          </div>

          {/* Account section */}
          <div className="px-1 py-1">
            <p
              className="mb-1 px-3 pt-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}
            >
              Account
            </p>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: 'var(--aura-text2)' }}
            >
              <Settings size={14} />
              Settings
            </Link>
            <form action={signOut}>
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5"
                style={{ color: 'var(--aura-text2)' }}
                type="submit"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
