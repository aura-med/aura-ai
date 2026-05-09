import Link from 'next/link'
import { LockKeyhole } from 'lucide-react'
import { Card, PageHeader, StatusBadge } from '@/components/ui'
import { getSensitiveOrgDetail } from '@/lib/admin-data'
import { formatDate } from '@/lib/utils'

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getSensitiveOrgDetail(id)

  if (!data.authorized) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Support Mode required"
          description="This page can show sensitive organization-specific data. Start Support Mode for this organization from the overview page first."
        />
        <Card>
          <div className="flex items-start gap-3">
            <LockKeyhole size={20} style={{ color: 'var(--aura-warn)' }} />
            <div>
              <div className="text-sm font-semibold">Sensitive detail locked</div>
              <p className="mt-1 text-sm" style={{ color: 'var(--aura-text2)' }}>
                Platform admins see aggregate data by default. Scoped sensitive inspection requires a ticketed,
                timeboxed support session and every read is audited.
              </p>
              <Link className="mt-4 inline-flex min-h-10 items-center rounded-md px-3 text-sm font-semibold" href="/" style={{ background: 'var(--aura-green)', color: 'var(--aura-bg)' }}>
                Start Support Mode
              </Link>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.organization?.name ?? 'Organization detail'}
        description="Scoped support inspection view. This sensitive read has been written to the platform audit log."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-x-auto p-0">
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--aura-border)' }}>
            <h2 className="text-sm font-semibold">Athletes</h2>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Position</th>
                <th>Status</th>
                <th>Consent</th>
              </tr>
            </thead>
            <tbody>
              {data.athletes.map((athlete) => (
                <tr key={athlete.id}>
                  <td style={{ color: 'var(--aura-text)' }}>{athlete.name}</td>
                  <td>{athlete.position ?? '-'}</td>
                  <td><StatusBadge tone={athlete.active ? 'green' : 'neutral'}>{athlete.status}</StatusBadge></td>
                  <td>{athlete.consent_date ? formatDate(athlete.consent_date) : <StatusBadge tone="danger">missing</StatusBadge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="overflow-x-auto p-0">
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--aura-border)' }}>
            <h2 className="text-sm font-semibold">Organization users</h2>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id}>
                  <td style={{ color: 'var(--aura-text)' }}>{user.full_name ?? 'Unnamed user'}</td>
                  <td><StatusBadge tone={user.role === 'admin' ? 'green' : 'neutral'}>{user.role ?? '-'}</StatusBadge></td>
                  <td>{formatDate(user.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
