'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { NotificationCenter } from '@/components/layout/NotificationCenter'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { UserMenuDropdown } from '@/components/layout/UserMenuDropdown'
import { useUiStore } from '@/stores/uiStore'
import { getSquadIdParam } from '@/lib/squad-url'
import type { TopbarDTO } from '@/lib/data/types'

function formatDate(): string {
  return new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function TopbarClient({ dto }: { dto: TopbarDTO }) {
  const { selectedSquadId, setSquad, setOrg, setSquads, mobileSidebarOpen, setMobileSidebarOpen } = useUiStore()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const squads = dto.squads

  useEffect(() => {
    setOrg(dto.org ?? null)
  }, [dto.org, setOrg])

  useEffect(() => {
    setSquads(squads)
  }, [squads, setSquads])

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
        background: 'var(--aura-bg)',
        borderColor: 'var(--aura-border)',
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="flex size-11 items-center justify-center rounded-md transition-colors md:hidden"
          style={{ color: 'var(--aura-text2)' }}
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
            background: 'linear-gradient(135deg, var(--aura-green) 0%, var(--aura-blue) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Aura
        </Link>
        {dto.org && (
          <div
            className="hidden min-w-0 items-baseline gap-2 border-l pl-3 md:flex"
            style={{ borderColor: 'var(--aura-border)' }}
          >
            <span
              className="truncate text-base font-bold leading-none"
              style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}
            >
              {dto.org.name}
            </span>
            <span
              className="text-[10px] font-mono uppercase tracking-wide"
              style={{ color: 'var(--aura-text3)' }}
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
            className="ml-1 hidden sm:flex min-w-32 max-w-52 border-[var(--aura-border2)] bg-[var(--aura-bg3)] text-xs text-[var(--aura-text)]"
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
          style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}
        >
          {formatDate()}
        </span>
        <NotificationCenter
          key={dto.org?.id ?? 'anon'}
          orgId={dto.org?.id}
          userId={dto.userId}
          initialNotifications={dto.notifications}
        />
        <UserMenuDropdown user={dto.user} role={dto.role} />
      </div>
    </header>
  )
}
