'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Globe2, Sun, Moon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { NotificationCenter } from '@/components/layout/NotificationCenter'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { useUiStore } from '@/stores/uiStore'
import { getSquadIdParam } from '@/lib/squad-url'
import { getUserOrganizationContext } from '@/lib/supabase'

type LocaleValue = 'pt' | 'en' | 'es'

const LOCALES: { value: LocaleValue; label: string; flag: string }[] = [
  { value: 'pt', label: 'PT', flag: '🇵🇹' },
  { value: 'en', label: 'EN', flag: '🇬🇧' },
  { value: 'es', label: 'ES', flag: '🇪🇸' },
]

export function Topbar() {
  return (
    <Suspense fallback={<TopbarShell />}>
      <TopbarContent />
    </Suspense>
  )
}

function TopbarContent() {
  const t = useTranslations('topbar')
  const { theme, toggleTheme, locale, setLocale, selectedSquadId, selectedOrgId, setSquad, setOrg } = useUiStore()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [today, setToday] = useState<string | null>(null)
  const [org, setOrgState] = useState<{ id: string; name: string; type: string } | null>(null)
  const [squads, setSquads] = useState<Array<{ id: string; name: string; type: string; org_id: string }>>([])

  useEffect(() => {
    setToday(new Date().toLocaleDateString('pt-PT', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    }))
  }, [])

  useEffect(() => {
    let cancelled = false
    getUserOrganizationContext()
      .then(({ org, squads }) => {
        if (cancelled) return
        setOrgState(org)
        setSquads(squads as Array<{ id: string; name: string; type: string; org_id: string }>)
        setOrg(org?.id ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setOrgState(null)
        setSquads([])
        setOrg(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedFromUrl = getSquadIdParam(searchParams)
  const validSquadIds = useMemo(() => new Set(squads.map((s) => s.id)), [squads])
  const resolvedSquadId =
    (selectedFromUrl && validSquadIds.has(selectedFromUrl) && selectedFromUrl) ||
    (selectedSquadId && validSquadIds.has(selectedSquadId) && selectedSquadId) ||
    squads[0]?.id ||
    null
  const selectedSquad = squads.find((s) => s.id === resolvedSquadId)
  const dashboardHref = resolvedSquadId ? `/?squadId=${encodeURIComponent(resolvedSquadId)}` : '/'

  useEffect(() => {
    if (!squads.length || !resolvedSquadId) return
    if (selectedSquadId !== resolvedSquadId) setSquad(resolvedSquadId)

    const current = getSquadIdParam(searchParams)
    if (current !== resolvedSquadId) {
      const next = new URLSearchParams(searchParams.toString())
      next.set('squadId', resolvedSquadId)
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    }
  }, [pathname, resolvedSquadId, router, searchParams, selectedSquadId, setSquad, squads.length])

  function handleSquadChange(value: string | null) {
    if (!value || !validSquadIds.has(value)) return
    setSquad(value)
    const next = new URLSearchParams(searchParams.toString())
    next.set('squadId', value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  function handleLocaleChange(value: string | null) {
    if (value !== 'pt' && value !== 'en' && value !== 'es') return
    setLocale(value)
    router.refresh()
  }

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
        <Link
          href={dashboardHref}
          aria-label="Dashboard"
          className="text-xl font-bold tracking-tight"
          style={{
            fontFamily: 'var(--font-syne)',
            background: 'linear-gradient(135deg, var(--aura-green) 0%, var(--aura-blue) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Aura
        </Link>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
          style={{
            color: 'var(--aura-text3)',
            borderColor: 'var(--aura-border)',
          }}
        >
          {t('fpfPilot')}
        </span>
        {org && (
          <div
            className="flex min-w-0 items-baseline gap-2 border-l pl-3"
            style={{ borderColor: 'var(--aura-border)' }}
          >
            <span
              className="truncate text-base font-bold leading-none"
              style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}
            >
              {org.name}
            </span>
            <span
              className="text-[10px] font-mono uppercase tracking-wide"
              style={{ color: 'var(--aura-text3)' }}
            >
              {org.type}
            </span>
          </div>
        )}

        {/* Squad selector */}
        <Select
          value={resolvedSquadId}
          onValueChange={(value) => handleSquadChange(value)}
          disabled={!squads.length}
        >
          <SelectTrigger
            size="sm"
            className="ml-1 min-w-40 max-w-52 border-[var(--aura-border2)] bg-[var(--aura-bg3)] text-xs text-[var(--aura-text)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {selectedSquad?.name ?? 'Sem squads'}
            </span>
          </SelectTrigger>
          <SelectContent>
            {squads.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

        {/* Language selector */}
        <Select
          value={locale}
          onValueChange={(value) => handleLocaleChange(value)}
        >
          <SelectTrigger
            size="sm"
            aria-label="Choose language"
            className="min-w-20 border-[var(--aura-border2)] bg-[var(--aura-bg3)] text-xs text-[var(--aura-text)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <Globe2 size={14} aria-hidden="true" />
            <span>{locale.toUpperCase()}</span>
          </SelectTrigger>
          <SelectContent align="end" alignItemWithTrigger={false} className="min-w-28">
            {LOCALES.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                <span aria-hidden="true">{l.flag}</span>
                <span>{l.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
        <NotificationCenter orgId={org?.id ?? selectedOrgId ?? undefined} />
      </div>
    </header>
  )
}

function TopbarShell() {
  return (
    <header
      className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-5 z-40 border-b"
      style={{ background: 'var(--aura-bg)', borderColor: 'var(--aura-border)' }}
    >
      <Link
        href="/"
        aria-label="Dashboard"
        className="text-xl font-bold tracking-tight"
        style={{
          fontFamily: 'var(--font-syne)',
          background: 'linear-gradient(135deg, var(--aura-green) 0%, var(--aura-blue) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Aura
      </Link>
    </header>
  )
}
