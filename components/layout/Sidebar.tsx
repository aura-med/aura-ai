'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useUiStore } from '@/stores/uiStore'
import {
  LayoutDashboard, Users, UserCircle, Activity, Calendar,
  Heart, Gauge, Zap, BookOpen, Settings,
  ClipboardList, TrendingUp
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
  { href: '/',           labelKey: 'dashboard',    icon: LayoutDashboard, badge: 3, sectionKey: 'overview' },
  { href: '/squad',      labelKey: 'squad',          icon: Users,                     sectionKey: 'overview' },
  // Clinical
  { href: '/athletes',   labelKey: 'athletes',       icon: UserCircle,                sectionKey: 'clinical' },
  { href: '/input',      labelKey: 'input',          icon: ClipboardList,             sectionKey: 'clinical' },
  { href: '/readiness',  labelKey: 'readiness',      icon: Heart,                     sectionKey: 'clinical' },
  { href: '/rehab',      labelKey: 'rehab',          icon: Activity, badge: 2,        sectionKey: 'clinical' },
  // Performance
  { href: '/load',       labelKey: 'load',           icon: Gauge,                     sectionKey: 'performance' },
  { href: '/performance',labelKey: 'performance',    icon: TrendingUp,                sectionKey: 'performance' },
  // Intelligence
  { href: '/calendar',   labelKey: 'calendar',       icon: Calendar,                  sectionKey: 'intelligence' },
  { href: '/passport',   labelKey: 'passport',       icon: BookOpen,                  sectionKey: 'intelligence' },
  // Special
  { href: '/female-squad', labelKey: 'female_squad', icon: Zap,                       sectionKey: 'special' },
  // Admin
  { href: '/settings',   labelKey: 'settings',       icon: Settings,                  sectionKey: 'system' },
]

const SECTION_KEYS = ['overview', 'clinical', 'performance', 'intelligence', 'special', 'system'] as const

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('sidebar')
  const { mobileSidebarOpen, setMobileSidebarOpen, locale, setLocale } = useUiStore()

  function close() { setMobileSidebarOpen(false) }

  function handleLocale(loc: 'pt' | 'en' | 'es') {
    setLocale(loc)
    router.refresh()
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
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
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

      {/* Mobile-only footer: locale switcher */}
      <div
        className="md:hidden border-t px-3 py-3"
        style={{ borderColor: 'var(--aura-border)' }}
      >
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}>
          Idioma
        </p>
        <div className="flex gap-1">
          {(['pt', 'en', 'es'] as const).map((loc) => (
            <button
              key={loc}
              onClick={() => handleLocale(loc)}
              className="flex-1 rounded-md py-2 text-xs font-mono font-semibold uppercase transition-colors"
              style={{
                background: locale === loc ? 'rgba(0,229,160,0.10)' : 'var(--aura-bg3)',
                color: locale === loc ? 'var(--aura-green)' : 'var(--aura-text2)',
                border: `1px solid ${locale === loc ? 'rgba(0,229,160,0.3)' : 'var(--aura-border)'}`,
              }}
            >
              {loc.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

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
