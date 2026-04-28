'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  User, Building2, Users, SlidersHorizontal, Bell,
  Puzzle, CreditCard, ShieldCheck, LogOut, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const SETTINGS_NAV = [
  { href: '/settings/profile',       icon: User,              key: 'profile' },
  { href: '/settings/organizations', icon: Building2,         key: 'organizations' },
  { href: '/settings/squads',        icon: Users,             key: 'squads' },
  { href: '/settings/preferences',   icon: SlidersHorizontal, key: 'preferences' },
  { href: '/settings/users',         icon: Users,             key: 'users' },
  { href: '/settings/notifications', icon: Bell,              key: 'notifications' },
  { href: '/settings/integrations',  icon: Puzzle,            key: 'integrations' },
  { href: '/settings/subscription',  icon: CreditCard,        key: 'subscription' },
  { href: '/settings/privacy',       icon: ShieldCheck,       key: 'privacy' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('settings')
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] gap-0">
      {/* Sidebar */}
      <aside
        className="w-56 shrink-0 border-r flex flex-col"
        style={{ background: 'var(--aura-bg)', borderColor: 'var(--aura-border)' }}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--aura-border)' }}>
          <h2
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}
          >
            {t('title')}
          </h2>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2">
          {SETTINGS_NAV.map(({ href, icon: Icon, key }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  active
                    ? 'font-medium'
                    : 'hover:bg-white/5'
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

        {/* Sign out */}
        <div className="border-t p-3" style={{ borderColor: 'var(--aura-border)' }}>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm rounded-md transition-colors hover:bg-white/5"
            style={{ color: 'var(--aura-danger)' }}
          >
            <LogOut size={15} />
            {t('nav.signOut')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto" style={{ background: 'var(--aura-bg)' }}>
        {children}
      </main>
    </div>
  )
}
