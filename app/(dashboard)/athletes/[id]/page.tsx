import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScoreBadge } from '@/components/athlete/ScoreBadge'
import { PartialScoreBars } from '@/components/athlete/PartialScoreBars'
import { scoreToRisk } from '@/lib/utils'
import type { ScorePartials, ScoreWeights } from '@/types'
import { BASE_WEIGHTS_V1 } from '@/lib/scoring/engine'

export const dynamic = 'force-dynamic'

export default async function AthleteAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: athlete }, { data: scoreRow }, { data: injuries }] = await Promise.all([
    supabase.from('athletes').select('*').eq('id', id).single(),
    supabase
      .from('score_history')
      .select('*')
      .eq('athlete_id', id)
      .order('score_date', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('injury_events')
      .select('*')
      .eq('athlete_id', id)
      .order('injury_date', { ascending: false })
      .limit(10),
  ])

  if (!athlete) notFound()

  const score = scoreRow ? Math.round(scoreRow.total_score * 100) : null
  const level = score !== null ? scoreToRisk(score) : null

  const partials: ScorePartials = scoreRow
    ? {
        history: scoreRow.history_partial,
        acwr:    scoreRow.acwr_partial,
        hrv:     scoreRow.hrv_partial,
        fatigue: scoreRow.fatigue_partial,
        sleep:   scoreRow.sleep_partial,
        tqr:     scoreRow.tqr_partial,
        stress:  scoreRow.stress_partial,
        decel:   scoreRow.decel_partial,
        md:      null,
      }
    : {
        history: null, acwr: null, hrv: null, fatigue: null,
        sleep: null, tqr: null, stress: null, decel: null, md: null,
      }

  const missing = (Object.keys(partials) as (keyof ScorePartials)[]).filter(
    (k) => partials[k] === null
  )

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
          >
            {athlete.name}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--aura-text2)' }}>
            #{athlete.shirt_number} · {athlete.position} · {athlete.club}
          </p>
        </div>
        {score !== null && level && (
          <ScoreBadge
            score={score}
            level={level}
            confidence={scoreRow?.confidence}
            size="lg"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score decomposition */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
        >
          <h2
            className="text-sm font-semibold mb-4"
            style={{ color: 'var(--aura-text)' }}
          >
            Decomposição por Factor
          </h2>
          {scoreRow ? (
            <PartialScoreBars
              partials={partials}
              weights={BASE_WEIGHTS_V1 as ScoreWeights}
              missing={missing}
            />
          ) : (
            <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
              Sem dados de score para hoje. Insira os dados de wellness e GPS.
            </p>
          )}
        </div>

        {/* Injury history */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--aura-text)' }}>
            Historial de Lesões
          </h2>
          {injuries && injuries.length > 0 ? (
            <ul className="space-y-3">
              {injuries.map((inj) => (
                <li
                  key={inj.id}
                  className="flex items-start justify-between border-b last:border-0 pb-3 last:pb-0"
                  style={{ borderColor: 'var(--aura-border)' }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>
                      {inj.diagnosis}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--aura-text3)' }}>
                      {inj.location} · {inj.injury_date}
                      {inj.is_recurrence && (
                        <span
                          className="ml-2 text-[10px] px-1 rounded"
                          style={{
                            background: 'var(--aura-danger-bg)',
                            color: 'var(--aura-danger)',
                          }}
                        >
                          Recidiva
                        </span>
                      )}
                    </p>
                  </div>
                  {inj.days_absent && (
                    <span
                      className="text-xs font-mono shrink-0"
                      style={{ color: 'var(--aura-text3)' }}
                    >
                      {inj.days_absent}d
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
              Sem lesões registadas.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
