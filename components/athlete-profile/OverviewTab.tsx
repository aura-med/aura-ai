'use client'

import { AlertTriangle } from 'lucide-react'
import type { AthleteProfileData, InjuryEventSummary, BodyRegion, BodyZoneInfo } from '@/types/athlete-profile'
import { BodyMap } from './BodyMap'

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number | null) {
  if (score === null) return 'var(--aura-text3)'
  if (score < 40)  return 'var(--aura-green)'
  if (score < 65)  return 'var(--aura-warn)'
  if (score < 85)  return '#ff9330'
  return 'var(--aura-danger)'
}

function scoreBg(score: number | null) {
  if (score === null) return 'var(--aura-bg3)'
  if (score < 40)  return 'var(--aura-green-bg)'
  if (score < 65)  return 'var(--aura-warn-bg)'
  if (score < 85)  return 'rgba(255,147,48,0.12)'
  return 'var(--aura-danger-bg)'
}

function scoreLabel(score: number | null) {
  if (score === null) return 'Sem dados'
  if (score < 40)  return 'Baixo'
  if (score < 65)  return 'Moderado'
  if (score < 85)  return 'Alto'
  return 'Crítico'
}

const STATUS_CONFIG = {
  available:   { label: '🟢 Disponível',         color: 'var(--aura-green)',  bg: 'var(--aura-green-bg)'  },
  modified:    { label: '🟡 Treino Modificado',   color: 'var(--aura-warn)',   bg: 'var(--aura-warn-bg)'   },
  unavailable: { label: '🔴 Indisponível',        color: 'var(--aura-danger)', bg: 'var(--aura-danger-bg)' },
  rehab:       { label: '🔴 Reabilitação',        color: 'var(--aura-danger)', bg: 'var(--aura-danger-bg)' },
}

const VAR_LABELS: Record<string, string> = {
  history: 'Historial Lesões',
  acwr:    'ACWR GPS',
  hrv:     'HRV Δ Baseline',
  fatigue: 'Fadiga (Hooper)',
  sleep:   'Sono (horas)',
  tqr:     'TQR',
  stress:  'Stress',
  decel:   'Dec. Alta Int.',
  md:      'MD+n',
}

type InjuryTimelinePoint = {
  label: string
  injuries: number
  severity: number
}

function InjuryTimelineChart({ data }: { data: InjuryTimelinePoint[] }) {
  const width = 360
  const height = 96
  const chartTop = 8
  const chartHeight = 58
  const maxInjuries = Math.max(1, ...data.map((point) => point.injuries))
  const step = data.length > 1 ? width / (data.length - 1) : width
  const points = data.map((point, index) => {
    const x = index * step
    const y = chartTop + chartHeight - (point.injuries / maxInjuries) * chartHeight
    return { ...point, x, y }
  })
  const areaPath = points.length
    ? [
        `M ${points[0].x} ${chartTop + chartHeight}`,
        ...points.map((point) => `L ${point.x} ${point.y}`),
        `L ${points[points.length - 1].x} ${chartTop + chartHeight}`,
        'Z',
      ].join(' ')
    : ''
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  return (
    <div className="h-[100px]">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolucao mensal de lesoes" className="h-full w-full overflow-visible">
        {[0, 1, 2].map((line) => {
          const y = chartTop + (chartHeight / 2) * line
          return <line key={line} x1="0" x2={width} y1={y} y2={y} stroke="var(--aura-border)" strokeDasharray="3 3" />
        })}
        <path d={areaPath} fill="var(--aura-danger-bg)" />
        <path d={linePath} fill="none" stroke="var(--aura-danger)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {points.map((point) => (
          <g key={`${point.label}-${point.x}`}>
            <circle cx={point.x} cy={point.y} r={point.injuries > 0 ? 3 : 2} fill="var(--aura-danger)" />
            <text x={point.x} y="88" textAnchor="middle" fontSize="9" fill="var(--aura-text3)">
              {point.label}
            </text>
            {point.injuries > 0 && (
              <title>{`${point.label}: ${point.injuries} lesao(oes)`}</title>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── Status Card ───────────────────────────────────────────────────────────────

function StatusCard({ status, score }: { status: string; score: number | null }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.available
  return (
    <div
      className="rounded-xl border p-4 flex items-center justify-between gap-4"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <div className="space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
          Disponibilidade
        </p>
        <p className="text-sm font-bold" style={{ color: cfg.color }}>
          {cfg.label}
        </p>
      </div>
      {/* Risk score ring */}
      <div className="flex flex-col items-center gap-0.5">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg font-mono border-2"
          style={{ borderColor: scoreColor(score), color: scoreColor(score), background: scoreBg(score) }}
        >
          {score ?? '—'}
        </div>
        <p className="text-[10px] font-semibold" style={{ color: scoreColor(score) }}>
          {scoreLabel(score)}
        </p>
      </div>
    </div>
  )
}

// ── Allergies Highlight ───────────────────────────────────────────────────────

function AllergiesHighlight({ allergies }: { allergies: string | null | undefined }) {
  if (!allergies) return null
  return (
    <div
      className="rounded-xl border p-3 flex items-start gap-3"
      style={{ background: 'var(--aura-danger-bg)', borderColor: 'var(--aura-danger)' }}
    >
      <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--aura-danger)' }} />
      <div>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--aura-danger)' }}>
          ⚠️ Alergias
        </p>
        <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--aura-danger)' }}>
          {allergies}
        </p>
      </div>
    </div>
  )
}

// ── Injury Timeline ───────────────────────────────────────────────────────────

function InjuryTimeline({ injuries }: { injuries: InjuryEventSummary[] }) {
  // Build month-by-month data for the last 12 months of the sports season
  const now = new Date()
  const seasonStart = now.getMonth() >= 6
    ? new Date(now.getFullYear(), 6, 1)        // Jul this year
    : new Date(now.getFullYear() - 1, 6, 1)   // Jul last year

  const months: { label: string; month: Date; injuries: number; severity: number }[] = []
  for (let i = 0; i < 12; i++) {
    const m = new Date(seasonStart.getFullYear(), seasonStart.getMonth() + i, 1)
    const mNext = new Date(m.getFullYear(), m.getMonth() + 1, 1)
    const inMonth = injuries.filter((inj) => {
      const d = new Date(inj.injury_date)
      return d >= m && d < mNext
    })
    months.push({
      label: m.toLocaleDateString('pt-PT', { month: 'short' }),
      month: m,
      injuries: inMonth.length,
      severity: inMonth.reduce((acc, inj) => {
        const sv: Record<string, number> = { minor: 1, moderate: 2, major: 3, severe: 4 }
        return acc + (sv[inj.severity ?? ''] ?? 1)
      }, 0),
    })
  }

  const hasData = months.some((m) => m.injuries > 0)

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
          Injury Timeline — Época Desportiva
        </p>
        <p className="text-[10px] font-mono" style={{ color: 'var(--aura-text3)' }}>
          Jul – Jun
        </p>
      </div>

      {!hasData ? (
        <p className="text-xs text-center py-4" style={{ color: 'var(--aura-text3)' }}>
          Sem lesões registadas esta época
        </p>
      ) : (
        <InjuryTimelineChart data={months} />
      )}
    </div>
  )
}

// ── Risk Breakdown ────────────────────────────────────────────────────────────

function RiskBreakdown({
  partials,
  dominantVariable,
}: {
  partials: Record<string, number | null>
  dominantVariable: string | null
}) {
  const vars = Object.entries(VAR_LABELS)

  function barColor(v: number | null) {
    if (v === null) return 'var(--aura-bg4)'
    if (v < 0.4)  return 'var(--aura-green)'
    if (v < 0.65) return 'var(--aura-warn)'
    if (v < 0.85) return '#ff9330'
    return 'var(--aura-danger)'
  }

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
        Risk Breakdown — 9 Variáveis
      </p>
      <div className="space-y-2">
        {vars.map(([key, label]) => {
          const val = partials[key] ?? null
          const pct = val !== null ? Math.round(val * 100) : null
          const isDominant = key === dominantVariable
          return (
            <div key={key} className="flex items-center gap-2">
              <div className="w-28 shrink-0 flex items-center gap-1">
                <p className="text-[10px] truncate" style={{ color: isDominant ? 'var(--aura-text)' : 'var(--aura-text3)' }}>
                  {label}
                </p>
                {isDominant && (
                  <span className="text-[8px] font-bold px-1 rounded" style={{ background: 'var(--aura-warn-bg)', color: 'var(--aura-warn)' }}>
                    ↑
                  </span>
                )}
              </div>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--aura-bg4)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct ?? 0}%`, background: barColor(val) }}
                />
              </div>
              <p className="w-8 text-right text-[10px] font-mono" style={{ color: val !== null ? 'var(--aura-text2)' : 'var(--aura-text3)' }}>
                {pct !== null ? `${pct}%` : '—'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function OverviewTab({ profile }: { profile: AthleteProfileData }) {
  // Build zone map from injury events
  const zoneMap = new Map<BodyRegion, BodyZoneInfo>()
  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())

  for (const inj of profile.injuryEvents) {
    // Try to match location to a BodyRegion
    const region = inferRegion(inj.location)
    if (!region) continue
    const existing = zoneMap.get(region)
    const injDate = new Date(inj.injury_date)
    const isActive = inj.is_active
    const isRecent = !isActive && injDate >= sixMonthsAgo
    const status = isActive ? 'active' : isRecent ? 'recent' : 'clear'

    if (!existing || rankStatus(status) > rankStatus(existing.status)) {
      zoneMap.set(region, { region, status, injuries: [] })
    }
    zoneMap.get(region)!.injuries.push(inj)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ── Left column ──────────────────────────────────────────────────── */}
      <div className="space-y-4 lg:col-span-2">
        <StatusCard status={profile.status} score={profile.score} />
        <AllergiesHighlight allergies={profile.medicalHistory?.allergies} />
        <InjuryTimeline injuries={profile.injuryEvents} />
        <RiskBreakdown
          partials={profile.partials}
          dominantVariable={profile.dominantVariable}
        />
      </div>

      {/* ── Right column: Body Map ────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-4"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--aura-text3)' }}>
          Mapa Corporal
        </p>
        <BodyMap zoneMap={zoneMap} />
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rankStatus(s: 'clear' | 'recent' | 'active') {
  return s === 'active' ? 2 : s === 'recent' ? 1 : 0
}

function inferRegion(location: string | null): BodyRegion | null {
  if (!location) return null
  const l = location.toLowerCase()
  if (l.includes('head') || l.includes('cabeça') || l.includes('cranio')) return 'head'
  if (l.includes('neck') || l.includes('pescoço') || l.includes('cervical')) return 'neck'
  if (l.includes('shoulder') || l.includes('ombro')) return 'shoulder'
  if (l.includes('chest') || l.includes('tórax') || l.includes('peit')) return 'chest'
  if (l.includes('abdomen') || l.includes('abdómen') || l.includes('abdominal')) return 'abdomen'
  if (l.includes('hip') || l.includes('anca') || l.includes('inguinal')) return 'hip'
  if (l.includes('hamstring') || l.includes('isquio') || l.includes('biceps fem')) return 'hamstring'
  if (l.includes('thigh') || l.includes('coxa') || l.includes('quadric')) return 'thigh'
  if (l.includes('knee') || l.includes('joelho') || l.includes('patel')) return 'knee'
  if (l.includes('calf') || l.includes('gémeo') || l.includes('gastro') || l.includes('soleo')) return 'calf'
  if (l.includes('ankle') || l.includes('tornozelo') || l.includes('talo')) return 'ankle'
  if (l.includes('foot') || l.includes('pé') || l.includes('plantar')) return 'foot'
  if (l.includes('lower back') || l.includes('lombar') || l.includes('coluna')) return 'lower_back'
  if (l.includes('upper back') || l.includes('dorsal') || l.includes('costas')) return 'upper_back'
  if (l.includes('glute') || l.includes('glúteo') || l.includes('piri')) return 'glute'
  if (l.includes('elbow') || l.includes('cotovelo')) return 'elbow'
  if (l.includes('wrist') || l.includes('pulso')) return 'wrist'
  return null
}
