'use client'

import { Bell, ChevronDown, Sun, Moon } from 'lucide-react'
import { useUiStore } from '@/stores/uiStore'
import type { UserRole } from '@/types'

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'physio',        label: 'Fisioterapeuta' },
  { value: 'doctor',        label: 'Médico' },
  { value: 'coach',         label: 'Treinador' },
  { value: 'fitness_coach', label: 'Prep. Físico' },
  { value: 'admin',         label: 'Admin' },
]

export function Topbar() {
  const { role, setRole, theme, toggleTheme } = useUiStore()

  const today = new Date().toLocaleDateString('pt-PT', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <header
      className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-5 z-40 border-b"
      style={{
        background: 'var(--aura-bg)',
        borderColor: 'var(--aura-border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span
          className="text-xl font-bold tracking-tight"
          style={{
            fontFamily: 'var(--font-syne)',
            background: 'linear-gradient(135deg, var(--aura-green) 0%, var(--aura-blue) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Aura
        </span>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
          style={{
            color: 'var(--aura-text3)',
            borderColor: 'var(--aura-border)',
          }}
        >
          FPF Pilot
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Date */}
        <span
          className="hidden sm:block text-xs"
          style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}
        >
          {today}
        </span>

        {/* Role selector */}
        <div className="relative">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="appearance-none pl-3 pr-8 py-1.5 rounded-md text-xs border cursor-pointer focus:outline-none"
            style={{
              background: 'var(--aura-bg3)',
              borderColor: 'var(--aura-border2)',
              color: 'var(--aura-text)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--aura-text3)' }}
          />
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md transition-colors"
          style={{ color: 'var(--aura-text2)' }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Alerts bell */}
        <button
          className="relative p-2 rounded-md transition-colors"
          style={{ color: 'var(--aura-text2)' }}
        >
          <Bell size={16} />
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ background: 'var(--aura-danger)' }}
          />
        </button>
      </div>
    </header>
  )
}
