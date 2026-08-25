import { Card, PageHeader, StatusBadge } from '@/components/ui'

const settings = [
  ['Support Mode TTL', '30 minutes', 'warn'],
  ['Sensitive data default', 'Aggregate only', 'green'],
  ['Admin deployment', 'admin.<sophi-domain>', 'blue'],
  ['MFA requirement', 'Required before production', 'warn'],
  ['Service role exposure', 'Server only', 'green'],
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Global platform-administration defaults. This first implementation keeps settings visible and codified; editable feature flags can be added after rollout."
      />

      <Card className="overflow-x-auto p-0">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Value</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {settings.map(([label, value, tone]) => (
              <tr key={label}>
                <td style={{ color: 'var(--sophi-text)' }}>{label}</td>
                <td>{value}</td>
                <td><StatusBadge tone={tone as 'green' | 'blue' | 'warn'}>configured</StatusBadge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
