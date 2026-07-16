'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useUiStore } from '@/stores/uiStore'
import { withSquadParam } from '@/lib/squad-url'
import {
  LayoutDashboard, Users, UserCircle, Activity, Calendar,
  Heart, Gauge, Zap, BookOpen, Settings,
  ClipboardList, TrendingUp, Stethoscope,
} from 'lucide-react'

interface NavItem {
  href: string
  labelKey: string
  icon: React.ElementType
  badge?: number
  sectionKey: string
}

const NAV_ITEMS: NavItem[] = [
  // Overview
  { href: '/',             labelKey: 'dashboard',       icon: LayoutDashboard, badge: 3, sectionKey: 'overview' },
  { href: '/squad',        labelKey: 'squad',           icon: Users,                     sectionKey: 'overview' },
  // Clinical
  { href: '/athletes',     labelKey: 'athletes',        icon: UserCircle,                sectionKey: 'clinical' },
  { href: '/input',        labelKey: 'input',           icon: ClipboardList,             sectionKey: 'clinical' },
  { href: '/readiness',    labelKey: 'readiness',       icon: Heart,                     sectionKey: 'clinical' },
  { href: '/rehab',        labelKey: 'rehab',           icon: Activity, badge: 2,        sectionKey: 'clinical' },
  { href: '/clinical-portal', labelKey: 'clinical_portal', icon: Stethoscope,            sectionKey: 'clinical' },
  // Performance
  { href: '/load',         labelKey: 'load',            icon: Gauge,                     sectionKey: 'performance' },
  { href: '/performance',  labelKey: 'performance',     icon: TrendingUp,                sectionKey: 'performance' },
  // Intelligence
  { href: '/calendar',     labelKey: 'calendar',        icon: Calendar,                  sectionKey: 'intelligence' },
  { href: '/passport',     labelKey: 'passport',        icon: BookOpen,                  sectionKey: 'intelligence' },
  // Special
  { href: '/female-squad', labelKey: 'female_squad',   icon: Zap,                       sectionKey: 'special' },
  // System
  { href: '/settings',     labelKey: 'settings',        icon: Settings,                  sectionKey: 'system' },
]

const SECTION_KEYS = ['overview', 'clinical', 'performance', 'intelligence', 'special', 'system'] as const

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('sidebar')
  const { mobileSidebarOpen, setMobileSidebarOpen, squads, selectedSquadId, setSquad, selectedOrg } = useUiStore()

  function close() { setMobileSidebarOpen(false) }

  function handleSquad(squadId: string) {
    setSquad(squadId)
    const params = new URLSearchParams(window.location.search)
    params.set('squadId', squadId)
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false })
    close()
  }

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
            aria-label="Choose squad"
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
        {SECTION_KEYS.map((sectionKey) => {
          const items = NAV_ITEMS.filter((i) => i.sectionKey === sectionKey)
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
                  const href = withSquadParam(item.href, selectedSquadId)
                  return (
                    <li key={item.href}>
                      <Link
                        href={href}
                        onClick={close}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group',
                          isActive
                            ? 'text-[var(--aura-green)] font-medium'
                            : 'text-[var(--aura-text2)] hover:text-[var(--aura-text)] hover:bg-[var(--aura-bg3)]'
                        )}
                        style={
                          isActive
                            ? { background: 'rgba(0,229,160,0.08)' }
                            : undefined
                        }
                      >
                        <Icon
                          size={15}
                          className={cn(
                            'shrink-0',
                            isActive
                              ? 'text-[var(--aura-green)]'
                              : 'text-[var(--aura-text3)] group-hover:text-[var(--aura-text2)]'
                          )}
                        />
                        <span className="flex-1 truncate">{t(`nav.${item.labelKey}`)}</span>
                        {item.badge ? (
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
