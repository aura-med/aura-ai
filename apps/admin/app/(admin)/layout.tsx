import { AdminShell } from '@/components/admin-shell'
import { getActiveSupportSession } from '@/lib/admin-data'
import { requirePlatformAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePlatformAdmin()
  const activeSupportSession = await getActiveSupportSession(context.user.id)

  return (
    <AdminShell
      email={context.user.email}
      fullName={context.user.fullName}
      level={context.admin.level}
      supportSession={activeSupportSession}
    >
      {children}
    </AdminShell>
  )
}
