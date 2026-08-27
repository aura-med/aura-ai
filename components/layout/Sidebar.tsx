'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useUiStore } from '@/stores/uiStore'
import type { UserRole } from '@/types'
import { OWNER_ROLE, CLINICAL_ROLES, REHAB_ROLES, SQUAD_ROLES } from '@/lib/roles'
import {
  LayoutDashboard, Activity, Calendar,
  Heart, Gauge, BookOpen, Settings,
  ClipboardList, TrendingUp, FileText, AlertCircle, UserCircle, Pill, Apple,
  ChevronLeft, ChevronRight,
} from 'lucide-react'

// Rehab protocols / RTP are physio & doctor work; rehab_sessions RLS and the
// RTP/score APIs exclude masseurs, so keep /rehab out of their nav.
const PERFORMANCE_ROLES: UserRole[] = SQUAD_ROLES
const ALL_ROLES: UserRole[] = [OWNER_ROLE, ...CLINICAL_ROLES, ...SQUAD_ROLES, 'athlete']
// Nutrition data is read/writable by clinical staff + the nutritionist (RLS in
// migration 026: athlete_daily_weight / nutrition_assessments).
const NUTRITION_ROLES: UserRole[] = [...CLINICAL_ROLES, 'nutritionist']

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
  { href: '/rehab',         labelKey: 'rehab',             icon: Activity,        roles: REHAB_ROLES,      sectionKey: 'clinical' },
  { href: '/medication',    labelKey: 'medication',        icon: Pill,            roles: CLINICAL_ROLES,   sectionKey: 'clinical' },
  { href: '/nutrition',     labelKey: 'nutrition',         icon: Apple,           roles: NUTRITION_ROLES,  sectionKey: 'clinical' },
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
  const { mobileSidebarOpen, setMobileSidebarOpen, squads, selectedSquadId, setSquad, selectedOrg, role, athleteId, sidebarCollapsed, toggleSidebar } = useUiStore()
  const isAthlete = role === 'athlete'
  const collapsed = sidebarCollapsed

  function close() { setMobileSidebarOpen(false) }

  function handleSquad(squadId: string) {
    setSquad(squadId)
    const params = new URLSearchParams(window.location.search)
    params.set('squadId', squadId)
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false })
    close()
  }

  const visibleItems = role === OWNER_ROLE ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.roles.includes(role))

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
        'transition-[transform,width] duration-200 md:translate-x-0',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        collapsed ? 'md:w-16' : 'md:w-60',
      )}
      style={{ background: 'var(--sophi-bg)', borderColor: 'var(--sophi-border)' }}
    >
      {/* Collapse toggle — desktop only, mobile always shows the full drawer.
          Vertically centered on the sidebar's edge so it reads as part of
          the border, not a stray floating control. */}
      <button
        onClick={toggleSidebar}
        aria-label={collapsed ? t('nav.expand_sidebar') : t('nav.collapse_sidebar')}
        className="hidden md:flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border shadow-sm z-50 transition-colors hover:border-[var(--sophi-green)] hover:text-[var(--sophi-green)]"
        style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text3)' }}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {/* Mobile-only org + squad header */}
      <div
        className="md:hidden border-b px-4 py-3"
        style={{ borderColor: 'var(--sophi-border)' }}
      >
        {selectedOrg && (
          <div className="mb-2">
            <div
              className="text-sm font-bold leading-tight"
              style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}
            >
              {selectedOrg.name}
            </div>
            <div
              className="text-[10px] uppercase tracking-wide"
              style={{ color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}
            >
              {selectedOrg.type}
            </div>
          </div>
        )}
        {!isAthlete && squads.length > 1 && (
          <select
            value={selectedSquadId ?? ''}
            onChange={(e) => handleSquad(e.target.value)}
            className="w-full rounded-md px-3 py-2 text-xs font-medium outline-none"
            style={{
              background: 'var(--sophi-bg3)',
              border: '1px solid var(--sophi-border)',
              color: 'var(--sophi-text)',
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
        {isAthlete ? (
          athleteId && (
            <ul className="space-y-0.5">
              <li>
                <Link
                  href={`/athletes/${athleteId}`}
                  onClick={close}
                  title={collapsed ? t('nav.my_profile') : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group',
                    collapsed && 'md:justify-center md:px-0',
                    pathname.startsWith('/athletes')
                      ? 'text-[var(--sophi-green)] font-medium'
                      : 'text-[var(--sophi-text2)] hover:text-[var(--sophi-text)] hover:bg-[var(--sophi-bg3)]'
                  )}
                  style={pathname.startsWith('/athletes') ? { background: 'rgba(0,229,160,0.08)' } : undefined}
                >
                  <UserCircle
                    size={15}
                    className={cn('shrink-0', pathname.startsWith('/athletes') ? 'text-[var(--sophi-green)]' : 'text-[var(--sophi-text3)] group-hover:text-[var(--sophi-text2)]')}
                  />
                  <span className={cn('flex-1 truncate', collapsed && 'md:hidden')}>{t('nav.my_profile')}</span>
                </Link>
              </li>
            </ul>
          )
        ) : SECTION_KEYS.map((sectionKey: SectionKey) => {
          const items = visibleItems.filter((i) => i.sectionKey === sectionKey)
          if (!items.length) return null
          return (
            <div key={sectionKey}>
              <p
                className={cn('px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest', collapsed && 'md:hidden')}
                style={{ color: 'var(--sophi-text3)', fontFamily: 'var(--font-mono)' }}
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
                        title={collapsed ? label : undefined}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group',
                          collapsed && 'md:justify-center md:px-0',
                          item.inDevelopment
                            ? 'opacity-50 cursor-default pointer-events-none'
                            : isActive
                              ? 'text-[var(--sophi-green)] font-medium'
                              : 'text-[var(--sophi-text2)] hover:text-[var(--sophi-text)] hover:bg-[var(--sophi-bg3)]'
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
                              ? 'text-[var(--sophi-green)]'
                              : 'text-[var(--sophi-text3)] group-hover:text-[var(--sophi-text2)]'
                          )}
                        />
                        <span className={cn('flex-1 truncate', collapsed && 'md:hidden')}>{label}</span>
                        {item.inDevelopment && (
                          <span
                            className={cn(
                              'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full',
                              collapsed && 'md:hidden',
                            )}
                            style={{
                              background: 'var(--sophi-bg3)',
                              color: 'var(--sophi-text3)',
                              border: '1px solid var(--sophi-border)',
                            }}
                          >
                            Em dev.
                          </span>
                        )}
                        {item.badge && !item.inDevelopment ? (
                          <span
                            className={cn(
                              'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full',
                              collapsed && 'md:hidden',
                            )}
                            style={{
                              background: 'var(--sophi-danger-bg)',
                              color: 'var(--sophi-danger)',
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
        className={cn('px-6 py-3 text-[10px]', collapsed && 'md:hidden')}
        style={{ color: 'var(--sophi-text3)', fontFamily: 'var(--font-mono)' }}
      >
        {t('version')}
      </div>
    </aside>
    </>
  )
}
