import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ScoreBadge } from '@/components/athlete/ScoreBadge'
import { scoreToRisk } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const POSITION_COLORS: Record<string, string> = {
  GK:  'var(--aura-warn)',
  DEF: 'var(--aura-blue)',
  MID: 'var(--aura-green)',
  FWD: 'var(--aura-danger)',
}

export default async function SquadPage() {
  const supabase = await createClient()

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, shirt_number, position, status, club')
    .eq('active', true)
    .order('shirt_number')

  const { data: latestScores } = await supabase
    .from('score_history')
    .select('athlete_id, total_score, confidence, score_date')
    .in('score_date', [new Date().toISOString().split('T')[0]])

  const scoreMap = new Map(latestScores?.map((s) => [s.athlete_id, s]) ?? [])

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
        >
          Plantel
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--aura-text2)' }}>
          {athletes?.length ?? 0} atletas · scores de hoje
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {athletes?.map((athlete) => {
          const scoreRow = scoreMap.get(athlete.id)
          const score = scoreRow ? Math.round(scoreRow.total_score * 100) : null
          const level = score !== null ? scoreToRisk(score) : null

          return (
            <Link
              key={athlete.id}
              href={`/athletes/${athlete.id}`}
              className="block rounded-xl border p-4 transition-colors hover:border-[var(--aura-border2)]"
              style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Shirt number + name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono shrink-0"
                    style={{
                      background: 'var(--aura-bg3)',
                      color: 'var(--aura-text2)',
                    }}
                  >
                    {athlete.shirt_number}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: 'var(--aura-text)' }}
                    >
                      {athlete.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                        style={{
                          color: POSITION_COLORS[athlete.position] ?? 'var(--aura-text3)',
                          background: POSITION_COLORS[athlete.position] ? `${POSITION_COLORS[athlete.position]}18` : 'var(--aura-bg3)',
                        }}
                      >
                        {athlete.position}
                      </span>
                      {athlete.status === 'rehab' && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            background: 'var(--aura-warn-bg)',
                            color: 'var(--aura-warn)',
                          }}
                        >
                          Rehab
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score */}
                {score !== null && level ? (
                  <ScoreBadge score={score} level={level} size="sm" />
                ) : (
                  <span
                    className="text-xs font-mono"
                    style={{ color: 'var(--aura-text3)' }}
                  >
                    sem dados
                  </span>
                )}
              </div>

              {/* Club */}
              <p
                className="text-xs mt-3 truncate"
                style={{ color: 'var(--aura-text3)' }}
              >
                {athlete.club}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
