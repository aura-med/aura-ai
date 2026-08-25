'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronDown, LogOut, Moon, Settings, Sun, UserCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { saveThemePreference } from '@/lib/actions/preferences'
import { useUiStore } from '@/stores/uiStore'
import { createClient } from '@/lib/supabase/client'

interface UserMenuDropdownProps {
  user: { email: string; fullName: string | null } | null
  role?: string | null
}

const LOCALES = [
  { value: 'pt' as const, label: 'PT', name: 'Português' },
  { value: 'en' as const, label: 'EN', name: 'English' },
  { value: 'es' as const, label: 'ES', name: 'Español' },
]

export function UserMenuDropdown({ user, role }: UserMenuDropdownProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { locale, setLocale, theme, setTheme } = useUiStore()

  const displayName = user?.fullName ?? user?.email ?? 'Utilizador'

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOutsideClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutsideClick)
    }
  }, [])

  function handleLocale(value: 'pt' | 'en' | 'es') {
    setLocale(value)
    router.refresh()
  }

  function handleThemeToggle() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)

    startTransition(async () => {
      const result = await saveThemePreference(nextTheme)
      if (!result.success) {
        console.warn(`Theme preference was not saved: ${result.error}`)
      }
    })
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/5"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <UserCircle size={16} style={{ color: 'var(--sophi-text3)' }} />
        <span
          className="hidden max-w-32 truncate text-xs font-medium sm:block"
          style={{ color: 'var(--sophi-text)' }}
        >
          {displayName}
        </span>
        <ChevronDown size={12} style={{ color: 'var(--sophi-text3)' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-60 rounded-xl border shadow-lg"
          style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border2)' }}
        >
          {/* User info header */}
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--sophi-border)' }}>
            <div className="text-sm font-medium" style={{ color: 'var(--sophi-text)' }}>
              {displayName}
            </div>
            {user?.fullName && user.email && (
              <div className="text-xs" style={{ color: 'var(--sophi-text3)' }}>
                {user.email}
              </div>
            )}
            {role && (
              <span
                className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                style={{
                  background: 'rgba(0,229,160,0.10)',
                  color: 'var(--sophi-green)',
                  fontFamily: 'var(--font-dm-mono)',
                }}
              >
                {role}
              </span>
            )}
          </div>

          {/* Preferences section */}
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--sophi-border)' }}>
            <p
              className="mb-2 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}
            >
              Preferências
            </p>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--sophi-text2)' }}>
                Idioma
              </span>
              <div className="flex gap-1" role="group" aria-label="Choose language">
                {LOCALES.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => handleLocale(l.value)}
                    type="button"
                    aria-label={l.name}
                    aria-pressed={locale === l.value}
                    className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase transition-colors"
                    style={{
                      background: locale === l.value ? 'rgba(0,229,160,0.10)' : 'var(--sophi-bg3)',
                      color: locale === l.value ? 'var(--sophi-green)' : 'var(--sophi-text2)',
                      border: `1px solid ${locale === l.value ? 'rgba(0,229,160,0.3)' : 'var(--sophi-border)'}`,
                      fontFamily: 'var(--font-dm-mono)',
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--sophi-text2)' }}>
                Tema
              </span>
              <button
                aria-label="Toggle theme"
                aria-pressed={theme === 'light'}
                disabled={isPending}
                onClick={handleThemeToggle}
                type="button"
                className="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors hover:bg-white/5"
                style={{ color: 'var(--sophi-text2)' }}
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
              style={{ color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}
            >
              Conta
            </p>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: 'var(--sophi-text2)' }}
            >
              <Settings size={14} />
              Definições
            </Link>
            <button
              onClick={handleSignOut}
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: 'var(--sophi-text2)' }}
            >
              <LogOut size={14} />
              Terminar sessão
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
