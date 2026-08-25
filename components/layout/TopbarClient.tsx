'use client'

import { useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { UserMenuDropdown } from '@/components/layout/UserMenuDropdown'
import { useUiStore } from '@/stores/uiStore'
import { getSquadIdParam } from '@/lib/squad-url'
import type { TopbarDTO } from '@/lib/data/types'

function formatDate(): string {
  return new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

const NotificationCenter = dynamic(
  () => import('@/components/layout/NotificationCenter').then((mod) => mod.NotificationCenter),
  {
    loading: () => (
      <div className="size-9 min-h-[44px] min-w-[44px]" aria-hidden="true" />
    ),
  }
)

export function TopbarClient({ dto }: { dto: TopbarDTO }) {
  const { selectedSquadId, setSquad, setOrg, setSquads, setTheme, setRole, setAthleteId, mobileSidebarOpen, setMobileSidebarOpen } = useUiStore()
  const appliedThemePreference = useRef<'dark' | 'light' | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const squads = dto.squads

  useEffect(() => {
    setOrg(dto.org ?? null)
  }, [dto.org, setOrg])

  useEffect(() => {
    if (dto.role) setRole(dto.role as import('@/types').UserRole)
  }, [dto.role, setRole])

  useEffect(() => {
    setAthleteId(dto.athleteId ?? null)
  }, [dto.athleteId, setAthleteId])

  useEffect(() => {
    setSquads(squads)
  }, [squads, setSquads])

  useEffect(() => {
    if (dto.themePreference && dto.themePreference !== appliedThemePreference.current) {
      appliedThemePreference.current = dto.themePreference
      setTheme(dto.themePreference)
    }
  }, [dto.themePreference, setTheme])

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

  return (
    <header
      className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-5 z-40 border-b"
      style={{
        background: 'var(--sophi-bg)',
        borderColor: 'var(--sophi-border)',
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="flex size-11 items-center justify-center rounded-md transition-colors md:hidden"
          style={{ color: 'var(--sophi-text2)' }}
          aria-label="Toggle menu"
        >
          <Menu size={18} />
        </button>
        <Link
          href={dashboardHref}
          aria-label="Dashboard"
          className="text-xl font-bold tracking-tight"
          style={{
            fontFamily: 'var(--font-syne)',
            background: 'linear-gradient(135deg, var(--sophi-green) 0%, var(--sophi-blue) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Sophi
        </Link>
        {dto.org && (
          <div
            className="hidden min-w-0 items-baseline gap-2 border-l pl-3 md:flex"
            style={{ borderColor: 'var(--sophi-border)' }}
          >
            <span
              className="truncate text-base font-bold leading-none"
              style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}
            >
              {dto.org.name}
            </span>
            <span
              className="text-[10px] font-mono uppercase tracking-wide"
              style={{ color: 'var(--sophi-text3)' }}
            >
              {dto.org.type}
            </span>
          </div>
        )}

        <Select
          value={resolvedSquadId}
          onValueChange={(value) => handleSquadChange(value)}
          disabled={!squads.length}
        >
          <SelectTrigger
            size="sm"
            aria-label="Choose squad"
            className="ml-1 hidden sm:flex min-w-32 max-w-52 border-[var(--sophi-border2)] bg-[var(--sophi-bg3)] text-xs text-[var(--sophi-text)]"
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

      <div className="flex items-center gap-2">
        <span
          className="hidden lg:block text-xs"
          style={{ color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}
        >
          {formatDate()}
        </span>
        <NotificationCenter
          key={dto.org?.id ?? 'anon'}
          orgId={dto.org?.id}
          userId={dto.userId}
          initialNotifications={dto.notifications}
          initialUnreadCount={dto.unreadNotificationCount}
        />
        <ThemeToggle />
        <UserMenuDropdown user={dto.user} role={dto.role} />
      </div>
    </header>
  )
}
