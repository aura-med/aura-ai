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
import { getSquadIdParam, resolveSquadId } from '@/lib/squad-url'
import type { TopbarDTO } from '@/lib/data/types'
import { SophiLogo } from '@/components/brand/SophiLogo'

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
  const { selectedSquadId, setSquad, setOrg, setSquads, setTheme, setRole, setAthleteId, mobileSidebarOpen, setMobileSidebarOpen, sidebarCollapsed } = useUiStore()
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
  const resolvedSquadId = resolveSquadId({
    urlSquadId: selectedFromUrl,
    storedSquadId: selectedSquadId,
    defaultSquadId: dto.defaultSquadId,
    validSquadIds,
    firstSquadId: squads[0]?.id ?? null,
  })
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
      className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between z-40 border-b"
      style={{
        background: 'var(--sophi-bg)',
        borderColor: 'var(--sophi-border)',
      }}
    >
      <div className="flex h-full min-w-0 items-center">
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="ml-2 flex size-11 items-center justify-center rounded-md transition-colors md:hidden"
          style={{ color: 'var(--sophi-text2)' }}
          aria-label="Toggle menu"
        >
          <Menu size={18} />
        </button>

        {/* Exactly the sidebar's own width (collapsed/expanded, same Tailwind
            scale classes as Sidebar.tsx) and flush at x=0 like the sidebar,
            so this box's border-r always lines up with the sidebar's own
            right edge instead of floating at an unrelated position. */}
        <Link
          href={dashboardHref}
          aria-label="Dashboard"
          className={`hidden h-full shrink-0 items-center justify-center border-r md:flex ${sidebarCollapsed ? 'w-16' : 'w-60'}`}
          style={{ borderColor: 'var(--sophi-border)' }}
        >
          <SophiLogo className="h-10 w-auto" iconOnly />
        </Link>
        {/* Mobile: no permanent sidebar to align with, just a plain inline logo. */}
        <Link href={dashboardHref} aria-label="Dashboard" className="ml-2 flex items-center md:hidden">
          <SophiLogo className="h-10 w-auto" iconOnly />
        </Link>

        {dto.org && (
          <div className="hidden min-w-0 items-center gap-2 pl-3 md:flex">
            {dto.org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external/storage URL, no next/image domain config
              <img
                src={dto.org.logoUrl}
                alt={dto.org.name}
                className="h-12 w-12 shrink-0 object-contain"
              />
            ) : (
              <div className="flex items-baseline gap-2">
                <span
                  className="truncate text-base font-bold leading-none"
                  style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-display)' }}
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
            className="ml-4 hidden sm:flex min-w-32 max-w-52 border-[var(--sophi-border2)] bg-[var(--sophi-bg3)] text-xs text-[var(--sophi-text)]"
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

      <div className="flex items-center gap-2 pr-5">
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
