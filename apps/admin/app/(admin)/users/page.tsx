import { Ban, MailPlus, RefreshCw } from 'lucide-react'
import { Card, EmptyState, FeedbackBanner, Field, inputClassName, inputStyle, Kpi, PageHeader, StatusBadge, SubmitButton } from '@/components/ui'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SearchFilter } from '@/components/search-filter'
import { Pagination } from '@/components/pagination'
import { disableUser, enableUser, inviteUser, updateUserRole } from '@/lib/actions'
import { getUsersPageData, PAGE_SIZE } from '@/lib/admin-data'
import { formatDateTime } from '@/lib/utils'

const ROLES = ['admin', 'doctor', 'physio', 'coach', 'fitness_coach', 'athlete']

interface SearchParams {
  q?: string
  status?: string
  role?: string
  page?: string
  success?: string
  error?: string
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const { users, total, page, organizations } = await getUsersPageData({
    q:      sp.q,
    status: sp.status,
    role:   sp.role,
    page:   sp.page ? Number(sp.page) : 1,
  })

  const pending  = users.filter((u) => u.invited_at && !u.last_sign_in_at).length
  const disabled = users.filter((u) => u.disabled).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Access"
        description="Invite organization users, change roles, and manage access. Platform admin status is managed in Security."
      />

      <FeedbackBanner success={sp.success} error={sp.error} />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Profiles (filtered)" value={total} />
        <Kpi label="Pending invites" tone="warn" value={pending} />
        <Kpi label="Disabled" tone={disabled ? 'danger' : 'green'} value={disabled} />
        <Kpi label="Organizations" tone="blue" value={organizations.length} />
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <MailPlus size={15} style={{ color: 'var(--aura-green)' }} />
          <h2 className="text-sm font-semibold">Invite user</h2>
        </div>
        <form action={inviteUser} className="grid gap-3 lg:grid-cols-[1fr_1fr_180px_160px_auto]">
          <Field label="Email">
            <input className={inputClassName} name="email" required style={inputStyle} type="email" />
          </Field>
          <Field label="Full name">
            <input className={inputClassName} name="full_name" style={inputStyle} />
          </Field>
          <Field label="Organization">
            <select className={inputClassName} name="org_id" required style={inputStyle}>
              <option value="">Select</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Role">
            <select className={inputClassName} name="role" required style={inputStyle}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <div className="flex items-end">
            <SubmitButton>Invite</SubmitButton>
          </div>
        </form>
      </Card>

      <SearchFilter
        placeholder="Search by name, email, or org…"
        statusOptions={[
          { value: 'active',   label: 'Active' },
          { value: 'invited',  label: 'Invited' },
          { value: 'disabled', label: 'Disabled' },
        ]}
        roleOptions={ROLES.map((r) => ({ value: r, label: r }))}
      />

      <Card className="overflow-x-auto p-0">
        <table className="admin-table min-w-[1040px]">
          <thead>
            <tr>
              <th>User</th>
              <th>Organization</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last sign-in</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && <EmptyState message="No users match these filters." />}
            {users.map((user) => {
              const isPending = user.invited_at && !user.last_sign_in_at
              return (
                <tr key={user.id}>
                  <td>
                    <div className="font-medium" style={{ color: 'var(--aura-text)' }}>
                      {user.full_name ?? user.email ?? 'Unnamed'}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--aura-text3)' }}>
                      {user.email ?? user.id.slice(0, 8)}
                    </div>
                  </td>
                  <td>{user.org_name ?? '-'}</td>
                  <td>
                    <form action={updateUserRole} className="flex items-center gap-1">
                      <input type="hidden" name="user_id" value={user.id} />
                      <input type="hidden" name="org_id" value={user.org_id ?? ''} />
                      <select
                        className={inputClassName}
                        name="role"
                        defaultValue={user.role ?? ''}
                        style={{ ...inputStyle, fontSize: '11px', padding: '2px 6px' }}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button
                        className="min-h-7 rounded px-2 text-xs hover:bg-white/5"
                        style={{ color: 'var(--aura-green)' }}
                        type="submit"
                        title="Save role"
                      >
                        ✓
                      </button>
                    </form>
                  </td>
                  <td>
                    {user.disabled ? (
                      <StatusBadge tone="danger">disabled</StatusBadge>
                    ) : isPending ? (
                      <StatusBadge tone="warn">invited</StatusBadge>
                    ) : (
                      <StatusBadge tone="green">active</StatusBadge>
                    )}
                  </td>
                  <td>{user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : '-'}</td>
                  <td>
                    {user.disabled ? (
                      <ConfirmDialog
                        title="Re-enable user?"
                        description={`This will restore access for ${user.email ?? 'this user'}.`}
                        confirmLabel="Re-enable"
                        tone="warn"
                        action={enableUser}
                        fields={{ user_id: user.id, org_id: user.org_id ?? '' }}
                        trigger={
                          <SubmitButton tone="neutral">
                            <RefreshCw size={13} /> Enable
                          </SubmitButton>
                        }
                      />
                    ) : (
                      <ConfirmDialog
                        title="Disable user?"
                        description={`${user.email ?? 'This user'} will lose access immediately.`}
                        confirmLabel="Disable"
                        tone="danger"
                        action={disableUser}
                        fields={{ user_id: user.id, org_id: user.org_id ?? '' }}
                        trigger={
                          <SubmitButton tone="neutral">
                            <Ban size={13} /> Disable
                          </SubmitButton>
                        }
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  )
}
