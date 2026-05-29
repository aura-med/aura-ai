import Link from 'next/link'
import { calcScore, riskColor, riskLabel } from '@/lib/scoring'
import { getSquadIdParam, withSquadParam } from '@/lib/squad-url'
import { getAthleteList, type AthleteListDTO } from '@/lib/dal/athletes'
import { AthleteCard } from '@/components/ui/AthleteCard'

export default async function SquadPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const squadId  = getSquadIdParam(searchParams ? await searchParams : null)
  const athletes = await getAthleteList(squadId)

  const withScores = athletes.map((a: AthleteListDTO) => {
    const latest = (a.wellness_checkins ?? [])
      .sort((x, y) => new Date(y.checkin_date).getTime() - new Date(x.checkin_date).getTime())[0]
    const inputs = {
      history: (a.injury_events ?? []).filter((i) => !i.return_date).length >= 2 ? 2
        : (a.injury_events ?? []).length >= 1 ? 1 : 0,
      acwr: null, hrv: null,
      fatigue: latest?.fatigue     ?? null,
      sleep:   latest?.sleep_hours ?? null,
      tqr:     latest?.tqr         ?? null,
      stress:  latest?.stress      ?? null,
      decel: null, md: null,
    }
    const score = calcScore(inputs)
    return { ...a, score }
  })

  const byPos: Record<string, typeof withScores> = { GK: [], DEF: [], MID: [], FWD: [] }
  const rehab: typeof withScores = []
  withScores.forEach((a) => {
    if (a.status === 'rehab') rehab.push(a)
    else if (a.position && byPos[a.position]) byPos[a.position].push(a)
  })

  const posLabels: Record<string, string> = {
    GK: 'Guarda-redes', DEF: 'Defesas', MID: 'Médios', FWD: 'Avançados',
  }

  const positionFull: Record<string, string> = {
    GK: 'GK', DEF: 'DEF', MID: 'MED', FWD: 'AVA',
  }

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">👥 Plantel</div>
        <div className="sec-sub">{withScores.length} atletas convocados · Ordenado por posição</div>
      </div>

      {Object.entries(byPos).map(([pos, posAthletes]) =>
        posAthletes.length === 0 ? null : (
          <div key={pos} className="mb-8">
            {/* Position group header */}
            <div
              className="text-[9px] font-semibold uppercase tracking-[0.18em] mb-3 pb-2 border-b"
              style={{ color: 'var(--aura-text3)', borderColor: 'var(--aura-border)', fontFamily: 'var(--font-dm-mono)' }}
            >
              {posLabels[pos]}
            </div>

            {/* FUT card grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {posAthletes.map((a) => (
                <AthleteCard
                  key={a.id}
                  href={withSquadParam(`/athletes/${a.id}`, squadId)}
                  name={a.name}
                  photoUrl={a.photo_url}
                  shirtNumber={a.shirt_number}
                  position={positionFull[a.position ?? ''] ?? a.position}
                  status={a.status}
                  score={a.score.score}
                  scoreColor={riskColor(a.score.score)}
                  scoreLabel={riskLabel(a.score.score)}
                />
              ))}
            </div>
          </div>
        )
      )}

      {rehab.length > 0 && (
        <div className="mb-8">
          <div
            className="text-[9px] font-semibold uppercase tracking-[0.18em] mb-3 pb-2 border-b"
            style={{ color: 'var(--aura-text3)', borderColor: 'var(--aura-border)', fontFamily: 'var(--font-dm-mono)' }}
          >
            Reabilitação
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {rehab.map((a) => (
              <AthleteCard
                key={a.id}
                href={withSquadParam(`/athletes/${a.id}`, squadId)}
                name={a.name}
                photoUrl={a.photo_url}
                shirtNumber={a.shirt_number}
                position={a.position}
                status="rehab"
                score={a.score.score}
                scoreColor={riskColor(a.score.score)}
                scoreLabel={riskLabel(a.score.score)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
