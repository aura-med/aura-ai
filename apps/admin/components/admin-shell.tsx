import { AdminShellClient } from '@/components/admin-shell-client'
import { formatDateTime } from '@/lib/utils'

interface AdminShellProps {
  email?: string
  fullName?: string | null
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

export function AdminShell({ supportSession, ...rest }: AdminShellProps) {
  const session = supportSession
    ? { ...supportSession, expires_formatted: formatDateTime(supportSession.expires_at) }
    : null
  return <AdminShellClient {...rest} supportSession={session} />
}
