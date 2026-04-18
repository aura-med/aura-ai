import { createClient } from '@/lib/supabase/server'
import { scoreToRisk } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Status = 'green' | 'amber' | 'red' | 'grey'

function hvStatus(hrv: number | null): Status {
  if (hrv === null) return 'grey'
  if (hrv >= -5)   return 'green'
  if (hrv >= -15)  return 'amber'
  return 'red'
}

function mdStatus(days: number | null): Status {
  if (days === null) return 'grey'
  if (days >= 4)   return 'green'
  if (days >= 2)   return 'amber'
  return 'red'
}

function vmaxStatus(pct: number | null): Status {
  if (pct === null) return 'grey'
  if (pct >= 90)   return 'green'
  if (pct >= 80)   return 'amber'
  return 'red'
}

function wellnessStatus(fatigue: number | null, sleep: number | null, tqr: number | null): Status {
  if (fatigue === null && sleep === null && tqr === null) return 'grey'
  const bad = (fatigue !== null && fatigue > 4) ||
              (sleep !== null && sleep < 7) ||
              (tqr !== null && tqr < 14)
  const ok  = (fatigue !== null && fatigue <= 4) &&
              (sleep !== null && sleep >= 7) &&
              (tqr !== null && tqr >= 14)
  if (ok) return 'green'
  if (bad) return 'red'
  return 'amber'
}

function overallStatus(statuses: Status[]): Status {
  if (statuses.filter((s) => s === 'grey').length >= 3) return 'grey'
  if (statuses.includes('red'))   return 'red'
  if (statuses.includes('amber')) return 'amber'
  return 'green'
}

const STATUS_COLORS: Record<Status, string> = {
  green: 'var(--aura-green)',
  amber: 'var(--aura-warn)',
  red:   'var(--aura-danger)',
  grey:  'var(--aura-text3)',
}

const STATUS_BG: Record<Status, string> = {
  green: 'var(--aura-green-bg)',
  amber: 'var(--aura-warn-bg)',
  red:   'var(--aura-danger-bg)',
  grey:  'var(--aura-bg3)',
}

export default async function ReadinessPage() {
  const supabase = await createClient()

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, shirt_number, position')
    .eq('active', true)
    .eq('status', 'available')
    .order('shirt_number')

  const today = new Date().toISOString().split('T')[0]

  const { data: checkins } = await supabase
    .from('wellness_checkins')
    .select('athlete_id, fatigue, sleep_hours, tqr, hrv_ms')
    .eq('checkin_date', today)
    .eq('checkin_type', 'morning')

  const { data: scores } = await supabase
    .from('score_history')
    .select('athlete_id, days_since_match')
    .eq('score_date', today)

  const { data: perf } = await supabase
    .from('performance_data')
    .select('athlete_id, vmax_today_pct')
    .eq('session_date', today)

  const checkinMap = new Map(checkins?.map((c) => [c.athlete_id, c]) ?? [])
  const scoreMap   = new Map(scores?.map((s) => [s.athlete_id, s]) ?? [])
  const perfMap    = new Map(perf?.map((p) => [p.athlete_id, p]) ?? [])

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
        >
          Prontidão
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--aura-text2)' }}>
          Semáforo de 4 indicadores · {today}
        </p>
      </div>

      {/* Legend */}
      <div
        className="flex flex-wrap gap-4 text-xs p-3 rounded-lg"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        {(['green', 'amber', 'red', 'grey'] as Status[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: STATUS_COLORS[s] }}
            />
            <span style={{ color: 'var(--aura-text2)' }}>
              {s === 'green' ? 'Disponível' : s === 'amber' ? 'Atenção' : s === 'red' ? 'Risco' : 'Sem dados'}
            </span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--aura-border)' }}>
              {['Atleta', 'HRV', 'MD+n', 'Vmax%', 'Wellness', 'Estado'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium"
                  style={{ color: 'var(--aura-text3)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {athletes?.map((athlete) => {
              const c = checkinMap.get(athlete.id)
              const s = scoreMap.get(athlete.id)
              const p = perfMap.get(athlete.id)

              const hrv  = c?.hrv_ms ?? null
              const md   = s?.days_since_match ?? null
              const vmax = p?.vmax_today_pct ?? null
              const fat  = c?.fatigue ?? null
              const slp  = c?.sleep_hours ?? null
              const tqr  = c?.tqr ?? null

              const statuses: Status[] = [
                hvStatus(hrv),
                mdStatus(md),
                vmaxStatus(vmax),
                wellnessStatus(fat, slp, tqr),
              ]
              const overall = overallStatus(statuses)

              return (
                <tr
                  key={athlete.id}
                  style={{ borderBottom: '1px solid var(--aura-border)' }}
                  className="hover:bg-[var(--aura-bg3)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium" style={{ color: 'var(--aura-text)' }}>
                      {athlete.name}
                    </span>
                    <span className="text-xs ml-2" style={{ color: 'var(--aura-text3)' }}>
                      {athlete.position}
                    </span>
                  </td>
                  {statuses.map((st, i) => (
                    <td key={i} className="px-4 py-3">
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ background: STATUS_COLORS[st] + '30', border: `1.5px solid ${STATUS_COLORS[st]}` }}
                      >
                        <div
                          className="w-full h-full rounded-full scale-50"
                          style={{ background: STATUS_COLORS[st] }}
                        />
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded-full"
                      style={{
                        background: STATUS_BG[overall],
                        color: STATUS_COLORS[overall],
                      }}
                    >
                      {overall === 'green' ? 'Disponível' :
                       overall === 'amber' ? 'Atenção' :
                       overall === 'red'   ? 'Em Risco' : 'Sem Dados'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
