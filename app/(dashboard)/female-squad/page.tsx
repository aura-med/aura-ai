import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { calcScore, riskColor, riskLabel, getMenstrualPhase, getFemaleAdjustedScore } from '@/lib/scoring'
import { AlertBox } from '@/components/ui/aura'
import { getSquadIdParam, withSquadParam } from '@/lib/squad-url'

const PHASE_GUIDE = [
  { phase: 'menstrual',  color: '#ff4d6d', days: 'D1–5',  note: 'Dor e fadiga possíveis. Reduzir impacto se necessário.' },
  { phase: 'follicular', color: '#00e5a0', days: 'D6–13', note: 'Fase ideal para carga alta e desenvolvimento de força.' },
  { phase: 'ovulatory',  color: '#ff7043', days: 'D14',   note: 'Risco LCA +40%. Evitar arranques bruscos e aterragens.' },
  { phase: 'luteal',     color: '#ffb347', days: 'D15–28',note: 'Laxidez ligamentar aumentada. Reforço proprioceptivo.' },
]

export default async function FemalePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const supabase = await createClient()
  let query = supabase
    .from('athletes')
    .select(`*, wellness_checkins(*), injury_events(*), rehab_sessions(*, rehab_protocols(*))`)
    .eq('active', true)
    .not('menstrual_day', 'is', null)
    .order('shirt_number')

  if (squadId) query = query.eq('squad_id', squadId)

  const { data: athletes } = await query

  const withData = (athletes ?? []).map((a: any) => {
    const latest = (a.wellness_checkins ?? [])
      .sort((x: any, y: any) => new Date(y.checkin_date).getTime() - new Date(x.checkin_date).getTime())[0]
    const inputs = {
      history: (a.injury_events ?? []).length >= 2 ? 2 : (a.injury_events ?? []).length >= 1 ? 1 : 0,
      acwr: null, hrv: null, fatigue: latest?.fatigue ?? null, sleep: latest?.sleep_hours ?? null,
      tqr: latest?.tqr ?? null, stress: latest?.stress ?? null, decel: null, md: null,
    }
    const base = calcScore(inputs)
    const adjusted = getFemaleAdjustedScore(base.score, a.menstrual_day, a.cycle_length)
    return { ...a, base_score: base.score, adjusted_score: adjusted.adjusted, phase: adjusted.phase }
  })

  const available = withData.filter(a => a.status === 'available')
  const rehab     = withData.filter(a => a.status === 'rehab')
  const highRisk  = withData.filter(a => a.adjusted_score >= 65)
  const inOvulation = withData.filter(a => a.phase?.phase === 'ovulatory')

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">⚽ Seleção Nacional Feminina</div>
        <div className="sec-sub">Monitorização com ciclo menstrual integrado · Risco LCA ajustado</div>
      </div>

      {/* Cycle phase guide */}
      <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(180,141,252,0.3)' }}>
        <div className="ctitle" style={{ color: 'var(--purple)' }}>🔬 Impacto do ciclo menstrual no risco de lesão</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
          {PHASE_GUIDE.map(p => (
            <div key={p.phase} style={{ background: 'var(--bg3)', borderRadius: 8, padding: 12, borderLeft: `3px solid ${p.color}` }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{p.days}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: p.color, marginBottom: 4, textTransform: 'capitalize' }}>{p.phase}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>{p.note}</div>
            </div>
          ))}
        </div>
        <div className="alert alert-b" style={{ marginBottom: 0 }}>
          <div className="adot ad-b" />
          <div style={{ fontSize: 12 }}>
            <strong>Evidência:</strong> Risco de lesão LCA varia até 4x ao longo do ciclo menstrual
            (Hewett et al. 2007; Renstrom et al. BJSM 2008). A Aura é a única plataforma que integra
            este factor no score de risco.
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-num" style={{ color: 'var(--text)' }}>{athletes?.length ?? 0}</div><div className="kpi-label">Atletas convocadas</div></div>
        <div className="kpi"><div className="kpi-num" style={{ color: 'var(--orange)' }}>{highRisk.length}</div><div className="kpi-label">Score ajustado alto</div></div>
        <div className="kpi"><div className="kpi-num" style={{ color: 'var(--danger)' }}>{inOvulation.length}</div><div className="kpi-label">Em ovulação hoje</div></div>
        <div className="kpi"><div className="kpi-num" style={{ color: 'var(--blue)' }}>{rehab.length}</div><div className="kpi-label">Em reabilitação</div></div>
      </div>

      {/* Squad grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {withData.map(a => {
          const lcaAdjusted = a.adjusted_score > a.base_score
          const isOvulatory = a.phase?.phase === 'ovulatory'

          return (
            <Link key={a.id} href={withSquadParam(`/athletes/${a.id}`, squadId)} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'var(--bg2)', border: `1px solid ${isOvulatory ? 'rgba(255,112,67,0.4)' : 'var(--border)'}`,
                borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all .15s',
              }}>
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div className="ath-avatar">{a.shirt_number}</div>
                  <div className="ath-info">
                    <div className="ath-name">{a.name}</div>
                    <div className="ath-meta">{a.position} · {a.club}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 900, color: riskColor(a.adjusted_score) }}>
                      {a.adjusted_score}%
                    </div>
                    {lcaAdjusted && (
                      <div style={{ fontSize: 9, color: 'var(--orange)', fontFamily: 'var(--mono)' }}>+LCA</div>
                    )}
                  </div>
                </div>

                {/* Phase indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.phase?.color, flexShrink: 0 }} />
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                    {a.phase?.label} · Dia {a.menstrual_day}
                  </div>
                </div>

                {/* Phase note for high-risk phases */}
                {(isOvulatory || a.phase?.phase === 'menstrual') && (
                  <div style={{ fontSize: 10, color: a.phase?.color, lineHeight: 1.4, marginTop: 6 }}>
                    {a.phase?.note}
                  </div>
                )}

                {a.status === 'rehab' && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 9, fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: 4, background: 'var(--blue2)', color: 'var(--blue)' }}>
                      REABILITAÇÃO
                    </span>
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
