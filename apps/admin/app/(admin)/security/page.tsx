import { Card, Kpi, PageHeader, StatusBadge } from '@/components/ui'
import { getSecurityPageData } from '@/lib/admin-data'
import { formatDateTime } from '@/lib/utils'

export default async function SecurityPage() {
  const { auditLogs, supportSessions, admins } = await getSecurityPageData()
  const activeSessions = supportSessions.filter((session) => session.status === 'active').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Platform-admin registry, audited support sessions, and immutable operational audit events."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Platform admins" tone="blue" value={admins.length} />
        <Kpi label="Active support sessions" tone={activeSessions ? 'warn' : 'green'} value={activeSessions} />
        <Kpi label="Audit events" value={auditLogs.length} />
        <Kpi label="Support sessions" tone="purple" value={supportSessions.length} />
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--aura-border)' }}>
          <h2 className="text-sm font-semibold">Audit log</h2>
        </div>
        <table className="admin-table min-w-[980px]">
          <thead>
            <tr>
              <th>Event</th>
              <th>Target</th>
              <th>Organization</th>
              <th>Support session</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
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
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--aura-border)' }}>
          <h2 className="text-sm font-semibold">Support sessions</h2>
        </div>
        <table className="admin-table min-w-[900px]">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Organization</th>
              <th>Status</th>
              <th>Started</th>
              <th>Expires</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {supportSessions.map((session) => (
              <tr key={session.id}>
                <td style={{ color: 'var(--aura-text)' }}>{session.ticket_id}</td>
                <td>{session.org_name}</td>
                <td><StatusBadge tone={session.status === 'active' ? 'warn' : 'neutral'}>{session.status}</StatusBadge></td>
                <td>{formatDateTime(session.started_at)}</td>
                <td>{formatDateTime(session.expires_at)}</td>
                <td>{session.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
