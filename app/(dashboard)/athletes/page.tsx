import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { calcScore, riskColor, riskLabel } from '@/lib/scoring'
import { Sparkline } from '@/components/ui/aura'
import { getSquadIdParam, withSquadParam } from '@/lib/squad-url'

export default async function AthletesIndexPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const supabase = await createClient()

  let query = supabase
    .from('athletes')
    .select(`*, wellness_checkins(*), injury_events(*), score_history(*)`)
    .eq('active', true)
    .order('shirt_number')

  if (squadId) query = query.eq('squad_id', squadId)

  const { data: athletes } = await query

  const withScores = (athletes ?? []).map((a: any) => {
    const latest = (a.wellness_checkins ?? [])
      .sort((x: any, y: any) => new Date(y.checkin_date).getTime() - new Date(x.checkin_date).getTime())[0]
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
    return { ...a, score, history }
  })

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Plantel</div>
        <div className="sec-sub">{withScores.length} atletas ativos</div>
      </div>

      {withScores.length === 0 ? (
        <div className="empty-state">
          <h3>Sem atletas nesta squad</h3>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>
            Escolhe outra squad no topo para ver o respetivo plantel.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {withScores.map((a: any) => (
            <Link key={a.id} href={withSquadParam(`/athletes/${a.id}`, squadId)} style={{ textDecoration: 'none' }}>
              <div className="ath-card">
                <div className="ath-avatar">{a.shirt_number}</div>
                <div className="ath-info">
                  <div className="ath-name">{a.name}</div>
                  <div className="ath-meta">{[a.position, a.club].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 900, color: riskColor(a.score.score) }}>
                    {a.score.score}%
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text2)', fontFamily: 'var(--mono)', marginBottom: 3 }}>
                    {riskLabel(a.score.score)}
                  </div>
                  {a.history.length > 1 && (
                    <Sparkline data={a.history} color={riskColor(a.score.score)} width={52} height={14} />
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
