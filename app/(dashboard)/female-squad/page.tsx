import { createClient } from '@/lib/supabase/server'
import { getMenstrualPhase, applyMenstrualMultiplier } from '@/lib/menstrual/cycle'
import { ScoreBadge } from '@/components/athlete/ScoreBadge'
import { scoreToRisk } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function FemaleSquadPage() {
  const supabase = await createClient()

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, shirt_number, position, club, menstrual_day, cycle_length')
    .eq('active', true)
    .not('menstrual_day', 'is', null)
    .order('shirt_number')

  const today = new Date().toISOString().split('T')[0]

  const { data: scores } = await supabase
    .from('score_history')
    .select('athlete_id, total_score, confidence')
    .eq('score_date', today)

  const scoreMap = new Map(scores?.map((s) => [s.athlete_id, s]) ?? [])

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
        >
          Seleção Feminina
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--aura-text2)' }}>
          Score ajustado pelo ciclo menstrual · Risco LCA (Hewett 2007, Renstrom BJSM 2008)
        </p>
      </div>

      {/* Phase legend */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        {[
          { phase: 'Menstrual', color: '#ff4d6d', mult: '1.1×', note: 'D1–5' },
          { phase: 'Folicular', color: '#00e5a0', mult: '1.0×', note: 'D6–13' },
          { phase: 'Ovulatória', color: '#f6ad55', mult: '1.4×', note: 'D14 ⚠️' },
          { phase: 'Luteínica',  color: '#b48dfc', mult: '1.2×', note: 'D15–28' },
        ].map((p) => (
          <div key={p.phase} className="flex items-center gap-2.5">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: p.color }}
            />
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--aura-text)' }}>
                {p.phase}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>
                {p.note} · LCA {p.mult}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Athlete grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {athletes?.map((athlete) => {
          const phaseInfo = getMenstrualPhase(
            athlete.menstrual_day ?? 1,
            athlete.cycle_length ?? 28
          )
          const scoreRow = scoreMap.get(athlete.id)
          const baseScore = scoreRow ? Math.round(scoreRow.total_score * 100) : null
          const adjustedScore = baseScore !== null
            ? applyMenstrualMultiplier(baseScore, athlete.menstrual_day ?? 1, athlete.cycle_length ?? 28)
            : null
          const level = adjustedScore !== null ? scoreToRisk(adjustedScore) : null

          return (
            <div
              key={athlete.id}
              className="rounded-xl border p-4"
              style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>
                    {athlete.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>
                    #{athlete.shirt_number} · {athlete.position}
                  </p>
                </div>
                {adjustedScore !== null && level && (
                  <ScoreBadge score={adjustedScore} level={level} size="sm" />
                )}
              </div>

              {/* Phase pill */}
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs"
                  style={{
                    background: phaseInfo.color + '18',
                    border: `1px solid ${phaseInfo.color}40`,
                    color: phaseInfo.color,
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: phaseInfo.color }}
                  />
                  {phaseInfo.label} · D{athlete.menstrual_day}
                </div>
                <span
                  className="text-xs font-mono font-bold"
                  style={{ color: phaseInfo.color }}
                >
                  LCA {phaseInfo.lcaRiskMultiplier}×
                </span>
              </div>

              {phaseInfo.phase === 'ovulatory' && (
                <p
                  className="text-[11px] mt-2 px-2 py-1.5 rounded"
                  style={{
                    background: 'var(--aura-warn-bg)',
                    color: 'var(--aura-warn)',
                  }}
                >
                  ⚠️ {phaseInfo.note}
                </p>
              )}
            </div>
          )
        })}

        {(!athletes || athletes.length === 0) && (
          <div
            className="col-span-full text-center py-12 rounded-xl border"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
              Sem atletas femininas registadas. Adicione atletas com ciclo menstrual activado.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
