'use client'

import { ChevronDown, Sun, Moon } from 'lucide-react'
import { NotificationCenter } from '@/components/layout/NotificationCenter'
import { useState, useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import { getOrganizations, getAllSquads } from '@/lib/supabase'

const ROLE_VALUES: UserRole[] = ['physio', 'doctor', 'coach', 'fitness_coach', 'admin']

const LOCALES: { value: 'pt' | 'en' | 'es'; label: string }[] = [
  { value: 'pt', label: 'PT' },
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
]

export function Topbar() {
  const t = useTranslations('topbar')
  const { role, setRole, theme, toggleTheme, locale, setLocale, selectedSquadId, selectedOrgId, setSquad, setOrg } = useUiStore()

  const [today, setToday] = useState<string | null>(null)
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; type: string }>>([])
  const [squads, setSquads] = useState<Array<{ id: string; name: string; type: string; org_id: string }>>([])

  useEffect(() => {
    setToday(new Date().toLocaleDateString('pt-PT', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    }))
  }, [])

  useEffect(() => {
    getOrganizations().then((data) => {
      setOrgs(data)
      if (data.length > 0 && !selectedOrgId) {
        setOrg(data[0].id)
      }
    }).catch(() => {})

    getAllSquads().then((data) => {
      const mapped = data.map((s) => ({
        id: s.id as string,
        name: s.name as string,
        type: s.type as string,
        org_id: s.org_id as string,
      }))
      setSquads(mapped)
      if (mapped.length > 0 && !selectedSquadId) {
        setSquad(mapped[0].id)
      }
    }).catch(() => {})
  }, [])

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
          {t('fpfPilot')}
        </span>
        {orgs.length > 0 && (
          <span
            className="text-xs font-semibold tracking-wide"
            style={{ color: 'var(--aura-text2)', fontFamily: 'var(--font-mono)' }}
          >
            {orgs.find((o) => o.id === selectedOrgId)?.name ?? orgs[0]?.name}
          </span>
        )}
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

        {/* Language toggle */}
        <div className="flex items-center gap-1 text-xs font-mono" style={{ color: 'var(--aura-text3)' }}>
          {LOCALES.map((l) => (
            <button
              key={l.value}
              onClick={() => setLocale(l.value)}
              className={cn(
                'px-1.5 py-0.5 rounded transition-colors',
                locale === l.value
                  ? 'text-[var(--aura-green)]'
                  : 'hover:text-[var(--aura-text)]'
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Squad selector */}
        {squads.length > 0 && (
          <div className="relative">
            <select
              value={selectedSquadId ?? squads[0]?.id ?? ''}
              onChange={(e) => setSquad(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-md text-xs border cursor-pointer focus:outline-none"
              style={{
                background: 'var(--aura-bg3)',
                borderColor: 'var(--aura-border2)',
                color: 'var(--aura-text)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {squads.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--aura-text3)' }}
            />
          </div>
        )}

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
            {ROLE_VALUES.map((value) => (
              <option key={value} value={value}>
                {t(`roles.${value}`)}
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

        {/* Notifications */}
        <NotificationCenter orgId={selectedOrgId ?? undefined} />
      </div>
    </header>
  )
}
