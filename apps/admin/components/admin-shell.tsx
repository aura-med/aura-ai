import { AdminShellClient } from '@/components/admin-shell-client'

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

export function AdminShell(props: AdminShellProps) {
  return <AdminShellClient {...props} />
}
