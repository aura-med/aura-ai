'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ChevronDown, Languages, LogOut, Moon, Settings, Sun, UserCircle } from 'lucide-react'
import { signOut } from '@/lib/actions'

const LEVEL_COLORS: Record<string, string> = {
  owner:   'var(--aura-green)',
  admin:   'var(--aura-blue)',
  support: 'var(--aura-warn)',
  analyst: 'var(--aura-text3)',
}

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
  { code: 'es', label: 'ES' },
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
  const [, startTransition] = useTransition()
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

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

  const displayName = fullName ?? email ?? 'Aura admin'

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    const html = document.documentElement
    html.classList.remove('dark', 'light')
    html.classList.add(next)
    localStorage.setItem('aura-theme', next)
    setTheme(next)
  }

  function setLocale(locale: string) {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`
    startTransition(() => router.refresh())
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-md px-2 transition-colors hover:bg-[var(--aura-bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aura-green)]"
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-label="Open user menu"
        aria-expanded={open}
      >
        <UserCircle size={18} style={{ color: 'var(--aura-text3)' }} />
        <div className="hidden text-left sm:block">
          <div className="text-xs font-medium" style={{ color: 'var(--aura-text)' }}>
            {displayName}
          </div>
          <div className="text-[10px] uppercase" style={{ color: LEVEL_COLORS[level] ?? 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
            {level}
          </div>
        </div>
        <ChevronDown size={12} style={{ color: 'var(--aura-text3)' }} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border p-1 shadow-lg" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border2)' }}>
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--aura-border)' }}>
            <div className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>
              {displayName}
            </div>
            {fullName && (
              <div className="text-xs" style={{ color: 'var(--aura-text3)' }}>
                {email}
              </div>
            )}
            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: `color-mix(in srgb, ${LEVEL_COLORS[level] ?? 'var(--aura-text3)'} 12%, transparent)`, color: LEVEL_COLORS[level] ?? 'var(--aura-text3)' }}>
              {level}
            </span>
          </div>

          <div className="p-1">
            <Link href="/settings" onClick={() => setOpen(false)} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-[var(--aura-bg3)]" style={{ color: 'var(--aura-text2)' }}>
              <Settings size={14} />
              Settings
            </Link>
          </div>

          <div className="border-t px-3 py-3" style={{ borderColor: 'var(--aura-border)' }}>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
              <Languages size={12} />
              Language
            </div>
            <div className="grid grid-cols-3 gap-1">
              {LOCALES.map(({ code, label }) => (
                <button key={code} className="rounded-md px-2 py-2 text-xs font-semibold" onClick={() => setLocale(code)} style={currentLocale === code ? { background: 'var(--aura-green-bg)', color: 'var(--aura-green)' } : { background: 'var(--aura-bg3)', color: 'var(--aura-text3)' }} type="button">
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t p-1" style={{ borderColor: 'var(--aura-border)' }}>
            <button className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm hover:bg-[var(--aura-bg3)]" onClick={toggleTheme} style={{ color: 'var(--aura-text2)' }} type="button">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </button>
            <form action={signOut}>
              <button className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm hover:bg-[var(--aura-bg3)]" style={{ color: 'var(--aura-danger)' }} type="submit">
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
