import Link from 'next/link'
import { calcScore, riskColor, riskLabel } from '@/lib/scoring'
import { Sparkline } from '@/components/ui/aura'
import { getSquadIdParam, withSquadParam } from '@/lib/squad-url'
import { getAthleteList, type AthleteListDTO } from '@/lib/dal/athletes'
import { AthleteAvatar } from '@/components/ui/AthleteAvatar'

export default async function SquadPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const athletes = await getAthleteList(squadId)

  const withScores = athletes.map((a: AthleteListDTO) => {
    const latest = (a.wellness_checkins ?? [])
      .sort((x, y) => new Date(y.checkin_date).getTime() - new Date(x.checkin_date).getTime())[0]
    const inputs = {
      history: (a.injury_events ?? []).filter((i) => !i.return_date).length >= 2 ? 2
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
      .sort((x, y) => new Date(x.score_date).getTime() - new Date(y.score_date).getTime())
      .slice(-7).map((s) => Math.round(s.total_score * 100))
    return { ...a, score, history }
  })

  const byPos: Record<string, typeof withScores> = { GK: [], DEF: [], MID: [], FWD: [] }
  const rehab: typeof withScores = []
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

      {Object.entries(byPos).map(([pos, posAthletes]) =>
        posAthletes.length === 0 ? null : (
          <div key={pos} style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 2,
              textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8,
              paddingBottom: 6, borderBottom: '1px solid var(--border)',
            }}>
              {posLabels[pos]}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
              {posAthletes.map((a) => (
                <Link key={a.id} href={withSquadParam(`/athletes/${a.id}`, squadId)} style={{ textDecoration: 'none' }}>
                  <div className="ath-card">
                    <AthleteAvatar photoUrl={a.photo_url} shirtNumber={a.shirt_number} name={a.name} />
                    <div className="ath-info">
                      <div className="ath-name">{a.name}</div>
                      <div className="ath-meta">{a.position}</div>
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
            {rehab.map((a) => (
              <Link key={a.id} href={withSquadParam('/rehab', squadId)} style={{ textDecoration: 'none' }}>
                <div className="ath-card">
                  <AthleteAvatar photoUrl={a.photo_url} shirtNumber={a.shirt_number} name={a.name} />
                  <div className="ath-info">
                    <div className="ath-name">{a.name}</div>
                    <div className="ath-meta">{a.position}</div>
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
