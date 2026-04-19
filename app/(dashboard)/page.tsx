import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ScoreBadge } from '@/components/athlete/ScoreBadge'
import { scoreToRisk } from '@/lib/utils'
import {
  AlertTriangle, Users, Activity, Heart, TrendingUp,
  Gauge, CheckCircle2, Shield, ChevronRight, Zap,
  BarChart3, ArrowRight,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const
type Position = typeof POSITIONS[number]

const POSITION_LABELS: Record<Position, string> = {
  GK: 'Guarda-Redes',
  DEF: 'Defesas',
  MID: 'Médios',
  FWD: 'Avançados',
}

const POSITION_COLORS: Record<string, string> = {
  GK:  'var(--aura-warn)',
  DEF: 'var(--aura-blue)',
  MID: 'var(--aura-green)',
  FWD: 'var(--aura-danger)',
}

const RISK_COLORS: Record<string, string> = {
  critical: 'var(--aura-danger)',
  high:     '#ff9330',
  medium:   'var(--aura-warn)',
  low:      'var(--aura-green)',
}

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export default async function HomePage() {
  const supabase = await createClient()

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, shirt_number, position, status')
    .eq('active', true)
    .order('shirt_number')

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const { data: allScores } = await supabase
    .from('score_history')
    .select('athlete_id, total_score, confidence, score_date')
    .gte('score_date', sevenDaysAgo)
    .order('score_date', { ascending: false })

  const todayISO = new Date().toISOString().split('T')[0]
  const { data: todayWellness } = await supabase
    .from('wellness_checkins')
    .select('athlete_id, fatigue, sleep_hours, hrv_delta, TQR')
    .gte('created_at', todayISO + 'T00:00:00')

  const { data: gpsData } = await supabase
    .from('gps_sessions')
    .select('session_date, session_type')
    .order('session_date', { ascending: false })
    .limit(1)

  // ── Derived ─────────────────────────────────────────────────

  const latestScoreMap = new Map<string, { total_score: number; confidence: string; score_date: string }>()
  for (const s of allScores ?? []) {
    if (!latestScoreMap.has(s.athlete_id)) latestScoreMap.set(s.athlete_id, s)
  }

  const totalAthletes = athletes?.length ?? 0
  const available     = athletes?.filter((a) => a.status === 'available').length ?? 0
  const rehabAthletes = athletes?.filter((a) => a.status === 'rehab') ?? []
  const rehabCount    = rehabAthletes.length

  const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const athlete of athletes ?? []) {
    const s = latestScoreMap.get(athlete.id)
    if (!s) continue
    const score = Math.round(s.total_score * 100)
    if (score >= 85)      riskCounts.critical++
    else if (score >= 65) riskCounts.high++
    else if (score >= 50) riskCounts.medium++
    else                  riskCounts.low++
  }

  const alerts = (athletes ?? [])
    .map((a) => ({ athlete: a, s: latestScoreMap.get(a.id) }))
    .filter((x) => x.s && Math.round(x.s.total_score * 100) >= 65)
    .sort((a, b) => b.s!.total_score - a.s!.total_score)

  const squadByPosition = POSITIONS.reduce((acc, pos) => {
    acc[pos] = (athletes ?? []).filter((a) => a.position === pos)
    return acc
  }, {} as Record<Position, typeof athletes>)

  const wellness      = todayWellness ?? []
  const wellnessCount = wellness.length
  const avgFatigue    = wellnessCount ? avg(wellness.map((w) => w.fatigue     ?? 0)) : null
  const avgSleep      = wellnessCount ? avg(wellness.map((w) => w.sleep_hours ?? 0)) : null
  const avgHRV        = wellnessCount ? avg(wellness.map((w) => w.hrv_delta   ?? 0)) : null
  const avgTQR        = wellnessCount ? avg(wellness.map((w) => w.TQR         ?? 0)) : null

  const lastSessionDate = gpsData?.[0]?.session_date ?? null

  const hasAlerts   = alerts.length > 0
  const firstAlert  = alerts[0]?.athlete.id

  const dateLabel = new Date().toLocaleDateString('pt-PT', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const checkInRatio = totalAthletes > 0 ? wellnessCount / totalAthletes : 0

  return (
    <div className="space-y-6">

      {/* ── 1. Header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold capitalize"
            style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
          >
            {dateLabel}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {hasAlerts ? (
              <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--aura-danger)' }}>
                <AlertTriangle size={13} />
                {alerts.length} atleta{alerts.length > 1 ? 's' : ''} requer{alerts.length === 1 ? '' : 'em'} atenção
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--aura-green)' }}>
                <CheckCircle2 size={13} />
                Plantel sem alertas
              </span>
            )}
            <span style={{ color: 'var(--aura-border2)' }}>·</span>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded-full"
              style={{
                background: checkInRatio >= 0.8 ? 'var(--aura-green-bg)' : 'var(--aura-bg3)',
                color: checkInRatio >= 0.8 ? 'var(--aura-green)' : 'var(--aura-text3)',
              }}
            >
              {wellnessCount}/{totalAthletes} check-ins
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. KPI Strip ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Plantel"  value={totalAthletes}       icon={<Users size={15} />}         color="var(--aura-blue)"   />
        <KpiCard label="Disponíveis"    value={available}           icon={<CheckCircle2 size={15} />}  color="var(--aura-green)"  />
        <KpiCard label="Reabilitação"   value={rehabCount}          icon={<Activity size={15} />}      color="var(--aura-warn)"   />
        <KpiCard label="Risco Alto"     value={riskCounts.high}     icon={<TrendingUp size={15} />}    color="#ff9330"            />
        <KpiCard label="Risco Crítico"  value={riskCounts.critical} icon={<AlertTriangle size={15} />} color="var(--aura-danger)" />
      </div>

      {/* ── 3. Alerts ──────────────────────────────────────── */}
      {hasAlerts && (
        <div
          className="rounded-xl border p-4"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2"
            style={{ color: 'var(--aura-danger)' }}
          >
            <AlertTriangle size={12} />
            Atenção Imediata
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {alerts.map(({ athlete, s }) => {
              const score = Math.round(s!.total_score * 100)
              const level = scoreToRisk(score)
              return (
                <Link
                  key={athlete.id}
                  href={`/athletes/${athlete.id}`}
                  className="flex-shrink-0 flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:border-[var(--aura-border2)]"
                  style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border)' }}
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold font-mono shrink-0"
                    style={{ background: 'var(--aura-bg4)', color: 'var(--aura-text2)' }}
                  >
                    {athlete.shirt_number}
                  </span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>
                      {athlete.name}
                    </p>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-px rounded"
                      style={{
                        background: `${POSITION_COLORS[athlete.position] ?? 'var(--aura-text3)'}18`,
                        color: POSITION_COLORS[athlete.position] ?? 'var(--aura-text3)',
                      }}
                    >
                      {athlete.position}
                    </span>
                  </div>
                  <ScoreBadge score={score} level={level} size="sm" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 4. Squad by Position ───────────────────────────── */}
      <div>
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--aura-text3)' }}
        >
          Plantel por Posição
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {POSITIONS.map((pos) => {
            const group = squadByPosition[pos] ?? []
            const posScores = group
              .map((a) => latestScoreMap.get(a.id))
              .filter(Boolean)
              .map((s) => Math.round(s!.total_score * 100))
            const avgScore = posScores.length ? Math.round(avg(posScores)) : null
            const posColor = POSITION_COLORS[pos]

            return (
              <div
                key={pos}
                className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
              >
                <div
                  className="px-3 py-2.5 flex items-center justify-between border-b"
                  style={{
                    borderColor: 'var(--aura-border)',
                    borderLeft: `3px solid ${posColor}`,
                    background: `${posColor}0a`,
                  }}
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11px] font-bold font-mono" style={{ color: posColor }}>
                      {pos}
                    </span>
                    <span className="text-[10px] hidden sm:inline" style={{ color: 'var(--aura-text3)' }}>
                      {POSITION_LABELS[pos]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono" style={{ color: 'var(--aura-text3)' }}>
                      {group.length}
                    </span>
                    {avgScore !== null && (
                      <span
                        className="text-[10px] font-mono font-bold px-1.5 py-px rounded"
                        style={{
                          background: `${RISK_COLORS[scoreToRisk(avgScore)]}18`,
                          color: RISK_COLORS[scoreToRisk(avgScore)],
                        }}
                      >
                        ⌀{avgScore}%
                      </span>
                    )}
                  </div>
                </div>

                <ul>
                  {group.length === 0 ? (
                    <li className="px-3 py-3 text-xs" style={{ color: 'var(--aura-text3)' }}>
                      Sem atletas
                    </li>
                  ) : (
                    group.map((athlete, i) => {
                      const scoreRow = latestScoreMap.get(athlete.id)
                      const score = scoreRow ? Math.round(scoreRow.total_score * 100) : null
                      const level = score !== null ? scoreToRisk(score) : null
                      return (
                        <li
                          key={athlete.id}
                          className={i < group.length - 1 ? 'border-b' : ''}
                          style={{ borderColor: 'var(--aura-border)' }}
                        >
                          <Link
                            href={`/athletes/${athlete.id}`}
                            className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-[var(--aura-bg3)]"
                            style={athlete.status === 'rehab' ? { opacity: 0.6 } : {}}
                          >
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0"
                              style={{ background: 'var(--aura-bg4)', color: 'var(--aura-text2)' }}
                            >
                              {athlete.shirt_number}
                            </span>
                            <span
                              className="flex-1 text-xs font-medium truncate"
                              style={{ color: 'var(--aura-text)' }}
                            >
                              {athlete.name}
                            </span>
                            {athlete.status === 'rehab' && (
                              <span
                                className="text-[9px] font-bold px-1 py-px rounded shrink-0"
                                style={{ background: 'var(--aura-warn-bg)', color: 'var(--aura-warn)' }}
                              >
                                R
                              </span>
                            )}
                            {score !== null && level ? (
                              <ScoreBadge score={score} level={level} size="sm" />
                            ) : (
                              <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--aura-text3)' }}>
                                —
                              </span>
                            )}
                          </Link>
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 5. Quick Navigation Hub ────────────────────────── */}
      <div>
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--aura-text3)' }}
        >
          Acesso Rápido
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <NavCard
            href="/squad"
            icon={<Users size={16} />}
            title="Plantel Completo"
            sub={`${available} disponíveis · ${rehabCount} em rehab`}
            color="var(--aura-blue)"
          />
          <NavCard
            href="/readiness"
            icon={<Shield size={16} />}
            title="Prontidão"
            sub={wellnessCount > 0 ? `${wellnessCount} check-ins hoje` : 'Ver estado de prontidão'}
            color="var(--aura-green)"
          />
          <NavCard
            href="/load"
            icon={<Gauge size={16} />}
            title="Carga & GPS"
            sub={lastSessionDate ? `Última sessão: ${lastSessionDate}` : 'Sem sessões registadas'}
            color="var(--aura-purple)"
          />
          <NavCard
            href="/performance"
            icon={<Zap size={16} />}
            title="Máximos & Perfil"
            sub="Velocidade máxima e perfis"
            color="var(--aura-warn)"
          />
          <NavCard
            href="/female-squad"
            icon={<Heart size={16} />}
            title="Seleção Feminina"
            sub="Ciclo menstrual e risco LCA"
            color="var(--aura-purple)"
          />
          <NavCard
            href={firstAlert ? `/athletes/${firstAlert}` : '/squad'}
            icon={<BarChart3 size={16} />}
            title="Avaliação Atleta"
            sub={hasAlerts ? `${alerts.length} atleta${alerts.length > 1 ? 's' : ''} em risco` : 'Ver avaliações'}
            color={hasAlerts ? 'var(--aura-danger)' : 'var(--aura-text2)'}
          />
        </div>
      </div>

      {/* ── 6. Wellness + Rehab ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Wellness Pulse */}
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
          <div className="h-1.5 rounded-full mb-5 overflow-hidden" style={{ background: 'var(--aura-bg4)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: totalAthletes > 0 ? `${checkInRatio * 100}%` : '0%',
                background: checkInRatio >= 0.8 ? 'var(--aura-green)'
                  : checkInRatio >= 0.5 ? 'var(--aura-warn)'
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
                label="Fadiga média" value={avgFatigue !== null ? avgFatigue.toFixed(1) : '—'} unit="/ 7"
                status={avgFatigue !== null ? (avgFatigue > 5 ? 'danger' : avgFatigue > 3.5 ? 'warn' : 'ok') : 'none'}
              />
              <WellnessRow
                label="Sono médio" value={avgSleep !== null ? avgSleep.toFixed(1) : '—'} unit="h"
                status={avgSleep !== null ? (avgSleep < 5.5 ? 'danger' : avgSleep < 6.5 ? 'warn' : 'ok') : 'none'}
              />
              <WellnessRow
                label="HRV Delta" value={avgHRV !== null ? (avgHRV >= 0 ? '+' : '') + avgHRV.toFixed(1) : '—'} unit="%"
                status={avgHRV !== null ? (avgHRV < -15 ? 'danger' : avgHRV < -5 ? 'warn' : 'ok') : 'none'}
              />
              <WellnessRow
                label="TQR médio" value={avgTQR !== null ? avgTQR.toFixed(1) : '—'} unit="/ 18"
                status={avgTQR !== null ? (avgTQR < 10 ? 'danger' : avgTQR < 12 ? 'warn' : 'ok') : 'none'}
              />
            </div>
          )}
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
                      href={`/athletes/${athlete.id}/rehab`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--aura-bg3)] transition-colors"
                    >
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold font-mono shrink-0"
                        style={{ background: 'var(--aura-bg4)', color: 'var(--aura-text2)' }}
                      >
                        {athlete.shirt_number}
                      </span>
                      <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--aura-text)' }}>
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
                      {score !== null && level !== null && (
                        <ScoreBadge score={score} level={level} size="sm" />
                      )}
                      <ChevronRight size={13} style={{ color: 'var(--aura-text3)' }} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────

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

function NavCard({
  href, icon, title, sub, color,
}: { href: string; icon: React.ReactNode; title: string; sub: string; color: string }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border p-4 flex items-start gap-3 transition-colors hover:border-[var(--aura-border2)]"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${color}18`, color }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>{title}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--aura-text3)' }}>{sub}</p>
      </div>
      <ArrowRight
        size={14}
        className="shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
        style={{ color: 'var(--aura-text3)' }}
      />
    </Link>
  )
}

const METRIC_STATUS_COLORS = {
  ok:     'var(--aura-green)',
  warn:   'var(--aura-warn)',
  danger: 'var(--aura-danger)',
  none:   'var(--aura-text3)',
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
