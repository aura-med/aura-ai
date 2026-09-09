'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { resolveDiagnosis } from '@/lib/actions/clinical'
import { OccurrenceRow as SharedOccurrenceRow, StatusBadge, type Athlete as SharedRowAthlete } from '@/components/occurrences/OccurrenceRow'
import type { AthleteProfileData, InjuryEventSummary, ActiveOccurrence, ActiveDiagnosis } from '@/types/athlete-profile'
import type { AthleteAvailabilityStatus } from '@/types'

const DiagnosisModal = dynamic(() => import('./DiagnosisModal').then((m) => m.DiagnosisModal))

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number | null) {
  if (score === null) return 'var(--sophi-text3)'
  if (score < 40)  return 'var(--sophi-green)'
  if (score < 65)  return 'var(--sophi-warn)'
  if (score < 85)  return '#ff9330'
  return 'var(--sophi-danger)'
}

function scoreBg(score: number | null) {
  if (score === null) return 'var(--sophi-bg3)'
  if (score < 40)  return 'var(--sophi-green-bg)'
  if (score < 65)  return 'var(--sophi-warn-bg)'
  if (score < 85)  return 'rgba(255,147,48,0.12)'
  return 'var(--sophi-danger-bg)'
}

function scoreLabel(score: number | null) {
  if (score === null) return 'Sem dados'
  if (score < 40)  return 'Baixo'
  if (score < 65)  return 'Moderado'
  if (score < 85)  return 'Alto'
  return 'Crítico'
}

const STATUS_CONFIG = {
  available:       { label: '🟢 Disponível',      color: 'var(--sophi-green)',  bg: 'var(--sophi-green-bg)'  },
  evaluation:      { label: '🟡 Em Avaliação',    color: 'var(--sophi-warn)',   bg: 'var(--sophi-warn-bg)'   },
  load_management: { label: '🟠 Gestão de Carga', color: 'var(--sophi-orange)', bg: 'var(--sophi-orange-bg)' },
  unavailable:     { label: '🔴 Indisponível',    color: 'var(--sophi-danger)', bg: 'var(--sophi-danger-bg)' },
  rtp:             { label: '🟣 Em RTP',           color: 'var(--sophi-purple)', bg: 'rgba(180,141,252,0.12)' },
  // Legacy values — fallback
  modified:        { label: '🟡 Treino Modificado', color: 'var(--sophi-warn)',   bg: 'var(--sophi-warn-bg)'   },
  rehab:           { label: '🟣 Em Reabilitação',    color: 'var(--sophi-purple)', bg: 'rgba(180,141,252,0.12)' },
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
          return <line key={l} x1="0" x2={width} y1={y} y2={y} stroke="var(--sophi-border)" strokeDasharray="3 3" />
        })}
        <path d={areaPath} fill="var(--sophi-danger-bg)" />
        <path d={linePath} fill="none" stroke="var(--sophi-danger)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {points.map((p) => (
          <g key={`${p.label}-${p.x}`}>
            <circle cx={p.x} cy={p.y} r={p.injuries > 0 ? 3 : 2} fill="var(--sophi-danger)" />
            <text x={p.x} y="88" textAnchor="middle" fontSize="9" fill="var(--sophi-text3)">{p.label}</text>
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
      style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}
    >
      <div className="space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
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
      style={{ background: 'var(--sophi-danger-bg)', borderColor: 'var(--sophi-danger)' }}
    >
      <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--sophi-danger)' }} />
      <div>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--sophi-danger)' }}>⚠️ Alergias</p>
        <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--sophi-danger)' }}>{allergies}</p>
      </div>
    </div>
  )
}

// ── Occurrences Summary ─────────────────────────────────────────────────────
// Reuses the same OccurrenceRow as the Ocorrências page (reassess/resolve/
// attach diagnosis) so an occurrence has one editing experience everywhere.

function OccurrencesSummarySection({
  active,
  recentResolved,
  athlete,
  canCreateDiagnosis,
}: {
  active: ActiveOccurrence[]
  recentResolved: ActiveOccurrence[]
  athlete: SharedRowAthlete
  canCreateDiagnosis: boolean
}) {
  const router = useRouter()
  if (active.length === 0 && recentResolved.length === 0) return null

  function toRow(occ: ActiveOccurrence) {
    return <SharedOccurrenceRow key={occ.id} occ={{ ...occ, athletes: athlete }} canCreateDiagnosis={canCreateDiagnosis} onRevalidate={() => router.refresh()} />
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
        <AlertTriangle size={13} style={{ color: 'var(--sophi-warn)' }} />
        <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text2)' }}>
          Ocorrências & Diagnósticos
        </p>
        {active.length > 0 && (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--sophi-warn-bg)', color: 'var(--sophi-warn)' }}>
            {active.length} ativa{active.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="p-4 space-y-3">
        {active.length > 0 && (
          <div className="space-y-2">
            {active.map(toRow)}
          </div>
        )}
        {recentResolved.length > 0 && (
          <div className="space-y-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
              Histórico recente
            </p>
            {recentResolved.map(toRow)}
          </div>
        )}
        {active.length === 0 && recentResolved.length === 0 && (
          <p className="text-xs text-center py-2" style={{ color: 'var(--sophi-text3)' }}>Sem ocorrências</p>
        )}
      </div>
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
    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
          Injury Timeline — Época Desportiva
        </p>
        <p className="text-[10px] font-mono" style={{ color: 'var(--sophi-text3)' }}>Jul – Jun</p>
      </div>
      {!hasData ? (
        <p className="text-xs text-center py-4" style={{ color: 'var(--sophi-text3)' }}>Sem lesões registadas esta época</p>
      ) : (
        <InjuryTimelineChart data={months} />
      )}
    </div>
  )
}

// ── Orphan diagnoses (no occurrence_id) ─────────────────────────────────────
// The normal case (a diagnosis attached to an occurrence) shows and is
// managed entirely inline within OccurrenceRow above. The schema still
// allows occurrence_id = null (older records, or ones created directly via
// the API), so this small fallback keeps those reachable/editable/
// resolvable instead of silently disappearing from the profile.

function OrphanDiagnosisRow({
  diag, athleteId, occurrences, canEdit, onChanged,
}: {
  diag: ActiveDiagnosis
  athleteId: string
  occurrences: ActiveOccurrence[]
  canEdit: boolean
  onChanged: () => void
}) {
  const [showEdit, setShowEdit] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const title = diag.osiics_description ?? diag.custom_description ?? 'Diagnóstico sem descrição'

  async function handleResolve() {
    setResolving(true)
    try {
      await resolveDiagnosis(diag.id, athleteId)
      onChanged()
    } finally {
      setResolving(false)
      setConfirming(false)
    }
  }

  return (
    <div className="rounded-lg border p-3 space-y-2" style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border)' }}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold flex-1" style={{ color: 'var(--sophi-text)' }}>{title}</span>
        {diag.availability_status && <StatusBadge status={diag.availability_status as AthleteAvailabilityStatus} />}
        {canEdit && !confirming && (
          <>
            <button type="button" onClick={() => setShowEdit(true)} className="flex items-center gap-1 text-[10px] font-medium hover:opacity-80" style={{ color: 'var(--sophi-text2)' }}>
              <Pencil size={10} /> Editar
            </button>
            <button type="button" onClick={() => setConfirming(true)} disabled={resolving} className="flex items-center gap-1 text-[10px] font-medium hover:opacity-80" style={{ color: 'var(--sophi-green)' }}>
              <CheckCircle2 size={10} /> Resolver
            </button>
          </>
        )}
      </div>
      {confirming && (
        <div className="flex items-center gap-2 rounded-lg border px-2 py-1.5" style={{ background: 'var(--sophi-green-bg)', borderColor: 'var(--sophi-green)' }}>
          <p className="text-[10px] flex-1" style={{ color: 'var(--sophi-text2)' }}>Confirma que este diagnóstico fica resolvido?</p>
          <button type="button" onClick={() => setConfirming(false)} disabled={resolving} className="text-[10px] font-medium hover:opacity-80 shrink-0" style={{ color: 'var(--sophi-text3)' }}>Cancelar</button>
          <button type="button" onClick={handleResolve} disabled={resolving} className="flex items-center gap-1 text-[10px] font-bold hover:opacity-80 shrink-0" style={{ color: 'var(--sophi-green)' }}>
            {resolving ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />} Confirmar
          </button>
        </div>
      )}
      {showEdit && (
        <DiagnosisModal
          athleteId={athleteId}
          occurrences={occurrences}
          existing={diag}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); onChanged() }}
        />
      )}
    </div>
  )
}

function OrphanDiagnosesSection({ diagnoses, athleteId, occurrences, canEdit }: { diagnoses: ActiveDiagnosis[]; athleteId: string; occurrences: ActiveOccurrence[]; canEdit: boolean }) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  // A standalone diagnosis (no occurrence link) is only otherwise creatable
  // from inside an occurrence's own row — an athlete with no open occurrence
  // at all would have no way to record one without this control, even though
  // DiagnosisModal/createDiagnosis fully support occurrenceId: null.
  if (diagnoses.length === 0 && !canEdit) return null

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text2)' }}>
          Diagnósticos sem ocorrência associada
        </p>
        {diagnoses.length > 0 && (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}>
            {diagnoses.length}
          </span>
        )}
        {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md"
            style={{ border: '1px solid var(--sophi-border)', color: 'var(--sophi-text2)' }}
          >
            <Plus size={11} />
            Adicionar Diagnóstico
          </button>
        )}
      </div>
      {diagnoses.length > 0 && (
        <div className="p-4 space-y-2">
          {diagnoses.map((d) => (
            <OrphanDiagnosisRow key={d.id} diag={d} athleteId={athleteId} occurrences={occurrences} canEdit={canEdit} onChanged={() => router.refresh()} />
          ))}
        </div>
      )}
      {showCreate && (
        <DiagnosisModal
          athleteId={athleteId}
          occurrences={occurrences}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); router.refresh() }}
        />
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function OverviewTab({ profile }: { profile: AthleteProfileData }) {
  const canCreateDiagnosis = profile.viewerRole === 'doctor' || profile.viewerRole === 'owner'

  return (
    <div className="space-y-4">
      <StatusCard availabilityStatus={profile.availabilityStatus} score={profile.score} />

      {/* Alerts */}
      <AllergiesHighlight allergies={profile.medicalHistory?.allergies} />
      <OccurrencesSummarySection
        active={profile.activeOccurrences}
        recentResolved={profile.recentResolvedOccurrences}
        athlete={{
          id: profile.id,
          name: profile.name,
          shirt_number: profile.shirt_number,
          photo_url: profile.photo_url,
          position: profile.position,
          availability_status: profile.availabilityStatus as SharedRowAthlete['availability_status'],
        }}
        canCreateDiagnosis={canCreateDiagnosis}
      />
      <OrphanDiagnosesSection diagnoses={profile.orphanDiagnoses} athleteId={profile.id} occurrences={profile.activeOccurrences} canEdit={canCreateDiagnosis} />

      {/* Injury timeline */}
      <InjuryTimeline injuries={profile.injuryEvents} />
    </div>
  )
}
