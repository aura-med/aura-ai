'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  User, Building2, Users, SlidersHorizontal, Bell,
  Puzzle, CreditCard, ShieldCheck, LogOut, ChevronRight, CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const SETTINGS_NAV = [
  { href: '/settings/profile', icon: User, key: 'profile' },
  { href: '/settings/organizations', icon: Building2, key: 'organizations' },
  { href: '/settings/squads', icon: Users, key: 'squads' },
  { href: '/settings/preferences', icon: SlidersHorizontal, key: 'preferences' },
  { href: '/settings/users', icon: Users, key: 'users' },
  { href: '/settings/calendar', icon: CalendarDays, key: 'calendar' },
  { href: '/settings/notifications', icon: Bell, key: 'notifications' },
  { href: '/settings/integrations', icon: Puzzle, key: 'integrations' },
  { href: '/settings/subscription', icon: CreditCard, key: 'subscription' },
  { href: '/settings/privacy', icon: ShieldCheck, key: 'privacy' },
]

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('settings')
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-56px)]">

      {/* Mobile: horizontal scrollable nav */}
      <nav
        className="flex md:hidden overflow-x-auto border-b gap-1 px-3 py-2 shrink-0"
        style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg)' }}
      >
        {SETTINGS_NAV.map(({ href, icon: Icon, key }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap shrink-0 transition-colors',
                active ? 'font-medium' : 'hover:bg-white/5'
              )}
              style={{
                color: active ? 'var(--aura-green)' : 'var(--aura-text2)',
                background: active ? 'rgba(0,229,160,0.10)' : undefined,
              }}
            >
              <Icon size={13} />
              <span>{t(`nav.${key}`)}</span>
            </Link>
          )
        })}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap shrink-0 transition-colors hover:bg-white/5"
          style={{ color: 'var(--aura-text2)' }}
        >
          <LogOut size={13} />
          {t('nav.signOut')}
        </button>
      </nav>

      {/* Desktop: vertical sidebar */}
      <aside
        className="hidden md:flex w-56 shrink-0 border-r flex-col"
        style={{ background: 'var(--aura-bg)', borderColor: 'var(--aura-border)' }}
      >
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--aura-border)' }}>
          <h2
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}
          >
            {t('title')}
          </h2>
        </div>

        <nav className="flex-1 py-2">
          {SETTINGS_NAV.map(({ href, icon: Icon, key }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  active ? 'font-medium' : 'hover:bg-white/5'
                )}
                style={{
                  color: active ? 'var(--aura-green)' : 'var(--aura-text2)',
                  background: active ? 'rgba(0,229,160,0.06)' : undefined,
                }}
              >
                <Icon size={15} />
                <span>{t(`nav.${key}`)}</span>
                {active && <ChevronRight size={12} className="ml-auto" style={{ color: 'var(--aura-green)' }} />}
              </Link>
            )
          })}
        </nav>

        <button
          onClick={handleSignOut}
          className="m-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/5"
          style={{ color: 'var(--aura-text2)' }}
        >
          <LogOut size={15} />
          {t('nav.signOut')}
        </button>
      </aside>

      <section className="min-w-0 flex-1 p-4 md:p-6">
        {children}
      </section>
    </div>
  )
}
