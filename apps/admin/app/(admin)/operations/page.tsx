import Link from 'next/link'
import { Activity, AlertTriangle } from 'lucide-react'
import { Card, Kpi, PageHeader, StatusBadge } from '@/components/ui'
import { getPlatformAdminHome } from '@/lib/admin-data'
import { formatDateTime } from '@/lib/utils'

export default async function OperationsPage() {
  const { metrics, orgRows, recentNotifications } = await getPlatformAdminHome()
  const stale = orgRows.filter((org) => org.stale_days === null || org.stale_days > 3)
  const consentIssues = orgRows.filter((org) => org.missing_consent_count > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations"
        description="Queues for platform health: stale data, consent gaps, notification delivery signals, and organization status issues."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Stale organizations" tone={stale.length ? 'warn' : 'green'} value={stale.length} />
        <Kpi label="Consent queues" tone={consentIssues.length ? 'danger' : 'green'} value={consentIssues.length} />
        <Kpi label="Recent notifications" tone="blue" value={recentNotifications.length} />
        <Kpi label="Pending invites" tone="warn" value={metrics.pendingInvites} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={15} style={{ color: 'var(--aura-warn)' }} />
            <h2 className="text-sm font-semibold">Stale data queue</h2>
          </div>
          <div className="space-y-2">
            {stale.map((org) => (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2" key={org.id} style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border)' }}>
                <div>
                  <div className="text-sm" style={{ color: 'var(--aura-text)' }}>{org.name}</div>
                  <div className="text-xs" style={{ color: 'var(--aura-text3)' }}>{org.last_data_at ? formatDateTime(org.last_data_at) : 'No check-ins found'}</div>
                </div>
                <Link href={`/organizations/${org.id}`} style={{ color: 'var(--aura-green)' }} className="text-xs font-semibold">Open</Link>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Activity size={15} style={{ color: 'var(--aura-blue)' }} />
            <h2 className="text-sm font-semibold">Consent queue</h2>
          </div>
          <div className="space-y-2">
            {consentIssues.map((org) => (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2" key={org.id} style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border)' }}>
                <div>
                  <div className="text-sm" style={{ color: 'var(--aura-text)' }}>{org.name}</div>
                  <div className="text-xs" style={{ color: 'var(--aura-text3)' }}>{org.missing_consent_count} active athletes missing consent</div>
                </div>
                <StatusBadge tone="danger">{org.missing_consent_count}</StatusBadge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
