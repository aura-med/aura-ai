import { Card, Kpi, PageHeader, StatusBadge } from '@/components/ui'
import { MiniBarChart, MiniLineChart } from '@/components/charts'
import { getPlatformAdminHome } from '@/lib/admin-data'

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    return date.toISOString().slice(0, 10)
  })
}

export default async function AnalyticsPage() {
  const { metrics, orgRows, scoreRows } = await getPlatformAdminHome()
  const days = lastSevenDays()
  const riskSeries = days.map((day) => ({
    label: day.slice(5),
    highRisk: scoreRows.filter((score) => score.score_date === day && Number(score.total_score) >= 0.65).length,
  }))
  const orgFreshness = orgRows
    .slice()
    .sort((a, b) => (b.athletes_count ?? 0) - (a.athletes_count ?? 0))
    .slice(0, 8)
    .map((org) => ({
      label: org.name.slice(0, 10),
      athletes: org.athletes_count,
    }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Operational and adoption analytics only. Sensitive clinical rows remain hidden unless Support Mode is active for a scoped organization."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Check-in stale orgs" tone={metrics.staleOrgs ? 'warn' : 'green'} value={metrics.staleOrgs} />
        <Kpi label="High risk score events" tone="warn" value={metrics.highRiskScores} />
        <Kpi label="Notification read rate" tone="blue" value={`${metrics.notificationReadRate}%`} />
        <Kpi label="Missing consent" tone={metrics.missingConsent ? 'danger' : 'green'} value={metrics.missingConsent} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">High risk score events</h2>
              <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>Daily aggregate count, no athlete identity exposed.</p>
            </div>
            <StatusBadge tone="warn">aggregate</StatusBadge>
          </div>
          <MiniLineChart data={riskSeries} dataKey="highRisk" />
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Athlete coverage by organization</h2>
            <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>Largest organizations by active athlete count.</p>
          </div>
          <MiniBarChart data={orgFreshness} dataKey="athletes" />
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Users</th>
              <th>Athletes</th>
              <th>Missing consent</th>
              <th>Freshness</th>
            </tr>
          </thead>
          <tbody>
            {orgRows.map((org) => (
              <tr key={org.id}>
                <td style={{ color: 'var(--aura-text)' }}>{org.name}</td>
                <td>{org.users_count}</td>
                <td>{org.athletes_count}</td>
                <td>{org.missing_consent_count}</td>
                <td>{org.stale_days === null ? 'No data' : `${org.stale_days}d`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
