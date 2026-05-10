import { ShieldOff, ShieldPlus } from 'lucide-react'
import { Card, EmptyState, FeedbackBanner, Field, inputClassName, inputStyle, Kpi, PageHeader, StatusBadge, SubmitButton } from '@/components/ui'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SearchFilter } from '@/components/search-filter'
import { Pagination } from '@/components/pagination'
import { inviteAdmin, revokeAdmin } from '@/lib/actions'
import { getSecurityPageData, PAGE_SIZE } from '@/lib/admin-data'
import { formatDateTime } from '@/lib/utils'

interface SearchParams {
  type?: string
  page?: string
  success?: string
  error?: string
}

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const { context, auditLogs, totalLogs, auditPage, supportSessions, admins, eligibleUsers } =
    await getSecurityPageData({
      type: sp.type,
      page: sp.page ? Number(sp.page) : 1,
    })

  const activeSessions = supportSessions.filter((s) => s.status === 'active').length
  const isOwner = context.admin.level === 'owner'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Platform-admin registry, audited support sessions, and immutable audit events."
      />

      <FeedbackBanner success={sp.success} error={sp.error} />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Platform admins" tone="blue" value={admins.filter((a) => a.active).length} />
        <Kpi label="Active support sessions" tone={activeSessions ? 'warn' : 'green'} value={activeSessions} />
        <Kpi label="Audit events (filtered)" value={totalLogs} />
        <Kpi label="Support sessions" tone="purple" value={supportSessions.length} />
      </div>

      {/* Admin Registry — owner only */}
      {isOwner && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <ShieldPlus size={15} style={{ color: 'var(--aura-green)' }} />
            <h2 className="text-sm font-semibold">Admin Registry</h2>
          </div>
          <form action={inviteAdmin} className="mb-5 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
            <Field label="User">
              <select className={inputClassName} name="user_id" required style={inputStyle}>
                <option value="">Select a user to promote</option>
                {eligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Level">
              <select className={inputClassName} name="level" style={inputStyle}>
                {['admin', 'support', 'analyst', 'owner'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <SubmitButton>Add admin</SubmitButton>
            </div>
          </form>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Level</th>
                <th>Last seen</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 && <EmptyState message="No platform admins registered." />}
              {admins.map((admin) => (
                <tr key={admin.user_id}>
                  <td style={{ color: 'var(--aura-text)' }}>{admin.email ?? admin.user_id.slice(0, 8)}</td>
                  <td><StatusBadge tone={admin.level === 'owner' ? 'green' : admin.level === 'support' ? 'warn' : 'neutral'}>{admin.level}</StatusBadge></td>
                  <td>{admin.last_seen_at ? formatDateTime(admin.last_seen_at) : 'Never'}</td>
                  <td><StatusBadge tone={admin.active ? 'green' : 'neutral'}>{admin.active ? 'active' : 'revoked'}</StatusBadge></td>
                  <td>
                    {admin.active && admin.user_id !== context.user.id && (
                      <ConfirmDialog
                        title="Revoke admin access?"
                        description={`${admin.email ?? 'This admin'} will immediately lose platform admin access.`}
                        confirmLabel="Revoke"
                        tone="danger"
                        action={revokeAdmin}
                        fields={{ user_id: admin.user_id }}
                        trigger={
                          <SubmitButton tone="neutral">
                            <ShieldOff size={13} /> Revoke
                          </SubmitButton>
                        }
                      />
                    )}
                    {admin.user_id === context.user.id && (
                      <span className="text-xs" style={{ color: 'var(--aura-text3)' }}>You</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Support sessions */}
      <Card className="overflow-x-auto p-0">
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--aura-border)' }}>
          <h2 className="text-sm font-semibold">Support sessions</h2>
        </div>
        <table className="admin-table min-w-[900px]">
          <thead>
            <tr><th>Ticket</th><th>Organization</th><th>Status</th><th>Started</th><th>Expires</th><th>Reason</th></tr>
          </thead>
          <tbody>
            {supportSessions.length === 0 && <EmptyState message="No support sessions." />}
            {supportSessions.map((s) => (
              <tr key={s.id}>
                <td style={{ color: 'var(--aura-text)' }}>{s.ticket_id}</td>
                <td>{s.org_name}</td>
                <td><StatusBadge tone={s.status === 'active' ? 'warn' : 'neutral'}>{s.status}</StatusBadge></td>
                <td>{formatDateTime(s.started_at)}</td>
                <td>{formatDateTime(s.expires_at)}</td>
                <td>{s.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Audit log */}
      <Card className="overflow-x-auto p-0">
        <div className="border-b px-4 py-3 flex items-center justify-between" style={{ borderColor: 'var(--aura-border)' }}>
          <h2 className="text-sm font-semibold">Audit log</h2>
          <SearchFilter
            typeOptions={[
              { value: 'user',         label: 'user.*' },
              { value: 'organization', label: 'organization.*' },
              { value: 'support',      label: 'support.*' },
              { value: 'admin',        label: 'admin.*' },
            ]}
          />
        </div>
        <table className="admin-table min-w-[980px]">
          <thead>
            <tr><th>Event</th><th>Target</th><th>Organization</th><th>Session</th><th>Created</th></tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 && <EmptyState message="No audit events match this filter." />}
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td style={{ color: 'var(--aura-text)' }}>{log.event_type}</td>
                <td>{log.target_type ?? '-'} {log.target_id ? `· ${String(log.target_id).slice(0, 8)}` : ''}</td>
                <td>{log.org_name ?? '-'}</td>
                <td>{log.support_session_id ? <StatusBadge tone="warn">{String(log.support_session_id).slice(0, 8)}</StatusBadge> : '-'}</td>
                <td>{formatDateTime(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={auditPage} total={totalLogs} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  )
}
