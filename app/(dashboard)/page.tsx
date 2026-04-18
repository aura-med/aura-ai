import { createClient } from '@/lib/supabase/server'
import { ScoreBadge } from '@/components/athlete/ScoreBadge'
import { scoreToRisk } from '@/lib/utils'
import Link from 'next/link'
import {
  AlertTriangle, Users, Activity, Heart, TrendingUp,
  Gauge, CheckCircle2, Shield,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const POSITION_COLORS: Record<string, string> = {
  GK: 'var(--aura-warn)',
  DEF: 'var(--aura-blue)',
  MID: 'var(--aura-green)',
  FWD: 'var(--aura-danger)',
}

const RISK_COLORS: Record<string, string> = {
  critical: 'var(--aura-danger)',
  high: '#ff9330',
  medium: 'var(--aura-warn)',
  low: 'var(--aura-green)',
}

const RISK_LABELS: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
}

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Active athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, shirt_number, position, status')
    .eq('active', true)
    .order('shirt_number')

  // Latest scores — 7-day window, newest first
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const { data: allScores } = await supabase
    .from('score_history')
    .select('athlete_id, total_score, confidence, score_date')
    .gte('score_date', sevenDaysAgo)
    .order('score_date', { ascending: false })

  // Today's wellness check-ins
  const todayISO = new Date().toISOString().split('T')[0]
  const { data: todayWellness } = await supabase
    .from('wellness_checkins')
    .select('athlete_id, fatigue, sleep_hours, hrv_delta, TQR, stress, created_at')
    .gte('created_at', todayISO + 'T00:00:00')

  // Latest GPS session
  const { data: gpsData } = await supabase
    .from('gps_sessions')
    .select('athlete_id, distance, hsr, sprints, accelerations, max_speed, session_date, session_type')
    .order('session_date', { ascending: false })
    .limit(50)

  // ── Derived ──────────────────────────────────────────────────

  // Latest score per athlete (deduplicated — newest first from query)
  const latestScoreMap = new Map<string, { total_score: number; confidence: string; score_date: string }>()
  for (const s of allScores ?? []) {
    if (!latestScoreMap.has(s.athlete_id)) latestScoreMap.set(s.athlete_id, s)
  }

  const totalAthletes = athletes?.length ?? 0
  const available = athletes?.filter((a) => a.status === 'available').length ?? 0
  const rehabAthletes = athletes?.filter((a) => a.status === 'rehab') ?? []
  const rehabCount = rehabAthletes.length

  // Risk distribution
  const riskCounts = { critical: 0, high: 0, medium: 0, low: 0, none: 0 }
  for (const athlete of athletes ?? []) {
    const s = latestScoreMap.get(athlete.id)
    if (!s) { riskCounts.none++; continue }
    const score = Math.round(s.total_score * 100)
    if (score >= 85) riskCounts.critical++
    else if (score >= 65) riskCounts.high++
    else if (score >= 50) riskCounts.medium++
    else riskCounts.low++
  }

  // Alerts: athletes with latest score >= 65, sorted desc
  const alerts = (athletes ?? [])
    .map((a) => ({ athlete: a, s: latestScoreMap.get(a.id) }))
    .filter((x) => x.s && Math.round(x.s.total_score * 100) >= 65)
    .sort((a, b) => b.s!.total_score - a.s!.total_score)

  // Wellness averages
  const wellness = todayWellness ?? []
  const wellnessCount = wellness.length
  const avgFatigue = wellnessCount ? avg(wellness.map((w) => w.fatigue ?? 0)) : null
  const avgSleep = wellnessCount ? avg(wellness.map((w) => w.sleep_hours ?? 0)) : null
  const avgHRV = wellnessCount ? avg(wellness.map((w) => w.hrv_delta ?? 0)) : null
  const avgTQR = wellnessCount ? avg(wellness.map((w) => w.TQR ?? 0)) : null

  // GPS last session
  const lastSessionDate = gpsData?.[0]?.session_date ?? null
  const lastSessionType = gpsData?.[0]?.session_type ?? null
  const lastSessionRecords = lastSessionDate
    ? (gpsData ?? []).filter((g) => g.session_date === lastSessionDate)
    : []
  const gpsCount = lastSessionRecords.length
  const gpsAvgDist = gpsCount ? avg(lastSessionRecords.map((g) => g.distance ?? 0)) : null
  const gpsAvgHSR = gpsCount ? avg(lastSessionRecords.map((g) => g.hsr ?? 0)) : null
  const gpsAvgSprints = gpsCount ? avg(lastSessionRecords.map((g) => g.sprints ?? 0)) : null
  const gpsAvgAccel = gpsCount ? avg(lastSessionRecords.map((g) => g.accelerations ?? 0)) : null
  const gpsAvgVmax = gpsCount ? avg(lastSessionRecords.map((g) => g.max_speed ?? 0)) : null

  const dateLabel = new Date().toLocaleDateString('pt-PT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
        >
          Dashboard
        </h1>
        <p className="text-sm mt-1 capitalize" style={{ color: 'var(--aura-text2)' }}>
          {dateLabel} · Visão geral da saúde do plantel
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Plantel" value={totalAthletes} icon={<Users size={15} />} color="var(--aura-blue)" />
        <KpiCard label="Disponíveis" value={available} icon={<CheckCircle2 size={15} />} color="var(--aura-green)" />
        <KpiCard label="Reabilitação" value={rehabCount} icon={<Activity size={15} />} color="var(--aura-warn)" />
        <KpiCard label="Risco Alto" value={riskCounts.high} icon={<TrendingUp size={15} />} color="#ff9330" />
        <KpiCard label="Risco Crítico" value={riskCounts.critical} icon={<AlertTriangle size={15} />} color="var(--aura-danger)" />
      </div>

      {/* Alerts + Readiness Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Atenção Hoje */}
        <div
          className="lg:col-span-3 rounded-xl border p-5"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
        >
          <h2
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: 'var(--aura-text)' }}
          >
            <AlertTriangle size={14} style={{ color: 'var(--aura-danger)' }} />
            Atenção Hoje
            {alerts.length > 0 && (
              <span
                className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full"
                style={{ background: 'var(--aura-danger-bg)', color: 'var(--aura-danger)' }}
              >
                {alerts.length}
              </span>
            )}
          </h2>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 py-4">
              <CheckCircle2 size={15} style={{ color: 'var(--aura-green)' }} />
              <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
                Plantel sem alertas activos.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {alerts.map(({ athlete, s }) => {
                const score = Math.round(s!.total_score * 100)
                const level = scoreToRisk(score)
                return (
                  <li key={athlete.id}>
                    <Link
                      href={`/athletes/${athlete.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-[var(--aura-bg3)]"
                    >
                      {/* Shirt number */}
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold font-mono shrink-0"
                        style={{ background: 'var(--aura-bg3)', color: 'var(--aura-text2)' }}
                      >
                        {athlete.shirt_number}
                      </span>
                      {/* Name + meta */}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate" style={{ color: 'var(--aura-text)' }}>
                          {athlete.name}
                        </span>
                        <span className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="text-[10px] font-semibold px-1.5 py-px rounded"
                            style={{
                              background: `${POSITION_COLORS[athlete.position] ?? 'var(--aura-text3)'}18`,
                              color: POSITION_COLORS[athlete.position] ?? 'var(--aura-text3)',
                            }}
                          >
                            {athlete.position}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>
                            {s!.score_date}
                          </span>
                        </span>
                      </span>
                      {/* Confidence chip */}
                      <span
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          background: `${RISK_COLORS[level]}18`,
                          color: RISK_COLORS[level],
                        }}
                      >
                        {s!.confidence}
                      </span>
                      <ScoreBadge score={score} level={level} size="sm" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Prontidão do Plantel */}
        <div
          className="lg:col-span-2 rounded-xl border p-5"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
        >
          <h2
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: 'var(--aura-text)' }}
          >
            <Shield size={14} style={{ color: 'var(--aura-green)' }} />
            Prontidão do Plantel
          </h2>
          {/* Stacked progress bar */}
          <div
            className="flex h-3 rounded-full overflow-hidden mb-5"
            style={{ background: 'var(--aura-bg4)', gap: '2px' }}
          >
            {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
              const pct = totalAthletes > 0 ? (riskCounts[level] / totalAthletes) * 100 : 0
              return pct > 0 ? (
                <div key={level} style={{ width: `${pct}%`, background: RISK_COLORS[level] }} />
              ) : null
            })}
          </div>
          {/* Legend */}
          <div className="space-y-3">
            {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
              const count = riskCounts[level]
              const pct = totalAthletes > 0 ? Math.round((count / totalAthletes) * 100) : 0
              return (
                <div key={level} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: RISK_COLORS[level] }} />
                  <span className="flex-1 text-xs" style={{ color: 'var(--aura-text2)' }}>
                    {RISK_LABELS[level]}
                  </span>
                  <span className="text-xs font-mono font-bold" style={{ color: RISK_COLORS[level] }}>
                    {count}
                  </span>
                  <span className="text-[10px] font-mono w-8 text-right" style={{ color: 'var(--aura-text3)' }}>
                    {pct}%
                  </span>
                </div>
              )
            })}
            {riskCounts.none > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--aura-text3)' }} />
                <span className="flex-1 text-xs" style={{ color: 'var(--aura-text3)' }}>Sem dados</span>
                <span className="text-xs font-mono font-bold" style={{ color: 'var(--aura-text3)' }}>
                  {riskCounts.none}
                </span>
                <span className="text-[10px] font-mono w-8 text-right" style={{ color: 'var(--aura-text3)' }}>
                  {totalAthletes > 0 ? Math.round((riskCounts.none / totalAthletes) * 100) : 0}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Wellness + GPS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wellness Hoje */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--aura-text)' }}>
              <Heart size={14} style={{ color: 'var(--aura-blue)' }} />
              Wellness Hoje
            </h2>
            <span className="text-xs font-mono" style={{ color: 'var(--aura-text3)' }}>
              {wellnessCount}
              <span style={{ color: 'var(--aura-border2)' }}>/</span>
              {totalAthletes} check-ins
            </span>
          </div>
          {/* Check-in progress bar */}
          <div className="h-1.5 rounded-full mb-5 overflow-hidden" style={{ background: 'var(--aura-bg4)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: totalAthletes > 0 ? `${(wellnessCount / totalAthletes) * 100}%` : '0%',
                background:
                  totalAthletes > 0 && wellnessCount / totalAthletes >= 0.8
                    ? 'var(--aura-green)'
                    : totalAthletes > 0 && wellnessCount / totalAthletes >= 0.5
                      ? 'var(--aura-warn)'
                      : 'var(--aura-danger)',
              }}
            />
          </div>
          {wellnessCount === 0 ? (
            <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
              Sem check-ins registados hoje.
            </p>
          ) : (
            <div className="space-y-3">
              <WellnessRow
                label="Fadiga média"
                value={avgFatigue !== null ? avgFatigue.toFixed(1) : '—'}
                unit="/ 7"
                status={avgFatigue !== null ? (avgFatigue > 5 ? 'danger' : avgFatigue > 3.5 ? 'warn' : 'ok') : 'none'}
              />
              <WellnessRow
                label="Sono médio"
                value={avgSleep !== null ? avgSleep.toFixed(1) : '—'}
                unit="h"
                status={avgSleep !== null ? (avgSleep < 5.5 ? 'danger' : avgSleep < 6.5 ? 'warn' : 'ok') : 'none'}
              />
              <WellnessRow
                label="HRV Delta"
                value={avgHRV !== null ? (avgHRV >= 0 ? '+' : '') + avgHRV.toFixed(1) : '—'}
                unit="%"
                status={avgHRV !== null ? (avgHRV < -15 ? 'danger' : avgHRV < -5 ? 'warn' : 'ok') : 'none'}
              />
              <WellnessRow
                label="TQR médio"
                value={avgTQR !== null ? avgTQR.toFixed(1) : '—'}
                unit="/ 18"
                status={avgTQR !== null ? (avgTQR < 10 ? 'danger' : avgTQR < 12 ? 'warn' : 'ok') : 'none'}
              />
            </div>
          )}
        </div>

        {/* Última Sessão GPS */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--aura-text)' }}>
              <Gauge size={14} style={{ color: 'var(--aura-purple)' }} />
              Última Sessão GPS
            </h2>
            {lastSessionDate && (
              <div className="flex items-center gap-2">
                {lastSessionType && (
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--aura-blue-bg)', color: 'var(--aura-blue)' }}
                  >
                    {lastSessionType}
                  </span>
                )}
                <span className="text-xs font-mono" style={{ color: 'var(--aura-text3)' }}>
                  {lastSessionDate}
                </span>
              </div>
            )}
          </div>
          {!lastSessionDate ? (
            <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
              Sem sessões GPS registadas.
            </p>
          ) : (
            <div className="space-y-3">
              <GpsRow label="Distância Total" value={gpsAvgDist !== null ? (gpsAvgDist / 1000).toFixed(2) : '—'} unit="km" color="var(--aura-blue)" />
              <GpsRow label="HSR" value={gpsAvgHSR !== null ? Math.round(gpsAvgHSR).toString() : '—'} unit="m" color="var(--aura-green)" />
              <GpsRow label="Sprints" value={gpsAvgSprints !== null ? Math.round(gpsAvgSprints).toString() : '—'} unit="" color="var(--aura-warn)" />
              <GpsRow label="Acelerações" value={gpsAvgAccel !== null ? Math.round(gpsAvgAccel).toString() : '—'} unit="" color="var(--aura-purple)" />
              <GpsRow label="Vmax" value={gpsAvgVmax !== null ? gpsAvgVmax.toFixed(1) : '—'} unit="km/h" color="var(--aura-danger)" />
            </div>
          )}
          {gpsCount > 0 && (
            <p className="mt-4 text-[10px] font-mono" style={{ color: 'var(--aura-text3)' }}>
              Média de {gpsCount} atletas
            </p>
          )}
        </div>
      </div>

      {/* Reabilitação Activa */}
      <div
        className="rounded-xl border"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        <div
          className="px-5 py-4 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--aura-border)' }}
        >
          <Activity size={14} style={{ color: 'var(--aura-warn)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>
            Reabilitação Activa
          </h2>
          <span
            className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'var(--aura-warn-bg)', color: 'var(--aura-warn)' }}
          >
            {rehabCount}
          </span>
        </div>
        {rehabCount === 0 ? (
          <div className="px-5 py-4 flex items-center gap-2">
            <CheckCircle2 size={14} style={{ color: 'var(--aura-green)' }} />
            <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
              Sem atletas em reabilitação.
            </p>
          </div>
        ) : (
          <ul>
            {rehabAthletes.map((athlete, i) => {
              const s = latestScoreMap.get(athlete.id)
              const score = s ? Math.round(s.total_score * 100) : null
              const level = score !== null ? scoreToRisk(score) : null
              return (
                <li
                  key={athlete.id}
                  className={i < rehabAthletes.length - 1 ? 'border-b' : ''}
                  style={{ borderColor: 'var(--aura-border)' }}
                >
                  <Link
                    href={`/athletes/${athlete.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--aura-bg3)] transition-colors"
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold font-mono shrink-0"
                      style={{ background: 'var(--aura-bg4)', color: 'var(--aura-text2)' }}
                    >
                      {athlete.shirt_number}
                    </span>
                    <span className="flex-1 text-sm font-medium" style={{ color: 'var(--aura-text)' }}>
                      {athlete.name}
                    </span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: `${POSITION_COLORS[athlete.position] ?? 'var(--aura-text3)'}18`,
                        color: POSITION_COLORS[athlete.position] ?? 'var(--aura-text3)',
                      }}
                    >
                      {athlete.position}
                    </span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--aura-warn-bg)', color: 'var(--aura-warn)' }}
                    >
                      reabilitação
                    </span>
                    {score !== null && level !== null && (
                      <ScoreBadge score={score} level={level} size="sm" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function KpiCard({
  label, value, icon, color,
}: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs" style={{ color: 'var(--aura-text2)' }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <p className="text-3xl font-bold font-mono" style={{ color }}>{value}</p>
    </div>
  )
}

const METRIC_STATUS_COLORS = {
  ok: 'var(--aura-green)',
  warn: 'var(--aura-warn)',
  danger: 'var(--aura-danger)',
  none: 'var(--aura-text3)',
}

function WellnessRow({
  label, value, unit, status,
}: { label: string; value: string; unit: string; status: 'ok' | 'warn' | 'danger' | 'none' }) {
  const color = METRIC_STATUS_COLORS[status]
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--aura-text2)' }}>{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-sm font-mono font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-xs" style={{ color: 'var(--aura-text3)' }}>{unit}</span>}
      </span>
    </div>
  )
}

function GpsRow({
  label, value, unit, color,
}: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--aura-text2)' }}>{label}</span>
      <span className="flex items-center gap-1">
        <span className="text-sm font-mono font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-xs" style={{ color: 'var(--aura-text3)' }}>{unit}</span>}
      </span>
    </div>
  )
}
