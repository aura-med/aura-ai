'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useUiStore } from '@/stores/uiStore'
import type { UserRole } from '@/types'
import {
  LayoutDashboard, Activity, Calendar,
  Heart, Gauge, BookOpen, Settings,
  ClipboardList, TrendingUp, FileText, AlertCircle,
} from 'lucide-react'

const CLINICAL_ROLES: UserRole[] = ['admin', 'doctor', 'physio', 'masseur']
const PERFORMANCE_ROLES: UserRole[] = ['admin', 'doctor', 'physio', 'fitness_coach', 'coach', 'director', 'team_manager', 'nutritionist', 'scout']
const ALL_ROLES: UserRole[] = ['admin', 'doctor', 'physio', 'masseur', 'coach', 'fitness_coach', 'nutritionist', 'director', 'scout', 'team_manager', 'athlete']

interface NavItem {
  href: string
  labelKey: string
  icon: React.ElementType
  badge?: number
  roles: UserRole[]
  inDevelopment?: boolean
  sectionKey: string
}

const NAV_ITEMS: NavItem[] = [
  // Overview — visible to all. The squad/"Plantel" view lives as a tab inside
  // the dashboard, so it is intentionally not a separate sidebar entry.
  { href: '/',              labelKey: 'dashboard',         icon: LayoutDashboard, roles: ALL_ROLES,        sectionKey: 'overview' },
  // Clínico — clinical staff only
  { href: '/clinical',      labelKey: 'clinical_file',     icon: FileText,        roles: CLINICAL_ROLES,   sectionKey: 'clinical' },
  { href: '/occurrences',   labelKey: 'occurrences',       icon: AlertCircle,     roles: CLINICAL_ROLES,   sectionKey: 'clinical' },
  { href: '/rehab',         labelKey: 'rehab',             icon: Activity,        roles: CLINICAL_ROLES,   sectionKey: 'clinical' },
  // Performance — visible to all, marked as in development
  { href: '/load',          labelKey: 'load',              icon: Gauge,           roles: PERFORMANCE_ROLES, inDevelopment: true, sectionKey: 'performance' },
  { href: '/performance',   labelKey: 'performance',       icon: TrendingUp,      roles: PERFORMANCE_ROLES, inDevelopment: true, sectionKey: 'performance' },
  { href: '/readiness',     labelKey: 'readiness',         icon: Heart,           roles: PERFORMANCE_ROLES, inDevelopment: true, sectionKey: 'performance' },
  { href: '/input',         labelKey: 'input',             icon: ClipboardList,   roles: PERFORMANCE_ROLES, inDevelopment: true, sectionKey: 'performance' },
  // Intelligence
  { href: '/calendar',      labelKey: 'calendar',          icon: Calendar,        roles: ALL_ROLES,        sectionKey: 'intelligence' },
  { href: '/passport',      labelKey: 'passport',          icon: BookOpen,        roles: ALL_ROLES,        sectionKey: 'intelligence' },
  // System
  { href: '/settings',      labelKey: 'settings',          icon: Settings,        roles: ALL_ROLES,        sectionKey: 'system' },
]

const SECTION_KEYS = ['overview', 'clinical', 'performance', 'intelligence', 'system'] as const
type SectionKey = typeof SECTION_KEYS[number]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('sidebar')
  const { mobileSidebarOpen, setMobileSidebarOpen, squads, selectedSquadId, setSquad, selectedOrg, role } = useUiStore()

  function close() { setMobileSidebarOpen(false) }

  function handleSquad(squadId: string) {
    setSquad(squadId)
    const params = new URLSearchParams(window.location.search)
    params.set('squadId', squadId)
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false })
    close()
  }

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <>
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}
    <aside
      className={cn(
        'fixed left-0 top-14 bottom-0 w-60 flex flex-col border-r overflow-y-auto z-40',
        'transition-transform duration-200 md:translate-x-0',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}
      style={{ background: 'var(--aura-bg)', borderColor: 'var(--aura-border)' }}
    >
      {/* Mobile-only org + squad header */}
      <div
        className="md:hidden border-b px-4 py-3"
        style={{ borderColor: 'var(--aura-border)' }}
      >
        {selectedOrg && (
          <div className="mb-2">
            <div
              className="text-sm font-bold leading-tight"
              style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}
            >
              {selectedOrg.name}
            </div>
            <div
              className="text-[10px] uppercase tracking-wide"
              style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}
            >
              {selectedOrg.type}
            </div>
          </div>
        )}
        {squads.length > 1 && (
          <select
            value={selectedSquadId ?? ''}
            onChange={(e) => handleSquad(e.target.value)}
            className="w-full rounded-md px-3 py-2 text-xs font-medium outline-none"
            style={{
              background: 'var(--aura-bg3)',
              border: '1px solid var(--aura-border)',
              color: 'var(--aura-text)',
              fontFamily: 'var(--font-dm-mono)',
            }}
          >
            {squads.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6">
        {SECTION_KEYS.map((sectionKey: SectionKey) => {
          const items = visibleItems.filter((i) => i.sectionKey === sectionKey)
          if (!items.length) return null
          return (
            <div key={sectionKey}>
              <p
                className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}
              >
                {t(`sections.${sectionKey}`)}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href ||
                    (item.href !== '/' && pathname.startsWith(item.href))
                  const label = t(`nav.${item.labelKey}`)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group',
                          item.inDevelopment
                            ? 'opacity-50 cursor-default pointer-events-none'
                            : isActive
                              ? 'text-[var(--aura-green)] font-medium'
                              : 'text-[var(--aura-text2)] hover:text-[var(--aura-text)] hover:bg-[var(--aura-bg3)]'
                        )}
                        style={
                          isActive && !item.inDevelopment
                            ? { background: 'rgba(0,229,160,0.08)' }
                            : undefined
                        }
                        aria-disabled={item.inDevelopment}
                        tabIndex={item.inDevelopment ? -1 : undefined}
                      >
                        <Icon
                          size={15}
                          className={cn(
                            'shrink-0',
                            isActive && !item.inDevelopment
                              ? 'text-[var(--aura-green)]'
                              : 'text-[var(--aura-text3)] group-hover:text-[var(--aura-text2)]'
                          )}
                        />
                        <span className="flex-1 truncate">{label}</span>
                        {item.inDevelopment && (
                          <span
                            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: 'var(--aura-bg3)',
                              color: 'var(--aura-text3)',
                              border: '1px solid var(--aura-border)',
                            }}
                          >
                            Em dev.
                          </span>
                        )}
                        {item.badge && !item.inDevelopment ? (
                          <span
                            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: 'var(--aura-danger-bg)',
                              color: 'var(--aura-danger)',
                            }}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Version tag */}
      <div
        className="px-6 py-3 text-[10px]"
        style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}
      >
        {t('version')}
      </div>
    </aside>
    </>
  )
}
