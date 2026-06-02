'use client'

import { useState } from 'react'
import { Menu, ShieldCheck, Timer } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { UserMenu } from '@/components/user-menu'
import { SubmitButton } from '@/components/ui'
import { endSupportSession } from '@/lib/actions'
import { formatDateTime } from '@/lib/utils'

interface AdminShellClientProps {
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

export function AdminShellClient({ email, fullName, level, locale, supportSession, children }: AdminShellClientProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <>
      <header
        className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b px-5"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        {/* Left — hamburger (mobile) + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex size-11 items-center justify-center rounded-md transition-colors hover:bg-white/5 md:hidden"
            style={{ color: 'var(--aura-text2)' }}
            aria-label="Open menu"
            type="button"
          >
            <Menu size={18} />
          </button>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'var(--aura-green-bg)', color: 'var(--aura-green)' }}
          >
            <ShieldCheck size={16} />
          </div>
          <div>
            <div className="text-lg font-bold leading-none" style={{ fontFamily: 'var(--font-syne)' }}>
              Aura Admin
            </div>
            <div
              className="hidden text-[10px] sm:block"
              style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}
            >
              PLATFORM CONTROL
            </div>
          </div>
        </div>

        {/* Right — date + user menu */}
        <div className="flex items-center gap-2">
          <span
            className="hidden text-xs lg:block"
            style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}
          >
            {formatDate(new Date())}
          </span>
          <UserMenu
            email={email}
            fullName={fullName}
            level={level}
            currentLocale={locale}
          />
        </div>
      </header>

      <Sidebar open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

      <main className="md:ml-60 mt-14 min-h-[calc(100vh-3.5rem)] p-6">
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
