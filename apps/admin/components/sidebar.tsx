'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, section: 'Control' },
  { href: '/organizations', label: 'Organizations', icon: Building2, section: 'Control' },
  { href: '/users', label: 'Users & Access', icon: Users, section: 'Control' },
  { href: '/injuries', label: 'Injury Management', icon: Stethoscope, section: 'Clinical Ops' },
  { href: '/protocols', label: 'Rehab Protocols', icon: FileText, section: 'Clinical Ops' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, section: 'Intelligence' },
  { href: '/operations', label: 'Operations', icon: Activity, section: 'Intelligence' },
  { href: '/security', label: 'Security', icon: ShieldCheck, section: 'System' },
  { href: '/settings', label: 'Settings', icon: Settings, section: 'System' },
]

const SECTIONS = ['Control', 'Clinical Ops', 'Intelligence', 'System']

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed bottom-0 left-0 top-14 z-40 flex w-60 flex-col overflow-y-auto border-r',
          'transition-transform duration-200 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ background: 'var(--aura-bg)', borderColor: 'var(--aura-border)' }}
      >
        {/* Mobile-only Aura Admin badge */}
        <div
          className="flex items-center gap-2 border-b px-4 py-3 md:hidden"
          style={{ borderColor: 'var(--aura-border)' }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'var(--aura-green-bg)', color: 'var(--aura-green)' }}
          >
            <ShieldCheck size={14} />
          </div>
          <span
            className="text-sm font-bold"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            Aura Admin
          </span>
        </div>

        <nav className="flex-1 space-y-6 px-3 py-4">
          {SECTIONS.map((section) => (
            <div key={section}>
              <p
                className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}
              >
                {section}
              </p>
              <ul className="space-y-0.5">
                {NAV_ITEMS.filter((item) => item.section === section).map((item) => {
                  const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          'flex min-h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors',
                          active
                            ? 'font-medium text-[var(--aura-green)]'
                            : 'text-[var(--aura-text2)] hover:bg-[var(--aura-bg3)] hover:text-[var(--aura-text)]'
                        )}
                        style={active ? { background: 'rgba(0,229,160,0.08)' } : undefined}
                      >
                        <Icon
                          size={15}
                          className={active ? 'text-[var(--aura-green)]' : 'text-[var(--aura-text3)]'}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div
          className="flex items-center gap-2 px-6 py-3 text-[10px]"
          style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}
        >
          <LockKeyhole size={12} />
          INTERNAL ADMIN
        </div>
      </aside>
    </>
  )
}
