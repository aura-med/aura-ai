'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, UserCircle } from 'lucide-react'
import { signOut } from '@/lib/actions'

const LEVEL_COLORS: Record<string, string> = {
  owner:   'var(--aura-green)',
  admin:   'var(--aura-blue)',
  support: 'var(--aura-warn)',
  analyst: 'var(--aura-text3)',
}

interface UserMenuProps {
  email?: string
  fullName?: string | null
  level: string
}

export function UserMenu({ email, fullName, level }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/5"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <UserCircle size={16} style={{ color: 'var(--aura-text3)' }} />
        <div className="hidden text-left sm:block">
          <div className="text-xs font-medium" style={{ color: 'var(--aura-text)' }}>
            {displayName}
          </div>
          <div
            className="text-[10px] uppercase"
            style={{ color: LEVEL_COLORS[level] ?? 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}
          >
            {level}
          </div>
        </div>
        <ChevronDown size={12} style={{ color: 'var(--aura-text3)' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border shadow-lg"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border2)' }}
        >
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
                background: `color-mix(in srgb, ${LEVEL_COLORS[level] ?? 'var(--aura-text3)'} 12%, transparent)`,
                color: LEVEL_COLORS[level] ?? 'var(--aura-text3)',
              }}
            >
              {level}
            </span>
          </div>

          <div className="p-1">
            <form action={signOut}>
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/5"
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
