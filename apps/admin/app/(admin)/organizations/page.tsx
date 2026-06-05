import Link from 'next/link'
import { Eye, PauseCircle, PlayCircle } from 'lucide-react'
import { Card, EmptyState, FeedbackBanner, Field, inputClassName, inputStyle, Kpi, PageHeader, StatusBadge, SubmitButton } from '@/components/ui'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SearchFilter } from '@/components/search-filter'
import { Pagination } from '@/components/pagination'
import { createOrganization, updateOrganizationStatus } from '@/lib/actions'
import { getOrganizationsPageData, PAGE_SIZE } from '@/lib/admin-data'
import { formatDateTime } from '@/lib/utils'

function statusTone(status: string) {
  if (status === 'active')    return 'green'
  if (status === 'suspended') return 'warn'
  return 'neutral'
}

interface SearchParams {
  q?: string
  status?: string
  page?: string
  success?: string
  error?: string
}

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const { orgRows, total, page, summary } = await getOrganizationsPageData({
    q:      sp.q,
    status: sp.status,
    page:   sp.page ? Number(sp.page) : 1,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Manage organization status, plans, modules, and data health."
      />

      <FeedbackBanner success={sp.success} error={sp.error} />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Total" value={summary.total} />
        <Kpi label="Active" tone="green" value={summary.active} />
        <Kpi label="Suspended" tone="warn" value={summary.suspended} />
        <Kpi label="Missing consent" tone={summary.missingConsent ? 'danger' : 'green'} value={summary.missingConsent} />
      </div>

      {/* Create organization */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>
          Create organization
        </h2>
        <form action={createOrganization} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name">
              <input className={inputClassName} name="name" required style={inputStyle} />
            </Field>
            <Field label="Type">
              <select className={inputClassName} name="type" style={inputStyle}>
                <option value="club">Club</option>
                <option value="federation">Federation</option>
              </select>
            </Field>
            <Field label="Plan">
              <select className={inputClassName} name="plan" style={inputStyle}>
                <option value="trial">Trial</option>
                <option value="standard">Standard</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--aura-text2)' }}>
            {['readiness', 'rehab', 'performance', 'female_squad', 'passport'].map((mod) => (
              <label key={mod} className="flex items-center gap-2 cursor-pointer">
                <input defaultChecked name={mod} type="checkbox" value="on" />
                {mod.replace('_', ' ')}
              </label>
            ))}
          </div>
          <SubmitButton>Create organization</SubmitButton>
        </form>
      </Card>

      <SearchFilter
        placeholder="Search organizations…"
        statusOptions={[
          { value: 'active',    label: 'Active' },
          { value: 'suspended', label: 'Suspended' },
          { value: 'archived',  label: 'Archived' },
        ]}
      />

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
            {orgRows.length === 0 && <EmptyState message="No organizations match these filters." />}
            {orgRows.map((org) => (
              <tr key={org.id}>
                <td>
                  <div className="font-medium" style={{ color: 'var(--aura-text)' }}>{org.name}</div>
                  <div className="text-xs" style={{ color: 'var(--aura-text3)' }}>{org.type}</div>
                </td>
                <td><StatusBadge tone={statusTone(org.status)}>{org.status}</StatusBadge></td>
                <td>{org.plan}</td>
                <td>{org.users_count}</td>
                <td>{org.athletes_count}</td>
                <td>
                  <StatusBadge tone={org.missing_consent_count ? 'danger' : 'green'}>
                    {org.missing_consent_count}
                  </StatusBadge>
                </td>
                <td>{org.last_data_at ? formatDateTime(org.last_data_at) : 'No data'}</td>
                <td className="flex flex-wrap gap-1">
                  <Link
                    className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs hover:bg-white/5"
                    href={`/organizations/${org.id}`}
                    style={{ color: 'var(--aura-blue)' }}
                  >
                    <Eye size={13} /> Detail
                  </Link>
                  {org.status === 'active' ? (
                    <ConfirmDialog
                      title="Suspend organization?"
                      description={`${org.name} users will lose access. You can re-activate at any time.`}
                      confirmLabel="Suspend"
                      tone="warn"
                      action={updateOrganizationStatus}
                      fields={{ org_id: org.id, status: 'suspended' }}
                      trigger={
                        <SubmitButton tone="neutral">
                          <PauseCircle size={13} /> Suspend
                        </SubmitButton>
                      }
                    />
                  ) : org.status === 'suspended' ? (
                    <ConfirmDialog
                      title="Re-activate organization?"
                      description={`${org.name} will regain full access.`}
                      confirmLabel="Activate"
                      tone="warn"
                      action={updateOrganizationStatus}
                      fields={{ org_id: org.id, status: 'active' }}
                      trigger={
                        <SubmitButton tone="neutral">
                          <PlayCircle size={13} /> Activate
                        </SubmitButton>
                      }
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  )
}
