'use client'

import { useState } from 'react'
import { Menu, ShieldCheck, Timer } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { UserMenu } from '@/components/user-menu'
import { SubmitButton } from '@/components/ui'
import { endSupportSession } from '@/lib/actions'
import { formatDateTime } from '@/lib/utils'

interface AdminShellProps {
  email?: string
  fullName?: string | null
  level: string
  locale: string
  supportSession: null | {
    id: string
    org_name: string
    ticket_id: string
    reason: string
    expires_at: string
  }
  children: React.ReactNode
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function AdminShell({ email, fullName, level, locale, supportSession, children }: AdminShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <>
      <header
        className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b px-4 sm:px-5"
        style={{ background: 'var(--aura-bg)', borderColor: 'var(--aura-border)' }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="flex size-11 items-center justify-center rounded-md transition-colors md:hidden"
            onClick={() => setMobileSidebarOpen((open) => !open)}
            style={{ color: 'var(--aura-text2)' }}
            type="button"
            aria-label="Toggle menu"
            aria-expanded={mobileSidebarOpen}
          >
            <Menu size={18} />
          </button>

          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--aura-green-bg)', color: 'var(--aura-green)' }}
          >
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold leading-none" style={{ fontFamily: 'var(--font-syne)' }}>
              Aura Admin
            </div>
            <div className="text-[10px]" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
              PLATFORM CONTROL
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="hidden text-xs lg:block"
            style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}
          >
            {formatDate(new Date())}
          </span>

          <UserMenu email={email} fullName={fullName} level={level} currentLocale={locale} />
        </div>
      </header>

      <Sidebar mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

      <main className="mt-14 min-h-[calc(100vh-3.5rem)] p-4 sm:p-6 md:ml-60">
        {supportSession ? (
          <div
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
            style={{ background: 'var(--aura-warn-bg)', borderColor: 'rgba(246,173,85,0.28)' }}
          >
            <div className="flex items-start gap-3">
              <Timer size={18} style={{ color: 'var(--aura-warn)' }} />
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>
                  Support Mode active for {supportSession.org_name}
                </div>
                <div className="text-xs" style={{ color: 'var(--aura-text2)' }}>
                  Ticket {supportSession.ticket_id} · expires {formatDateTime(supportSession.expires_at)}.
                  Sensitive reads are audited.
                </div>
              </div>
            </div>
            <form action={endSupportSession}>
              <SubmitButton tone="neutral">End Support Mode</SubmitButton>
            </form>
          </div>
        ) : null}
        {children}
      </main>
    </>
  )
}
