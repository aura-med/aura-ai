'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { AlertTriangle, Plus, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveDiagnosis } from '@/lib/actions/clinical'
import { useRouter } from 'next/navigation'
import type { AthleteProfileData, InjuryEventSummary, ActiveDiagnosis } from '@/types/athlete-profile'

const DiagnosisModal = dynamic(() => import('./DiagnosisModal').then((m) => m.DiagnosisModal))

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
  available:   { label: '🟢 Disponível',   color: 'var(--aura-green)',  bg: 'var(--aura-green-bg)'           },
  evaluation:  { label: '🟡 Em Avaliação', color: 'var(--aura-warn)',   bg: 'var(--aura-warn-bg)'            },
  unavailable: { label: '🔴 Indisponível', color: 'var(--aura-danger)', bg: 'var(--aura-danger-bg)'          },
  rtp:         { label: '🟣 Em RTP',        color: 'var(--aura-purple)', bg: 'rgba(180,141,252,0.12)'         },
  // Legacy values — fallback
  modified:    { label: '🟡 Treino Modificado', color: 'var(--aura-warn)',   bg: 'var(--aura-warn-bg)'        },
  rehab:       { label: '🟣 Em Reabilitação',   color: 'var(--aura-purple)', bg: 'rgba(180,141,252,0.12)'    },
}

const DIAG_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  available:   { label: 'Disponível',   color: 'var(--aura-green)',  bg: 'var(--aura-green-bg)' },
  evaluation:  { label: 'Em Avaliação', color: 'var(--aura-warn)',   bg: 'var(--aura-warn-bg)'  },
  unavailable: { label: 'Indisponível', color: 'var(--aura-danger)', bg: 'var(--aura-danger-bg)' },
  rtp:         { label: 'Em RTP',        color: 'var(--aura-purple)', bg: 'rgba(180,141,252,0.12)' },
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

type InjuryTimelinePoint = { label: string; injuries: number; severity: number }

function InjuryTimelineChart({ data }: { data: InjuryTimelinePoint[] }) {
  const width = 360
  const height = 96
  const chartTop = 8
  const chartHeight = 58
  const maxInjuries = Math.max(1, ...data.map((p) => p.injuries))
  const step = data.length > 1 ? width / (data.length - 1) : width
  const points = data.map((p, i) => ({
    ...p,
    x: i * step,
    y: chartTop + chartHeight - (p.injuries / maxInjuries) * chartHeight,
  }))
  const areaPath = points.length
    ? [`M ${points[0].x} ${chartTop + chartHeight}`, ...points.map((p) => `L ${p.x} ${p.y}`), `L ${points[points.length - 1].x} ${chartTop + chartHeight}`, 'Z'].join(' ')
    : ''
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="h-[100px]">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolucao mensal de lesoes" className="h-full w-full overflow-visible">
        {[0, 1, 2].map((l) => {
          const y = chartTop + (chartHeight / 2) * l
          return <line key={l} x1="0" x2={width} y1={y} y2={y} stroke="var(--aura-border)" strokeDasharray="3 3" />
        })}
        <path d={areaPath} fill="var(--aura-danger-bg)" />
        <path d={linePath} fill="none" stroke="var(--aura-danger)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {points.map((p) => (
          <g key={`${p.label}-${p.x}`}>
            <circle cx={p.x} cy={p.y} r={p.injuries > 0 ? 3 : 2} fill="var(--aura-danger)" />
            <text x={p.x} y="88" textAnchor="middle" fontSize="9" fill="var(--aura-text3)">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function StatusCard({ availabilityStatus, score }: { availabilityStatus: string; score: number | null }) {
  const cfg = STATUS_CONFIG[availabilityStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.available
  return (
    <div
      className="rounded-xl border p-4 flex items-center justify-between gap-4"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <div className="space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
          Disponibilidade
        </p>
        <p className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg font-mono border-2"
          style={{ borderColor: scoreColor(score), color: scoreColor(score), background: scoreBg(score) }}
        >
          {score ?? '—'}
        </div>
        <p className="text-[10px] font-semibold" style={{ color: scoreColor(score) }}>{scoreLabel(score)}</p>
      </div>
    </div>
  )
}

function AllergiesHighlight({ allergies }: { allergies: string | null | undefined }) {
  if (!allergies) return null
  return (
    <div
      className="rounded-xl border p-3 flex items-start gap-3"
      style={{ background: 'var(--aura-danger-bg)', borderColor: 'var(--aura-danger)' }}
    >
      <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--aura-danger)' }} />
      <div>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--aura-danger)' }}>⚠️ Alergias</p>
        <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--aura-danger)' }}>{allergies}</p>
      </div>
    </div>
  )
}

function ActiveOccurrencesAlert({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <div
      className="rounded-xl border p-3 flex items-start gap-3"
      style={{ background: 'var(--aura-warn-bg)', borderColor: 'var(--aura-warn)' }}
    >
      <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--aura-warn)' }} />
      <p className="text-xs font-semibold" style={{ color: 'var(--aura-warn)' }}>
        {count} ocorrência{count > 1 ? 's' : ''} ativa{count > 1 ? 's' : ''} em acompanhamento
      </p>
    </div>
  )
}

function InjuryTimeline({ injuries }: { injuries: InjuryEventSummary[] }) {
  const now = new Date()
  const seasonStart = now.getMonth() >= 6
    ? new Date(now.getFullYear(), 6, 1)
    : new Date(now.getFullYear() - 1, 6, 1)

  const months: { label: string; month: Date; injuries: number; severity: number }[] = []
  for (let i = 0; i < 12; i++) {
    const m = new Date(seasonStart.getFullYear(), seasonStart.getMonth() + i, 1)
    const mNext = new Date(m.getFullYear(), m.getMonth() + 1, 1)
    const inMonth = injuries.filter((inj) => { const d = new Date(inj.injury_date); return d >= m && d < mNext })
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
    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
          Injury Timeline — Época Desportiva
        </p>
        <p className="text-[10px] font-mono" style={{ color: 'var(--aura-text3)' }}>Jul – Jun</p>
      </div>
      {!hasData ? (
        <p className="text-xs text-center py-4" style={{ color: 'var(--aura-text3)' }}>Sem lesões registadas esta época</p>
      ) : (
        <InjuryTimelineChart data={months} />
      )}
    </div>
  )
}

function RiskBreakdown({ partials, dominantVariable }: { partials: Record<string, number | null>; dominantVariable: string | null }) {
  const vars = Object.entries(VAR_LABELS)

  function barColor(v: number | null) {
    if (v === null) return 'var(--aura-bg4)'
    if (v < 0.4)  return 'var(--aura-green)'
    if (v < 0.65) return 'var(--aura-warn)'
    if (v < 0.85) return '#ff9330'
    return 'var(--aura-danger)'
  }

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
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
                <p className="text-[10px] truncate" style={{ color: isDominant ? 'var(--aura-text)' : 'var(--aura-text3)' }}>{label}</p>
                {isDominant && (
                  <span className="text-[8px] font-bold px-1 rounded" style={{ background: 'var(--aura-warn-bg)', color: 'var(--aura-warn)' }}>↑</span>
                )}
              </div>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--aura-bg4)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct ?? 0}%`, background: barColor(val) }} />
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

// ── Active Diagnoses Section ──────────────────────────────────────────────────

function DiagnosisCard({
  diag,
  athleteId,
  canResolve,
  onResolved,
}: {
  diag: ActiveDiagnosis
  athleteId: string
  canResolve: boolean
  onResolved: (id: string) => void
}) {
  const [resolving, setResolving] = useState(false)
  const router = useRouter()
  const statusCfg = DIAG_STATUS_CONFIG[diag.availability_status ?? 'evaluation'] ?? DIAG_STATUS_CONFIG.evaluation
  const title = diag.osiics_description ?? diag.custom_description ?? 'Diagnóstico sem descrição'

  async function handleResolve() {
    setResolving(true)
    try {
      // Author/recompute handled server-side (resolved_by can't be forged).
      await resolveDiagnosis(diag.id, athleteId)
      onResolved(diag.id)
      router.refresh()
    } finally {
      setResolving(false)
    }
  }

  return (
    <div
      className="rounded-lg border p-3 space-y-2"
      style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {diag.osiics_code && (
            <span className="text-[10px] font-mono mr-1.5" style={{ color: 'var(--aura-text3)' }}>
              {diag.osiics_code}
            </span>
          )}
          <span className="text-xs font-semibold" style={{ color: 'var(--aura-text)' }}>{title}</span>
          {diag.custom_description && diag.osiics_description && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>{diag.custom_description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: statusCfg.bg, color: statusCfg.color }}
          >
            {statusCfg.label}
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--aura-bg4)', color: 'var(--aura-text3)' }}>
            {diag.diagnosis_type === 'injury' ? 'Lesão' : diag.diagnosis_type === 'disease' ? 'Doença' : '—'}
          </span>
        </div>
      </div>
      {canResolve && (
        <button
          type="button"
          onClick={handleResolve}
          disabled={resolving}
          className="flex items-center gap-1 text-[10px] font-medium hover:opacity-80"
          style={{ color: 'var(--aura-green)' }}
        >
          {resolving ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
          Resolver diagnóstico
        </button>
      )}
    </div>
  )
}

function ActiveDiagnosesSection({
  diagnoses: initialDiagnoses,
  canCreate,
  athleteId,
  profile,
}: {
  diagnoses: ActiveDiagnosis[]
  canCreate: boolean
  athleteId: string
  profile: AthleteProfileData
}) {
  const [diagnoses, setDiagnoses] = useState(initialDiagnoses)
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  function handleResolved(id: string) {
    setDiagnoses((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--aura-text2)' }}>
          Diagnósticos Ativos
        </p>
        {diagnoses.length > 0 && (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--aura-danger-bg)', color: 'var(--aura-danger)' }}>
            {diagnoses.length}
          </span>
        )}
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-[var(--aura-green-bg)]"
            style={{ color: 'var(--aura-green)' }}
          >
            <Plus size={10} /> Novo
          </button>
        )}
      </div>
      <div className="p-4">
        {diagnoses.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--aura-text3)' }}>
            Sem diagnósticos ativos
          </p>
        ) : (
          <div className="space-y-2">
            {diagnoses.map((d) => (
              <DiagnosisCard
                key={d.id}
                diag={d}
                athleteId={athleteId}
                canResolve={canCreate}
                onResolved={handleResolved}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <DiagnosisModal
          athleteId={athleteId}
          occurrences={profile.activeOccurrences}
          onClose={() => setShowModal(false)}
          onSaved={async () => {
            setShowModal(false)
            // router.refresh() preserves this mounted component's state, so
            // re-read the active diagnoses directly or the new row won't show.
            const supabase = createClient()
            const { data } = await supabase
              .from('diagnoses')
              .select('id, osiics_code, osiics_description, diagnosis_type, custom_description, availability_status, diagnosed_at, is_resolved')
              .eq('athlete_id', athleteId)
              .eq('is_resolved', false)
              .order('diagnosed_at', { ascending: false })
            if (data) setDiagnoses(data as ActiveDiagnosis[])
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function OverviewTab({ profile }: { profile: AthleteProfileData }) {
  const canCreateDiagnosis = profile.viewerRole === 'doctor' || profile.viewerRole === 'admin'

  return (
    <div className="space-y-4 max-w-2xl">
      <StatusCard availabilityStatus={profile.availabilityStatus} score={profile.score} />

      {/* Alerts */}
      <AllergiesHighlight allergies={profile.medicalHistory?.allergies} />
      <ActiveOccurrencesAlert count={profile.activeOccurrences.length} />

      {/* Active diagnoses */}
      <ActiveDiagnosesSection
        diagnoses={profile.activeDiagnoses}
        canCreate={canCreateDiagnosis}
        athleteId={profile.id}
        profile={profile}
      />

      {/* Injury timeline */}
      <InjuryTimeline injuries={profile.injuryEvents} />

      {/* Risk breakdown */}
      <RiskBreakdown partials={profile.partials} dominantVariable={profile.dominantVariable} />
    </div>
  )
}
