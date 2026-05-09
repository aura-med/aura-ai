import { Ban, MailPlus } from 'lucide-react'
import { Card, Field, inputClassName, inputStyle, Kpi, PageHeader, StatusBadge, SubmitButton } from '@/components/ui'
import { disableUser, inviteUser } from '@/lib/actions'
import { getUsersPageData } from '@/lib/admin-data'
import { formatDateTime } from '@/lib/utils'

export default async function UsersPage() {
  const { users, organizations } = await getUsersPageData()
  const pending = users.filter((user) => user.invited_at && !user.last_sign_in_at).length
  const disabled = users.filter((user) => user.disabled).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Access"
        description="Invite organization users, review roles, and disable access. Platform admin status is managed separately in the private admin registry."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Profiles" value={users.length} />
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
              {['admin', 'doctor', 'physio', 'coach', 'fitness_coach', 'athlete'].map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <SubmitButton>Invite</SubmitButton>
          </div>
        </form>
      </Card>

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
            {users.map((user) => {
              const isPending = user.invited_at && !user.last_sign_in_at
              return (
                <tr key={user.id}>
                  <td>
                    <div className="font-medium" style={{ color: 'var(--aura-text)' }}>{user.full_name ?? user.email ?? 'Unnamed user'}</div>
                    <div className="text-xs" style={{ color: 'var(--aura-text3)' }}>{user.email ?? user.id.slice(0, 8)}</div>
                  </td>
                  <td>{user.org_name ?? '-'}</td>
                  <td><StatusBadge tone={user.role === 'admin' ? 'green' : 'neutral'}>{user.role ?? '-'}</StatusBadge></td>
                  <td>
                    {user.disabled ? <StatusBadge tone="danger">disabled</StatusBadge> : isPending ? <StatusBadge tone="warn">invited</StatusBadge> : <StatusBadge tone="green">active</StatusBadge>}
                  </td>
                  <td>{user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : '-'}</td>
                  <td>
                    <form action={disableUser}>
                      <input name="user_id" type="hidden" value={user.id} />
                      <input name="org_id" type="hidden" value={user.org_id ?? ''} />
                      <SubmitButton tone="neutral">
                        <Ban size={13} /> Disable
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
