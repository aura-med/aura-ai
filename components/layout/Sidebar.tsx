'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, UserCircle, Activity, Calendar,
  Heart, Gauge, Zap, BookOpen, FlaskConical, Settings,
  ClipboardList, TrendingUp, Star
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: number
  section: string
}

const NAV_ITEMS: NavItem[] = [
  // Overview
  { href: '/',           label: 'Dashboard',        icon: LayoutDashboard, badge: 3, section: 'Visão Geral' },
  { href: '/squad',      label: 'Plantel',           icon: Users,           section: 'Visão Geral' },
  { href: '/selecoes',   label: 'Seleções',          icon: Star,            section: 'Visão Geral' },
  // Clinical
  { href: '/athletes',   label: 'Avaliação Atleta',  icon: UserCircle,      section: 'Clínico' },
  { href: '/readiness',  label: 'Prontidão',         icon: Heart,           section: 'Clínico' },
  { href: '/rehab',      label: 'Reabilitação',      icon: Activity, badge: 2, section: 'Clínico' },
  // Performance
  { href: '/load',       label: 'Carga & GPS',       icon: Gauge,           section: 'Performance' },
  { href: '/performance',label: 'Máximos & Perfil',  icon: TrendingUp,      section: 'Performance' },
  // Intelligence
  { href: '/calendar',   label: 'Calendar Intelligence', icon: Calendar,    section: 'Inteligência' },
  { href: '/passport',   label: 'Passaporte Atleta', icon: BookOpen,        section: 'Inteligência' },
  // Special
  { href: '/female-squad', label: 'Seleção Feminina', icon: Zap,            section: 'Especial' },
  // Admin
  { href: '/settings',   label: 'Definições',        icon: Settings,        section: 'Sistema' },
]

const SECTIONS = ['Visão Geral', 'Clínico', 'Performance', 'Inteligência', 'Especial', 'Sistema']

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="fixed left-0 top-14 bottom-0 w-60 flex flex-col border-r overflow-y-auto z-30"
      style={{ background: 'var(--aura-bg)', borderColor: 'var(--aura-border)' }}
    >
      <nav className="flex-1 px-3 py-4 space-y-6">
        {SECTIONS.map((section) => {
          const items = NAV_ITEMS.filter((i) => i.section === section)
          if (!items.length) return null
          return (
            <div key={section}>
              <p
                className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}
              >
                {section}
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
                        <span className="flex-1 truncate">{item.label}</span>
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
        Aura v1.1 · FPF Pilot
      </div>
    </aside>
  )
}
