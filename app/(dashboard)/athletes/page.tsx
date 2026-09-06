import { calcScore, riskColor, riskLabel } from '@/lib/scoring'
import { getSquadIdParam, withSquadParam } from '@/lib/squad-url'
import { getAthleteList, type AthleteListDTO } from '@/lib/dal/athletes'
import { AthleteCard } from '@/components/ui/AthleteCard'
import type { AthleteAvailabilityStatus } from '@/types'

export default async function AthletesIndexPage({
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
    // Falls back to the legacy status flag for rows predating the
    // availability_status migration.
    const effectiveStatus = (a.availability_status as AthleteAvailabilityStatus | null)
      ?? (a.status === 'rehab' ? 'rtp' : 'available')
    return { ...a, score, effectiveStatus }
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
          {withScores.map((a) => (
            <AthleteCard
              key={a.id}
              href={withSquadParam(`/athletes/${a.id}`, squadId)}
              name={a.name}
              photoUrl={a.photo_url}
              shirtNumber={a.shirt_number}
              position={a.position}
              status={a.effectiveStatus}
              score={a.score.score}
              scoreColor={riskColor(a.score.score)}
              scoreLabel={riskLabel(a.score.score)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
