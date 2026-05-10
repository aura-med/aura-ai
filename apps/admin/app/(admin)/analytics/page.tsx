import Link from 'next/link'
import { Card, Kpi, PageHeader, StatusBadge } from '@/components/ui'
import { MiniBarChart, MiniLineChart } from '@/components/charts'
import { getAnalyticsData } from '@/lib/admin-data'

const RANGES = [
  { value: '7',  label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
]

interface SearchParams {
  range?: string
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp    = await searchParams
  const range = Number(sp.range ?? 7)
  const { metrics, riskSeries, signupSeries, orgFreshness, orgRows } = await getAnalyticsData(range)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Analytics"
          description="Operational and adoption analytics. Sensitive clinical data is hidden unless Support Mode is active."
        />
        <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--aura-border)' }}>
          {RANGES.map((r) => (
            <Link
              key={r.value}
              href={`/analytics?range=${r.value}`}
              className="min-h-8 rounded-md px-3 text-xs font-medium"
              style={
                String(range) === r.value
                  ? { background: 'var(--aura-green-bg)', color: 'var(--aura-green)' }
                  : { color: 'var(--aura-text2)' }
              }
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Active orgs" tone={metrics.staleOrgs ? 'warn' : 'green'} value={metrics.staleOrgs} />
        <Kpi label="High risk events" tone="warn" value={metrics.highRiskScores} />
        <Kpi label="Notification read rate" tone="blue" value={`${metrics.notificationReadRate}%`} />
        <Kpi label="Missing consent" tone={metrics.missingConsent ? 'danger' : 'green'} value={metrics.missingConsent} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">High risk score events</h2>
              <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>Daily aggregate — no athlete identity exposed.</p>
            </div>
            <StatusBadge tone="warn">aggregate</StatusBadge>
          </div>
          <MiniLineChart data={riskSeries} dataKey="highRisk" />
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Cumulative user signups</h2>
            <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>Total profiles over time.</p>
          </div>
          <MiniLineChart data={signupSeries} dataKey="signups" />
        </Card>
      </div>

      <Card>
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Athlete coverage by organization</h2>
          <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>Largest organizations by active athlete count.</p>
        </div>
        <MiniBarChart data={orgFreshness} dataKey="athletes" />
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Users</th>
              <th>Athletes</th>
              <th>Missing consent</th>
            </tr>
          </thead>
          <tbody>
            {orgRows.map((org) => (
              <tr key={org.id}>
                <td style={{ color: 'var(--aura-text)' }}>{org.name}</td>
                <td>{org.users_count}</td>
                <td>{org.athletes_count}</td>
                <td>{org.missing_consent_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
