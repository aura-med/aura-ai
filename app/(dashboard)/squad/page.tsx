import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { calcScore, riskColor, riskLabel, riskLevel } from '@/lib/scoring'
import { ScoreBadge, Sparkline } from '@/components/ui/aura'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function SquadPage() {
  const { data: athletes } = await supabase
    .from('athletes')
    .select(`*, wellness_checkins(*), injury_events(*), score_history(*)`)
    .eq('active', true)
    .order('shirt_number')

  const withScores = (athletes ?? []).map((a: any) => {
    const latest = (a.wellness_checkins ?? [])
      .sort((x: any, y: any) => new Date(y.checkin_date).getTime() - new Date(x.checkin_date).getTime())[0]
    const inputs = {
      history: (a.injury_events ?? []).filter((i: any) => !i.return_date).length >= 2 ? 2
        : (a.injury_events ?? []).length >= 1 ? 1 : 0,
      acwr: null, hrv: null,
      fatigue: latest?.fatigue ?? null,
      sleep: latest?.sleep_hours ?? null,
      tqr: latest?.tqr ?? null,
      stress: latest?.stress ?? null,
      decel: null, md: null,
    }
    const score = calcScore(inputs)
    const history = (a.score_history ?? [])
      .sort((x: any, y: any) => new Date(x.score_date).getTime() - new Date(y.score_date).getTime())
      .slice(-7).map((s: any) => Math.round(s.total_score * 100))
    return { ...a, score, history }
  })

  const byPos: Record<string, any[]> = { GK: [], DEF: [], MID: [], FWD: [] }
  const rehab: any[] = []
  withScores.forEach(a => {
    if (a.status === 'rehab') rehab.push(a)
    else if (a.position && byPos[a.position]) byPos[a.position].push(a)
  })

  const posLabels: Record<string, string> = { GK: 'Guarda-redes', DEF: 'Defesas', MID: 'Médios', FWD: 'Avançados' }

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">👥 Plantel</div>
        <div className="sec-sub">{withScores.length} atletas convocados · Ordenado por posição</div>
      </div>

      {Object.entries(byPos).map(([pos, athletes]) =>
        athletes.length === 0 ? null : (
          <div key={pos} style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 2,
              textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8,
              paddingBottom: 6, borderBottom: '1px solid var(--border)',
            }}>
              {posLabels[pos]}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
              {athletes.map((a: any) => (
                <Link key={a.id} href={`/athlete?id=${a.id}`} style={{ textDecoration: 'none' }}>
                  <div className="ath-card">
                    <div className="ath-avatar">{a.shirt_number}</div>
                    <div className="ath-info">
                      <div className="ath-name">{a.name}</div>
                      <div className="ath-meta">{a.club}</div>
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
          </div>
        )
      )}

      {rehab.length > 0 && (
        <div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 2,
            textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8,
            paddingBottom: 6, borderBottom: '1px solid var(--border)',
          }}>
            Reabilitação
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
            {rehab.map((a: any) => (
              <Link key={a.id} href={`/rehab`} style={{ textDecoration: 'none' }}>
                <div className="ath-card">
                  <div className="ath-avatar">{a.shirt_number}</div>
                  <div className="ath-info">
                    <div className="ath-name">{a.name}</div>
                    <div className="ath-meta">{a.position} · {a.club}</div>
                  </div>
                  <span className="score-badge" style={{ background: 'var(--blue2)', color: 'var(--blue)', borderColor: 'rgba(77,154,255,0.25)' }}>
                    Reab.
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
