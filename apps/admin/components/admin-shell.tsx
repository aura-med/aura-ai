import { ShieldCheck, Timer, UserCircle } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { endSupportSession, signOut } from '@/lib/actions'
import { SubmitButton } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'

interface AdminShellProps {
  email?: string
  level: string
  supportSession: null | {
    id: string
    org_name: string
    ticket_id: string
    reason: string
    expires_at: string
  }
  children: React.ReactNode
}

export function AdminShell({ email, level, supportSession, children }: AdminShellProps) {
  return (
    <>
      <header
        className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b px-5"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'var(--aura-green-bg)', color: 'var(--aura-green)' }}
          >
            <ShieldCheck size={16} />
          </div>
          <div>
            <div
              className="text-lg font-bold leading-none"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Aura Admin
            </div>
            <div className="text-[10px]" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
              PLATFORM CONTROL
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-right sm:flex">
            <UserCircle size={16} style={{ color: 'var(--aura-text3)' }} />
            <div>
              <div className="text-xs" style={{ color: 'var(--aura-text2)' }}>{email ?? 'Aura admin'}</div>
              <div className="text-[10px] uppercase" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
                {level}
              </div>
            </div>
          </div>
          <form action={signOut}>
            <button
              className="min-h-9 rounded-md px-3 text-sm hover:bg-white/5"
              style={{ color: 'var(--aura-text2)' }}
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <Sidebar />
      <main className="ml-60 mt-14 min-h-[calc(100vh-3.5rem)] p-6">
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
                  Ticket {supportSession.ticket_id} expires {formatDateTime(supportSession.expires_at)}. Sensitive reads are audited.
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
