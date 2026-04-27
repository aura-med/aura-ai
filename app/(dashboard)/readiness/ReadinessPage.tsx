import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { calcScore, riskColor, riskLevel, getReadiness } from '@/lib/scoring'
import { ScoreBadge } from '@/components/ui/aura'
import type { ReadinessIndicator } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const READINESS_COLORS = {
  green: 'var(--green2)', amber: 'var(--warn)', red: 'var(--danger)', grey: 'var(--text3)'
}
const READINESS_LABELS = {
  green: 'Pronto', amber: 'Precaução', red: 'Limitado', grey: 'Sem dados'
}

export default async function ReadinessPage() {
  const { data: athletes } = await supabase
    .from('athletes')
    .select(`*, wellness_checkins(*), performance_data(*), injury_events(*), athlete_passport(*)`)
    .eq('active', true).eq('status', 'available').order('shirt_number')

  const withData = (athletes ?? []).map((a: any) => {
    const latest = (a.wellness_checkins ?? [])
      .sort((x: any, y: any) => new Date(y.checkin_date).getTime() - new Date(x.checkin_date).getTime())[0]
    const perf = (a.performance_data ?? [])
      .sort((x: any, y: any) => new Date(y.session_date).getTime() - new Date(x.session_date).getTime())[0]
    const passport = a.athlete_passport?.[0]

    const inputs = {
      history: (a.injury_events ?? []).length >= 2 ? 2 : (a.injury_events ?? []).length >= 1 ? 1 : 0,
      acwr: null, hrv: null,
      fatigue: latest?.fatigue ?? null,
      sleep: latest?.sleep_hours ?? null,
      tqr: latest?.tqr ?? null,
      stress: latest?.stress ?? null,
      decel: null, md: null,
    }
    const score = calcScore(inputs)
    const readiness = getReadiness({
      wellness: latest,
      perf,
      hrv_baseline_ms: passport?.passport_data?.hrv_baseline_ms ?? null,
    })
    return { ...a, score, readiness }
  })

  const green = withData.filter(a => a.readiness.overall === 'green').length
  const amber = withData.filter(a => a.readiness.overall === 'amber').length
  const red   = withData.filter(a => a.readiness.overall === 'red').length

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">🟢 Prontidão de Performance</div>
        <div className="sec-sub">Semáforo de 4 indicadores · Indicativo — não preditivo</div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-num" style={{ color: 'var(--green2)' }}>{green}</div><div className="kpi-label">Prontos</div></div>
        <div className="kpi"><div className="kpi-num" style={{ color: 'var(--warn)' }}>{amber}</div><div className="kpi-label">Precaução</div></div>
        <div className="kpi"><div className="kpi-num" style={{ color: 'var(--danger)' }}>{red}</div><div className="kpi-label">Limitados</div></div>
        <div className="kpi"><div className="kpi-num" style={{ color: 'var(--text)' }}>{withData.length}</div><div className="kpi-label">Total disponíveis</div></div>
      </div>

      <div className="alert alert-b" style={{ marginBottom: 16 }}>
        <div className="adot ad-b" />
        <div style={{ fontSize: 12 }}>
          <strong>Nota metodológica:</strong> O painel de prontidão é uma síntese de 4 indicadores de recuperação.
          Não é um modelo preditivo de performance. Em semanas com dois jogos a confiança é reduzida.
          Utilizar como apoio à decisão, não como substituto do julgamento clínico.
        </div>
      </div>

      <div className="card">
        <div className="ctitle">Estado do plantel — hoje</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Atleta</th>
              <th style={{ textAlign: 'center' }}>Risco lesão</th>
              <th style={{ textAlign: 'center' }}>Prontidão</th>
              <th>Indicadores</th>
            </tr>
          </thead>
          <tbody>
            {withData.map(a => {
              const oCol = READINESS_COLORS[a.readiness.overall as keyof typeof READINESS_COLORS]
              return (
                <tr key={a.id}>
                  <td>
                    <Link href={`/athlete?id=${a.id}`} style={{ textDecoration: 'none' }}>
                      <strong>{a.name}</strong>
                      <br />
                      <span style={{ fontSize: 10, color: 'var(--text2)' }}>{a.position} · {a.club}</span>
                    </Link>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <ScoreBadge score={a.score.score} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: oCol }}>
                      {READINESS_LABELS[a.readiness.overall as keyof typeof READINESS_LABELS]}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {a.readiness.indicators.map((ind: ReadinessIndicator) => {
                        const c = READINESS_COLORS[ind.status]
                        return (
                          <div key={ind.label} style={{ textAlign: 'center', minWidth: 50 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, margin: '0 auto 2px' }} />
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)' }}>{ind.label}</div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: c }}>{ind.value}</div>
                          </div>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
