'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Languages, LogOut, Moon, Settings, Sun, UserCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUiStore } from '@/stores/uiStore'

const LOCALES = [
  { value: 'pt', label: 'PT' },
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
] as const

export function MainUserMenu() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { theme, toggleTheme, locale, setLocale } = useUiStore()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
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

  function handleLocale(nextLocale: 'pt' | 'en' | 'es') {
    setLocale(nextLocale)
    router.refresh()
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Open user menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-md px-2 transition-colors hover:bg-[var(--aura-bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aura-green)]"
        style={{ color: 'var(--aura-text2)' }}
      >
        <UserCircle size={18} />
        <ChevronDown size={12} className="hidden sm:block" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border p-1 shadow-xl"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border2)' }}
        >
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--aura-border)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>
              {email ?? 'Aura user'}
            </div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
              Medical workspace
            </div>
          </div>

          <div className="p-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm transition-colors hover:bg-[var(--aura-bg3)]"
              style={{ color: 'var(--aura-text2)' }}
            >
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
              {LOCALES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleLocale(item.value)}
                  className="rounded-md px-2 py-2 text-xs font-mono font-semibold transition-colors"
                  style={{
                    background: locale === item.value ? 'rgba(0,229,160,0.10)' : 'var(--aura-bg3)',
                    color: locale === item.value ? 'var(--aura-green)' : 'var(--aura-text2)',
                    border: `1px solid ${locale === item.value ? 'rgba(0,229,160,0.30)' : 'var(--aura-border)'}`,
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t p-1" style={{ borderColor: 'var(--aura-border)' }}>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm transition-colors hover:bg-[var(--aura-bg3)]"
              style={{ color: 'var(--aura-text2)' }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm transition-colors hover:bg-[var(--aura-bg3)]"
              style={{ color: 'var(--aura-danger)' }}
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
