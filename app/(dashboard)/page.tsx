import { createClient } from '@/lib/supabase/server'
import { ScoreBadge } from '@/components/athlete/ScoreBadge'
import { scoreToRisk } from '@/lib/utils'
import { AlertTriangle, Users, Activity, Calendar, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, shirt_number, position, status')
    .eq('active', true)
    .order('shirt_number')

  const { data: recentScores } = await supabase
    .from('score_history')
    .select('athlete_id, total_score, confidence, score_date')
    .gte('score_date', new Date(Date.now() - 86400000).toISOString().split('T')[0])
    .order('total_score', { ascending: false })
    .limit(50)

  const totalAthletes = athletes?.length ?? 0
  const rehab = athletes?.filter((a) => a.status === 'rehab').length ?? 0
  const highRisk = recentScores?.filter((s) => s.total_score >= 0.65).length ?? 0
  const critical = recentScores?.filter((s) => s.total_score >= 0.85).length ?? 0

  const topAlerts = recentScores
    ?.filter((s) => s.total_score >= 0.65)
    .slice(0, 5) ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
        >
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--aura-text2)' }}>
          Visão geral da saúde e risco do plantel
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Plantel"
          value={totalAthletes}
          icon={<Users size={16} />}
          color="var(--aura-blue)"
        />
        <KpiCard
          label="Em Reabilitação"
          value={rehab}
          icon={<Activity size={16} />}
          color="var(--aura-warn)"
        />
        <KpiCard
          label="Risco Alto"
          value={highRisk}
          icon={<TrendingUp size={16} />}
          color="#ff9330"
        />
        <KpiCard
          label="Risco Crítico"
          value={critical}
          icon={<AlertTriangle size={16} />}
          color="var(--aura-danger)"
        />
      </div>

      {/* Alerts + Recent Scores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top alerts */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
        >
          <h2
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: 'var(--aura-text)' }}
          >
            <AlertTriangle size={14} style={{ color: 'var(--aura-danger)' }} />
            Alertas de Atenção
          </h2>
          {topAlerts.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
              Sem alertas activos hoje.
            </p>
          ) : (
            <ul className="space-y-3">
              {topAlerts.map((s) => {
                const score = Math.round(s.total_score * 100)
                const level = scoreToRisk(score)
                const athlete = athletes?.find((a) => a.id === s.athlete_id)
                return (
                  <li
                    key={s.athlete_id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                    style={{ borderColor: 'var(--aura-border)' }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>
                        {athlete?.name ?? s.athlete_id}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>
                        {athlete?.position} · {s.score_date}
                      </p>
                    </div>
                    <ScoreBadge score={score} level={level} size="sm" />
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Upcoming placeholder */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
        >
          <h2
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: 'var(--aura-text)' }}
          >
            <Calendar size={14} style={{ color: 'var(--aura-blue)' }} />
            Próximos Eventos
          </h2>
          <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
            Configure o calendário da equipa para ver os próximos jogos e treinos.
          </p>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs" style={{ color: 'var(--aura-text2)' }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <p
        className="text-3xl font-bold font-mono"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  )
}
