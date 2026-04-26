'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { calcScore, riskColor, riskLevel, VAR_ICONS, VAR_LABELS } from '@/lib/scoring'
import { ScoreBadge, ConfBadge, DecompositionBars, AlertBox, Loading, Sparkline } from '@/components/ui/aura'
import { supabase } from '@/lib/supabase'
import type { AthleteScore } from '@/types'

function AthleteView() {
  const params = useSearchParams()
  const id = params.get('id')
  const [athlete, setAthlete] = useState<any>(null)
  const [score, setScore] = useState<AthleteScore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    supabase
      .from('athletes')
      .select(`*, wellness_checkins(*), performance_data(*), injury_events(*), fatigue_profiles(*), score_history(*), athlete_passport(*), rehab_sessions(*, rehab_protocols(*))`)
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return
        setAthlete(data)

        const latest = (data.wellness_checkins ?? [])
          .sort((a: any, b: any) => new Date(b.checkin_date).getTime() - new Date(a.checkin_date).getTime())[0]

        const inputs = {
          history: (data.injury_events ?? []).filter((i: any) => !i.return_date).length >= 2 ? 2
            : (data.injury_events ?? []).length >= 1 ? 1 : 0,
          acwr: null, hrv: null,
          fatigue: latest?.fatigue ?? null,
          sleep:   latest?.sleep_hours ?? null,
          tqr:     latest?.tqr ?? null,
          stress:  latest?.stress ?? null,
          decel:   null, md: null,
        }
        setScore(calcScore(inputs))
        setLoading(false)
      })
  }, [id])

  if (!id) return (
    <div className="empty-state">
      <h3>Selecciona um atleta no plantel</h3>
      <p style={{ fontSize: 12, color: 'var(--text3)' }}>Vai a Plantel e clica num atleta para ver o perfil completo.</p>
    </div>
  )

  if (loading) return <Loading />
  if (!athlete || !score) return <div className="empty-state"><h3>Atleta não encontrado</h3></div>

  const history = (athlete.score_history ?? [])
    .sort((a: any, b: any) => new Date(a.score_date).getTime() - new Date(b.score_date).getTime())
    .slice(-7)
    .map((s: any) => Math.round(s.total_score * 100))

  const injuryHistory = (athlete.injury_events ?? [])
    .sort((a: any, b: any) => new Date(b.injury_date).getTime() - new Date(a.injury_date).getTime())

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 500, color: 'var(--text2)',
        }}>
          {athlete.shirt_number}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 900 }}>{athlete.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
            {athlete.position} · {athlete.club}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ScoreBadge score={score.score} />
          <ConfBadge confidence={score.confidence} reason={score.confidence_reason} missing={score.missing} />
        </div>
      </div>

      <div className="g2" style={{ marginBottom: 16 }}>
        {/* Score + bars */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4 }}>
                Score preditivo
              </div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 52, fontWeight: 900, color: riskColor(score.score), lineHeight: 1 }}>
                {score.score}%
              </div>
              {score.dominant_variable && (
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                  Variável dominante:{' '}
                  <strong style={{ color: riskColor(score.score) }}>
                    {VAR_ICONS[score.dominant_variable]} {VAR_LABELS[score.dominant_variable]}
                  </strong>
                </div>
              )}
            </div>
            {history.length > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', marginBottom: 6 }}>TENDÊNCIA — 7 DIAS</div>
                <Sparkline data={history} color={riskColor(score.score)} width={90} height={32} />
              </div>
            )}
          </div>
          <hr className="divider" />
          <div className="slabel" style={{ marginBottom: 10 }}>Decomposição por factor (v1.1)</div>
          <DecompositionBars calc={score} />
        </div>

        {/* Injury history */}
        <div className="card">
          <div className="ctitle">Historial de lesões</div>
          {injuryHistory.length === 0 ? (
            <div className="alert alert-g">
              <div className="adot ad-g" />
              <div style={{ fontSize: 12 }}>Sem lesões registadas</div>
            </div>
          ) : (
            injuryHistory.map((inj: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <div style={{ width: 80, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>
                  {new Date(inj.injury_date).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}
                </div>
                <div style={{ color: inj.return_date ? 'var(--text2)' : 'var(--danger)' }}>
                  {inj.diagnosis}
                  {inj.days_absent ? ` — ${inj.days_absent} dias` : ' — ACTIVO'}
                </div>
              </div>
            ))
          )}

          {athlete.status === 'rehab' && athlete.rehab_sessions?.[0] && (
            <>
              <hr className="divider" />
              <div className="ctitle">Reabilitação activa</div>
              <div className="alert alert-b">
                <div className="adot ad-b" />
                <div style={{ fontSize: 12 }}>
                  <strong>{athlete.rehab_sessions[0].rehab_protocols?.name}</strong>
                  {' · Dia '}{athlete.rehab_sessions[0].current_day}
                  {'/'}{athlete.rehab_sessions[0].rehab_protocols?.total_days}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AthletePage() {
  return (
    <Suspense fallback={<Loading />}>
      <AthleteView />
    </Suspense>
  )
}
