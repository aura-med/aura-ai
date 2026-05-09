import Link from 'next/link'
import { Eye, PauseCircle, PlayCircle } from 'lucide-react'
import { Card, Kpi, PageHeader, StatusBadge, SubmitButton } from '@/components/ui'
import { updateOrganizationStatus } from '@/lib/actions'
import { getOrganizationsPageData } from '@/lib/admin-data'
import { formatDateTime } from '@/lib/utils'

function statusTone(status: string) {
  if (status === 'active') return 'green'
  if (status === 'suspended') return 'warn'
  return 'neutral'
}

export default async function OrganizationsPage() {
  const { orgRows } = await getOrganizationsPageData()
  const active = orgRows.filter((org) => org.status === 'active').length
  const suspended = orgRows.filter((org) => org.status === 'suspended').length
  const missingConsent = orgRows.reduce((sum, org) => sum + org.missing_consent_count, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Manage organization status, plans, modules, aggregate user counts, athlete counts, consent coverage, and data freshness."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Total organizations" value={orgRows.length} />
        <Kpi label="Active" tone="green" value={active} />
        <Kpi label="Suspended" tone="warn" value={suspended} />
        <Kpi label="Missing consent" tone={missingConsent ? 'danger' : 'green'} value={missingConsent} />
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="admin-table min-w-[980px]">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Users</th>
              <th>Athletes</th>
              <th>Missing consent</th>
              <th>Last data</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgRows.map((org) => (
              <tr key={org.id}>
                <td>
                  <div className="font-medium" style={{ color: 'var(--aura-text)' }}>{org.name}</div>
                  <div className="text-xs" style={{ color: 'var(--aura-text3)' }}>{org.type} · {org.id.slice(0, 8)}</div>
                </td>
                <td><StatusBadge tone={statusTone(org.status)}>{org.status}</StatusBadge></td>
                <td>{org.plan}</td>
                <td>{org.users_count}</td>
                <td>{org.athletes_count}</td>
                <td>
                  <StatusBadge tone={org.missing_consent_count ? 'danger' : 'green'}>{org.missing_consent_count}</StatusBadge>
                </td>
                <td>{org.last_data_at ? formatDateTime(org.last_data_at) : 'No data'}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-xs font-semibold"
                      href={`/organizations/${org.id}`}
                      style={{ background: 'var(--aura-bg3)', color: 'var(--aura-text)' }}
                    >
                      <Eye size={13} /> Detail
                    </Link>
                    <form action={updateOrganizationStatus}>
                      <input name="org_id" type="hidden" value={org.id} />
                      <input name="status" type="hidden" value={org.status === 'active' ? 'suspended' : 'active'} />
                      <SubmitButton tone={org.status === 'active' ? 'neutral' : 'green'}>
                        {org.status === 'active' ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
                        {org.status === 'active' ? 'Suspend' : 'Activate'}
                      </SubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
