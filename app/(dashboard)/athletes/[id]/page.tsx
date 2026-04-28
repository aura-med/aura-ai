import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit2 } from 'lucide-react'
import { ScoreBadge } from '@/components/athlete/ScoreBadge'
import { PartialScoreBars } from '@/components/athlete/PartialScoreBars'
import { RecommendationTabs } from '@/components/athlete/RecommendationTabs'
import { ReadinessRow } from '@/components/athlete/ReadinessRow'
import { GpsSection } from '@/components/athlete/GpsSection'
import { Sparkline } from '@/components/ui/aura'
import { riskColor, scoreToRisk } from '@/lib/utils'
import { BASE_WEIGHTS_V1 } from '@/lib/scoring/engine'
import { getSquadIdParam, withSquadParam } from '@/lib/squad-url'
import type { ScorePartials, ReadinessIndicator } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AthleteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const supabase = await createClient()

  // Fetch athlete with all related data
  const { data: athlete, error } = await supabase
    .from('athletes')
    .select(`
      id, name, shirt_number, position, date_of_birth, club, status,
      injury_events (id, injury_date, return_date, diagnosis, location, severity, days_absent, is_recurrence),
      score_history (score_date, total_score, acwr_partial, hrv_partial, fatigue_partial, sleep_partial, tqr_partial, history_partial, stress_partial, decel_partial, confidence, days_since_match),
      gps_sessions (session_date, session_type, total_distance_m, hsr_distance_m, max_speed_kmh, player_load),
      performance_data (session_date, vmax, vmax_today_pct),
      wellness_checkins (checkin_date, fatigue, sleep_quality, sleep_hours, hrv_ms, tqr)
    `)
    .eq('id', id)
    .order('injury_date', { referencedTable: 'injury_events', ascending: false })
    .order('score_date', { referencedTable: 'score_history', ascending: false })
    .order('session_date', { referencedTable: 'gps_sessions', ascending: false })
    .order('session_date', { referencedTable: 'performance_data', ascending: false })
    .order('checkin_date', { referencedTable: 'wellness_checkins', ascending: false })
    .single()

  if (error || !athlete) notFound()

  // Latest score
  const latestScore = athlete.score_history?.[0]
  const score = latestScore ? Math.round(latestScore.total_score * 100) : null
  const riskLevel = score !== null ? scoreToRisk(score) : null
  const confidence = (latestScore?.confidence ?? 'low') as 'high' | 'medium' | 'low'

  // 7-day sparkline values (oldest → newest for left-to-right display)
  const sparkData: (number | null)[] = (athlete.score_history ?? [])
    .slice(0, 7)
    .reverse()
    .map((s) => Math.round(s.total_score * 100))

  // Partials from latest score
  const partials: ScorePartials = latestScore
    ? {
        history: latestScore.history_partial,
        acwr: latestScore.acwr_partial,
        hrv: latestScore.hrv_partial,
        fatigue: latestScore.fatigue_partial,
        sleep: latestScore.sleep_partial,
        tqr: latestScore.tqr_partial,
        stress: latestScore.stress_partial,
        decel: latestScore.decel_partial,
        md: null,
      }
    : {
        history: null, acwr: null, hrv: null, fatigue: null,
        sleep: null, tqr: null, stress: null, decel: null, md: null,
      }

  const missing = (Object.keys(partials) as (keyof ScorePartials)[]).filter(
    (k) => partials[k] === null
  )

  // Dominant variable (highest contributing partial × weight)
  let dominantVariable: string | null = null
  let maxContrib = 0
  for (const [k, v] of Object.entries(partials)) {
    if (v !== null) {
      const w = BASE_WEIGHTS_V1[k as keyof typeof BASE_WEIGHTS_V1] ?? 0
      const contrib = (v as number) * w
      if (contrib > maxContrib) {
        maxContrib = contrib
        dominantVariable = k
      }
    }
  }

  // Age calculation
  const age = athlete.date_of_birth
    ? Math.floor((Date.now() - new Date(athlete.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  // Readiness indicators
  const latestCheckin = athlete.wellness_checkins?.[0]
  const latestGps = athlete.gps_sessions?.[0]
  const latestPerf = athlete.performance_data?.[0]
  const daysSinceMatch = latestScore?.days_since_match ?? null
  const vmaxPct = latestPerf?.vmax_today_pct ??
    (latestGps?.max_speed_kmh && latestPerf?.vmax
      ? Math.round((latestGps.max_speed_kmh / latestPerf.vmax) * 100)
      : null)

  const readinessIndicators: ReadinessIndicator[] = [
    {
      label: 'HRV',
      value: latestCheckin?.hrv_ms ? `${latestCheckin.hrv_ms}ms` : '--',
      status: !latestCheckin?.hrv_ms ? 'grey' : latestCheckin.hrv_ms > 60 ? 'green' : latestCheckin.hrv_ms > 45 ? 'amber' : 'red',
    },
    {
      label: daysSinceMatch !== null ? `MD+${daysSinceMatch}` : 'MD',
      value: daysSinceMatch !== null ? `+${daysSinceMatch}d` : '--',
      status: !daysSinceMatch ? 'grey' : daysSinceMatch >= 3 ? 'green' : daysSinceMatch >= 2 ? 'amber' : 'red',
      detail: 'Dias desde jogo',
    },
    {
      label: 'Vmax%',
      value: vmaxPct !== null ? `${vmaxPct}%` : '--',
      status: vmaxPct === null ? 'grey' : vmaxPct >= 95 ? 'green' : vmaxPct >= 85 ? 'amber' : 'red',
    },
    {
      label: 'Wellness',
      value: latestCheckin?.fatigue ? `${latestCheckin.fatigue}/7` : '--',
      status: !latestCheckin?.fatigue ? 'grey' : latestCheckin.fatigue <= 3 ? 'green' : latestCheckin.fatigue <= 5 ? 'amber' : 'red',
      detail: 'Fadiga Hooper',
    },
  ]

  // Recent GPS sessions (last 3)
  const recentGps = athlete.gps_sessions?.slice(0, 3) ?? []

  // Sparkline color based on current risk
  const sparkColor = riskLevel ? riskColor(riskLevel) : 'var(--aura-text3)'

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={withSquadParam('/athletes', squadId)}
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: 'var(--aura-text3)' }}
          >
            <ArrowLeft size={13} />
            Plantel
          </Link>
          <div className="flex items-center gap-3">
            {/* Shirt number avatar */}
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold font-mono border"
              style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}
            >
              #{athlete.shirt_number ?? '?'}
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
                {athlete.name}
              </h1>
              <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--aura-text3)' }}>
                {[athlete.position, age ? `${age}a` : null, athlete.club].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {score !== null && riskLevel && (
            <ScoreBadge score={score} level={riskLevel} confidence={confidence} size="lg" />
          )}
          <Link
            href="/input"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors hover:bg-white/5"
            style={{ color: 'var(--aura-text2)', borderColor: 'var(--aura-border2)' }}
          >
            <Edit2 size={12} />
            Editar dados
          </Link>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Score & Decomposition */}
        <div className="space-y-4">
          <div
            className="rounded-xl border p-5 space-y-4"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            {/* Score + sparkline */}
            <div className="flex items-end justify-between">
              <div>
                <div
                  className="text-5xl font-bold font-mono leading-none"
                  style={{ color: score !== null && riskLevel ? riskColor(riskLevel) : 'var(--aura-text3)' }}
                >
                  {score ?? '--'}
                </div>
                <div className="text-xs font-mono mt-1" style={{ color: 'var(--aura-text3)' }}>
                  Risco de Lesão
                </div>
                {dominantVariable && (
                  <div className="text-xs mt-2" style={{ color: 'var(--aura-text2)' }}>
                    Dom: <span style={{ color: 'var(--aura-warn)' }}>{dominantVariable.toUpperCase()}</span>
                  </div>
                )}
              </div>
              {sparkData.length > 1 && (
                <div className="w-28 h-12">
                  <Sparkline data={sparkData} color={sparkColor} width={112} height={48} />
                </div>
              )}
            </div>

            {/* Decomposition bars */}
            {latestScore && (
              <PartialScoreBars
                partials={partials}
                weights={BASE_WEIGHTS_V1}
                missing={missing}
              />
            )}
          </div>
        </div>

        {/* Right: Clinical history + Recommendations */}
        <div className="space-y-4">
          {/* Injury history */}
          <div
            className="rounded-xl border p-5"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
              Historial Clínico
            </h3>
            {!athlete.injury_events?.length ? (
              <p className="text-xs py-3 text-center" style={{ color: 'var(--aura-text3)' }}>Sem lesões registadas.</p>
            ) : (
              <div className="space-y-2">
                {athlete.injury_events.slice(0, 5).map((inj) => (
                  <div key={inj.id} className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-snug" style={{ color: 'var(--aura-text)' }}>
                        {inj.diagnosis ?? 'Lesão não especificada'}
                        {inj.is_recurrence && (
                          <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded font-mono" style={{ background: 'rgba(255,77,109,0.15)', color: 'var(--aura-danger)' }}>
                            Recidiva
                          </span>
                        )}
                      </p>
                      {inj.location && (
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--aura-text3)' }}>
                          {inj.location}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-mono" style={{ color: 'var(--aura-text3)' }}>
                        {new Date(inj.injury_date).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}
                      </p>
                      {inj.return_date ? (
                        <p className="text-[11px] font-mono" style={{ color: 'var(--aura-text3)' }}>
                          {inj.days_absent}d
                        </p>
                      ) : (
                        <p className="text-[11px] font-bold font-mono" style={{ color: 'var(--aura-danger)' }}>
                          ACTIVO
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div
            className="rounded-xl border p-5"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
              Recomendações
            </h3>
            <RecommendationTabs
              dominantVariable={dominantVariable}
              riskLevel={(riskLevel ?? 'low') as 'low' | 'medium' | 'high' | 'critical'}
            />
          </div>
        </div>
      </div>

      {/* Readiness row */}
      <ReadinessRow indicators={readinessIndicators} />

      <GpsSection sessions={recentGps} />
    </div>
  )
}
