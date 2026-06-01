'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import {
  LayoutGrid, Stethoscope, Activity, Syringe, FolderOpen, ChevronDown, Brain,
} from 'lucide-react'
import type { TabId } from '@/types/athlete-profile'

interface Tab {
  id: TabId
  label: string
  icon: React.ElementType
  badge?: number
}

const TABS: Tab[] = [
  { id: 'overview',         label: 'Overview',        icon: LayoutGrid  },
  { id: 'medical',          label: 'Médico',          icon: Stethoscope },
  { id: 'injuries',         label: 'Lesões',          icon: Activity    },
  { id: 'treatments',       label: 'Tratamentos',     icon: Syringe     },
  { id: 'documents',        label: 'Documentos',      icon: FolderOpen  },
  { id: 'recommendations',  label: 'Recomendações',   icon: Brain       },
]

interface TabNavigationProps {
  activeTab: TabId
  badges?: Partial<Record<TabId, number>>
}

export function TabNavigation({ activeTab, badges = {} }: TabNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState<TabId | null>(null)

  function navigate(tab: TabId) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`${pathname}?${params.toString()}`)
    setMobileOpen(null)
  }

  const activeTabData = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  return (
    <>
      {/* ── Desktop: horizontal tabs ──────────────────────────────────────── */}
      <div
        className="hidden md:flex items-center gap-1 border-b"
        style={{ borderColor: 'var(--aura-border)' }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.id === activeTab
          const badge = badges[tab.id]
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all whitespace-nowrap',
                isActive
                  ? 'border-[var(--aura-green)] text-[var(--aura-green)]'
                  : 'border-transparent hover:border-[var(--aura-border2)] hover:text-[var(--aura-text)]',
              )}
              style={{ color: isActive ? 'var(--aura-green)' : 'var(--aura-text2)' }}
            >
              <Icon size={14} />
              {tab.label}
              {badge != null && badge > 0 && (
                <span
                  className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--aura-danger-bg)', color: 'var(--aura-danger)' }}
                >
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Mobile: accordion selector ────────────────────────────────────── */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(mobileOpen ? null : activeTab)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium"
          style={{
            background: 'var(--aura-bg2)',
            borderColor: 'var(--aura-border)',
            color: 'var(--aura-text)',
          }}
        >
          <span className="flex items-center gap-2">
            <activeTabData.icon size={14} style={{ color: 'var(--aura-green)' }} />
            {activeTabData.label}
          </span>
          <ChevronDown
            size={14}
            className="transition-transform"
            style={{
              color: 'var(--aura-text3)',
              transform: mobileOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </button>
        {mobileOpen && (
          <div
            className="mt-1 rounded-xl border overflow-hidden"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            {TABS.filter((t) => t.id !== activeTab).map((tab) => {
              const Icon = tab.icon
              const badge = badges[tab.id]
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigate(tab.id)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-[var(--aura-bg3)] border-t first:border-t-0"
                  style={{ color: 'var(--aura-text2)', borderColor: 'var(--aura-border)' }}
                >
                  <Icon size={14} />
                  {tab.label}
                  {badge != null && badge > 0 && (
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ml-auto"
                      style={{ background: 'var(--aura-danger-bg)', color: 'var(--aura-danger)' }}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
