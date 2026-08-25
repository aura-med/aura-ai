import Link from 'next/link'
import { AlertTriangle, ArrowRight, Building2, Clock3, UserPlus, Users } from 'lucide-react'
import { Card, Field, inputClassName, inputStyle, Kpi, PageHeader, StatusBadge, SubmitButton } from '@/components/ui'
import { startSupportSession } from '@/lib/actions'
import { getPlatformAdminHome } from '@/lib/admin-data'
import { formatDateTime } from '@/lib/utils'

export default async function OverviewPage() {
  const { metrics, orgRows, recentAudit, recentNotifications } = await getPlatformAdminHome()
  const staleOrgs = orgRows.filter((org) => org.stale_days === null || org.stale_days > 3).slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Aggregate operational health for Sophi organizations, users, data freshness, consent coverage, notifications, and support activity."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Organizations" sub={`${metrics.activeOrganizations} active`} value={metrics.organizations} />
        <Kpi label="Active users" sub="Signed in during last 7 days" tone="blue" value={metrics.activeUsers} />
        <Kpi label="Pending invites" sub="Auth invitations not accepted" tone="warn" value={metrics.pendingInvites} />
        <Kpi label="Missing consent" sub="Active athletes without consent" tone={metrics.missingConsent ? 'danger' : 'green'} value={metrics.missingConsent} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--sophi-text)' }}>Operational queue</h2>
              <p className="text-xs" style={{ color: 'var(--sophi-text3)' }}>Aggregate warnings that need platform attention.</p>
            </div>
            <StatusBadge tone={metrics.staleOrgs ? 'warn' : 'green'}>{metrics.staleOrgs} stale orgs</StatusBadge>
          </div>
          <div className="space-y-2">
            {staleOrgs.length ? staleOrgs.map((org) => (
              <div
                className="flex items-center justify-between rounded-lg border px-3 py-2"
                key={org.id}
                style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border)' }}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle size={15} style={{ color: 'var(--sophi-warn)' }} />
                  <div>
                    <div className="text-sm" style={{ color: 'var(--sophi-text)' }}>{org.name}</div>
                    <div className="text-xs" style={{ color: 'var(--sophi-text3)' }}>
                      Last check-in data: {org.last_data_at ? formatDateTime(org.last_data_at) : 'none'}
                    </div>
                  </div>
                </div>
                <Link className="text-xs font-semibold" href={`/organizations/${org.id}`} style={{ color: 'var(--sophi-green)' }}>
                  Inspect
                </Link>
              </div>
            )) : (
              <div className="rounded-lg border p-5 text-sm" style={{ color: 'var(--sophi-text2)', borderColor: 'var(--sophi-border)' }}>
                No stale organization data detected.
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--sophi-text)' }}>Start Support Mode</h2>
            <p className="text-xs" style={{ color: 'var(--sophi-text3)' }}>
              Requires organization scope, ticket ID, and reason. Expires after 30 minutes.
            </p>
          </div>
          <form action={startSupportSession} className="space-y-3">
            <Field label="Organization">
              <select className={inputClassName} name="org_id" required style={inputStyle}>
                <option value="">Select organization</option>
                {orgRows.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Ticket ID">
              <input className={inputClassName} name="ticket_id" placeholder="SUP-1234" required style={inputStyle} />
            </Field>
            <Field label="Reason">
              <textarea className={inputClassName} name="reason" placeholder="Investigating a customer support request" required rows={3} style={inputStyle} />
            </Field>
            <SubmitButton>Start audited session</SubmitButton>
          </form>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Clock3 size={15} style={{ color: 'var(--sophi-blue)' }} />
            <h2 className="text-sm font-semibold">Recent audit events</h2>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Target</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.map((event) => (
                <tr key={event.id}>
                  <td>{event.event_type}</td>
                  <td>{event.target_type ?? '-'}</td>
                  <td>{formatDateTime(event.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Building2 size={15} style={{ color: 'var(--sophi-purple)' }} />
            <h2 className="text-sm font-semibold">Notification health</h2>
            <StatusBadge tone="blue">{metrics.notificationReadRate}% read</StatusBadge>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Org</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentNotifications.map((notification) => (
                <tr key={notification.id}>
                  <td>{notification.type}</td>
                  <td>{notification.org_id?.slice(0, 8) ?? '-'}</td>
                  <td>{formatDateTime(notification.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Profiles" value={metrics.users} />
        <Kpi label="Athletes" tone="purple" value={metrics.athletes} />
        <Kpi label="High risk scores" tone="warn" value={metrics.highRiskScores} />
        <Kpi label="Platform admins" tone="blue" value={metrics.supportAdmins} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold" href="/organizations" style={{ background: 'var(--sophi-bg3)', color: 'var(--sophi-text)' }}>
          <Building2 size={15} /> Organizations <ArrowRight size={14} />
        </Link>
        <Link className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold" href="/users" style={{ background: 'var(--sophi-bg3)', color: 'var(--sophi-text)' }}>
          <Users size={15} /> Users <ArrowRight size={14} />
        </Link>
        <Link className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold" href="/users" style={{ background: 'var(--sophi-green)', color: 'var(--sophi-bg)' }}>
          <UserPlus size={15} /> Invite user
        </Link>
      </div>
    </div>
  )
}
