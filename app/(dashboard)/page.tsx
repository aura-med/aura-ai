import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { calcScore, riskColor, riskLabel, riskLevel } from '@/lib/scoring'
import { ScoreBadge, AlertBox, Sparkline } from '@/components/ui/aura'

async function getData() {
  const supabase = await createClient()
  const { data: athletes } = await supabase
    .from('athletes')
    .select(`*, wellness_checkins(*), performance_data(*), injury_events(*), fatigue_profiles(*), score_history(*)`)
    .eq('active', true)
    .order('shirt_number')

  const { data: squads } = await supabase.from('squads').select('*')
  return { athletes: athletes ?? [], squads: squads ?? [] }
}

export default async function Dashboard() {
  const { athletes, squads } = await getData()

  // Compute scores
  const withScores = athletes.map(a => {
    const latest = (a.wellness_checkins ?? [])
      .sort((x: any, y: any) => new Date(y.checkin_date).getTime() - new Date(x.checkin_date).getTime())[0]
    const perf = (a.performance_data ?? [])
      .sort((x: any, y: any) => new Date(y.session_date).getTime() - new Date(x.session_date).getTime())[0]

    const inputs = {
      history: (a.injury_events ?? []).filter((i: any) => !i.return_date).length >= 2 ? 2
        : (a.injury_events ?? []).length >= 1 ? 1 : 0,
      acwr: null,
      hrv: null,
      fatigue: latest?.fatigue ?? null,
      sleep: latest?.sleep_hours ?? null,
      tqr: latest?.tqr ?? null,
      stress: latest?.stress ?? null,
      decel: null,
      md: null,
    }
    const score = calcScore(inputs)
    const history = (a.score_history ?? [])
      .sort((x: any, y: any) => new Date(x.score_date).getTime() - new Date(y.score_date).getTime())
      .slice(-7)
      .map((s: any) => Math.round(s.total_score * 100))

    return { ...a, computed_score: score, history }
  })

  const available = withScores.filter(a => a.status === 'available')
  const rehab     = withScores.filter(a => a.status === 'rehab')
  const highRisk  = available.filter(a => a.computed_score.score >= 65)
  const avgScore  = available.length > 0
    ? Math.round(available.reduce((s, a) => s + a.computed_score.score, 0) / available.length)
    : 0

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">📊 Dashboard</div>
        <div className="sec-sub">Visão geral do plantel — hoje</div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-num" style={{ color: 'var(--text)' }}>{athletes.length}</div>
          <div className="kpi-label">Atletas convocados</div>
          <div className="kpi-sub">{available.length} disp. · {rehab.length} reab.</div>
        </div>
        <div className="kpi">
          <div className="kpi-num" style={{ color: riskColor(avgScore) }}>{avgScore}%</div>
          <div className="kpi-label">Score médio plantel</div>
          <div className="kpi-sub">{riskLabel(avgScore)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-num" style={{ color: highRisk.length > 0 ? 'var(--danger)' : 'var(--green2)' }}>
            {highRisk.length}
          </div>
          <div className="kpi-label">Alertas risco alto/crítico</div>
          <div className="kpi-sub">Score ≥65%</div>
        </div>
        <div className="kpi">
          <div className="kpi-num" style={{ color: 'var(--blue)' }}>{rehab.length}</div>
          <div className="kpi-label">Em reabilitação</div>
          <div className="kpi-sub">Protocolo activo</div>
        </div>
      </div>

      <div className="g2">
        {/* High risk alerts */}
        <div>
          {highRisk.length > 0 && (
            <div className="card">
              <div className="ctitle">⚠ Atletas em alerta</div>
              {highRisk.map(a => (
                <Link key={a.id} href={`/athlete?id=${a.id}`} style={{ textDecoration: 'none' }}>
                  <div className={`alert ${a.computed_score.score >= 85 ? 'alert-r' : 'alert-w'}`}
                    style={{ cursor: 'pointer' }}>
                    <div className={`adot ${a.computed_score.score >= 85 ? 'ad-r' : 'ad-w'}`} />
                    <div>
                      <strong>{a.name}</strong>
                      {' '}({a.position} · {a.club}) — Score{' '}
                      <strong style={{ color: riskColor(a.computed_score.score) }}>
                        {a.computed_score.score}%
                      </strong>
                      {a.computed_score.dominant_variable && (
                        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                          Variável dominante: {a.computed_score.dominant_variable}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Rehab summary */}
          {rehab.length > 0 && (
            <div className="card">
              <div className="ctitle">🦴 Em reabilitação</div>
              {rehab.map(a => (
                <Link key={a.id} href={`/rehab?id=${a.id}`} style={{ textDecoration: 'none' }}>
                  <div className="ath-card">
                    <div className="ath-avatar">{a.shirt_number}</div>
                    <div className="ath-info">
                      <div className="ath-name">{a.name}</div>
                      <div className="ath-meta">{a.position} · Reabilitação activa</div>
                    </div>
                    <span className="score-badge" style={{ background: 'var(--blue2)', color: 'var(--blue)', borderColor: 'rgba(77,154,255,0.25)' }}>
                      Reab.
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Squad cards */}
        <div className="card">
          <div className="ctitle">Plantel disponível</div>
          {available.map(a => (
            <Link key={a.id} href={`/athlete?id=${a.id}`} style={{ textDecoration: 'none' }}>
              <div className="ath-card">
                <div className="ath-avatar">{a.shirt_number}</div>
                <div className="ath-info">
                  <div className="ath-name">{a.name}</div>
                  <div className="ath-meta">{a.position} · {a.club}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="ath-score" style={{ color: riskColor(a.computed_score.score), fontSize: 18 }}>
                    {a.computed_score.score}%
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text2)', fontFamily: 'var(--mono)', marginBottom: 3 }}>
                    {riskLabel(a.computed_score.score)}
                  </div>
                  {a.history.length > 1 && (
                    <Sparkline data={a.history} color={riskColor(a.computed_score.score)} width={52} height={14} />
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
