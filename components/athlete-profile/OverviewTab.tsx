'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { AlertTriangle, Plus, CheckCircle2, Loader2, Pencil, Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveDiagnosis, getSuggestedProtocol, startRehabProtocol } from '@/lib/actions/clinical'
import { OSIICS_FOOTBALL } from '@/lib/data/osiics'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { OccurrenceRow as SharedOccurrenceRow, type Athlete as SharedRowAthlete } from '@/components/occurrences/OccurrenceRow'
import type { AthleteProfileData, InjuryEventSummary, ActiveDiagnosis, ActiveOccurrence, ActiveRehabPlanRef } from '@/types/athlete-profile'

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
  available:   { label: '🟢 Disponível',   color: 'var(--sophi-green)',  bg: 'var(--sophi-green-bg)'           },
  evaluation:  { label: '🟡 Em Avaliação', color: 'var(--sophi-warn)',   bg: 'var(--sophi-warn-bg)'            },
  unavailable: { label: '🔴 Indisponível', color: 'var(--sophi-danger)', bg: 'var(--sophi-danger-bg)'          },
  rtp:         { label: '🟣 Em RTP',        color: 'var(--sophi-purple)', bg: 'rgba(180,141,252,0.12)'         },
  // Legacy values — fallback
  modified:    { label: '🟡 Treino Modificado', color: 'var(--sophi-warn)',   bg: 'var(--sophi-warn-bg)'        },
  rehab:       { label: '🟣 Em Reabilitação',   color: 'var(--sophi-purple)', bg: 'rgba(180,141,252,0.12)'    },
}

const DIAG_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  available:   { label: 'Disponível',   color: 'var(--sophi-green)',  bg: 'var(--sophi-green-bg)' },
  evaluation:  { label: 'Em Avaliação', color: 'var(--sophi-warn)',   bg: 'var(--sophi-warn-bg)'  },
  unavailable: { label: 'Indisponível', color: 'var(--sophi-danger)', bg: 'var(--sophi-danger-bg)' },
  rtp:         { label: 'Em RTP',        color: 'var(--sophi-purple)', bg: 'rgba(180,141,252,0.12)' },
}

interface GanttRow {
  label: string
  start: Date
  end: Date | null
  color: string
}

function InjuryGanttChart({ rows, seasonStart, seasonEnd }: { rows: GanttRow[]; seasonStart: Date; seasonEnd: Date }) {
  const now = new Date()
  const seasonMs = seasonEnd.getTime() - seasonStart.getTime()

  function toPct(d: Date) {
    return Math.max(0, Math.min(100, ((d.getTime() - seasonStart.getTime()) / seasonMs) * 100))
  }

  const todayPct = toPct(now)

  const months: { label: string; pct: number }[] = []
  for (let i = 0; i < 12; i++) {
    const m = new Date(seasonStart.getFullYear(), seasonStart.getMonth() + i, 1)
    months.push({ label: m.toLocaleDateString('pt-PT', { month: 'short' }), pct: toPct(m) })
  }

  const LABEL_W = 110

  return (
    <div className="w-full overflow-x-auto">
      <div style={{ minWidth: '360px' }}>
        {rows.map((row, i) => {
          const s = toPct(row.start)
          const e = row.end ? toPct(row.end) : todayPct
          const w = Math.max(0.8, e - s)
          const ongoing = row.end === null
          return (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <div
                className="shrink-0 text-[9px] truncate text-right leading-tight"
                style={{ width: `${LABEL_W}px`, color: 'var(--sophi-text3)' }}
                title={row.label}
              >
                {row.label}
              </div>
              <div className="relative flex-1 rounded-sm" style={{ height: '10px', background: 'var(--sophi-bg4)' }}>
                {todayPct > 0 && todayPct < 100 && (
                  <div
                    className="absolute top-0 bottom-0 w-px z-10"
                    style={{ left: `${todayPct}%`, background: 'var(--sophi-warn)', opacity: 0.8 }}
                  />
                )}
                <div
                  className="absolute top-0 bottom-0 rounded-sm"
                  style={{
                    left: `${s}%`,
                    width: `${w}%`,
                    background: row.color,
                    opacity: ongoing ? 0.9 : 0.55,
                    borderRight: ongoing ? `2px dashed ${row.color}` : undefined,
                    boxSizing: 'border-box',
                  }}
                  title={`${row.label} · ${row.start.toLocaleDateString('pt-PT')} → ${row.end ? row.end.toLocaleDateString('pt-PT') : 'Hoje'}`}
                />
              </div>
            </div>
          )
        })}
        <div className="flex items-center gap-2 mt-2">
          <div style={{ width: `${LABEL_W}px` }} className="shrink-0" />
          <div className="relative flex-1" style={{ height: '14px' }}>
            {months.map((m, i) => (
              <span
                key={i}
                className="absolute text-[8px] font-mono"
                style={{ left: `${m.pct}%`, transform: 'translateX(-50%)', color: 'var(--sophi-text3)', whiteSpace: 'nowrap' }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>
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
          Ocorrências
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

function InjuryTimeline({
  injuries,
  activeDiagnoses,
}: {
  injuries: InjuryEventSummary[]
  activeDiagnoses: ActiveDiagnosis[]
}) {
  const now = new Date()
  const seasonStart = now.getMonth() >= 6
    ? new Date(now.getFullYear(), 6, 1)
    : new Date(now.getFullYear() - 1, 6, 1)
  const seasonEnd = new Date(seasonStart.getFullYear() + 1, 5, 30)

  const rows: GanttRow[] = [
    ...activeDiagnoses.map((d) => ({
      label: d.osiics_description ?? d.custom_description ?? 'Lesão',
      start: new Date(d.diagnosed_at),
      end: null,
      color: 'var(--sophi-danger)',
    })),
    ...injuries.map((inj) => ({
      label: inj.diagnosis,
      start: new Date(inj.injury_date),
      end: inj.return_date ? new Date(inj.return_date) : new Date(),
      color: 'var(--sophi-green)',
    })),
  ].filter((r) => r.start <= seasonEnd && (!r.end || r.end >= seasonStart))

  const hasData = rows.length > 0

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
          Linha Cronológica — Época Desportiva
        </p>
        <div className="flex items-center gap-3 text-[9px]" style={{ color: 'var(--sophi-text3)' }}>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-2 rounded-sm" style={{ background: 'var(--sophi-danger)', opacity: 0.9 }} />
            Ativa
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-2 rounded-sm" style={{ background: 'var(--sophi-green)', opacity: 0.55 }} />
            Resolvida
          </span>
        </div>
      </div>
      {!hasData ? (
        <p className="text-xs text-center py-4" style={{ color: 'var(--sophi-text3)' }}>Sem lesões registadas esta época</p>
      ) : (
        <InjuryGanttChart rows={rows} seasonStart={seasonStart} seasonEnd={seasonEnd} />
      )}
    </div>
  )
}

// ── Active Diagnoses Section ──────────────────────────────────────────────────

function DiagnosisCard({
  diag,
  athleteId,
  canResolve,
  activePlans = [],
  onResolved,
  onEdit,
}: {
  diag: ActiveDiagnosis
  athleteId: string
  canResolve: boolean
  activePlans?: ActiveRehabPlanRef[]
  onResolved: (id: string) => void
  onEdit: () => void
}) {
  const [resolving, setResolving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [starting, setStarting] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const squadId = searchParams.get('squadId')
  const rehabHref = `/rehab${squadId ? `?squadId=${squadId}&` : '?'}athleteId=${athleteId}`
  const statusCfg = DIAG_STATUS_CONFIG[diag.availability_status ?? 'evaluation'] ?? DIAG_STATUS_CONFIG.evaluation
  const title = diag.osiics_description ?? diag.custom_description ?? 'Diagnóstico sem descrição'

  // Does this injury already have an open rehab plan? Match by the shared
  // occurrence first; otherwise treat any open plan for the athlete as "has
  // rehab" so we never offer to start a duplicate.
  const isInjury = diag.diagnosis_type === 'injury'
  const linkedPlan = diag.occurrence_id
    ? activePlans.find((p) => p.occurrence_id === diag.occurrence_id)
    : undefined
  const hasRehab = isInjury && (!!linkedPlan || activePlans.length > 0)
  const canStartRehab = isInjury && !hasRehab

  async function handleStartRehab() {
    setStarting(true)
    setResolveError(null)
    try {
      const entry = diag.osiics_code ? OSIICS_FOOTBALL.find((e) => e.code === diag.osiics_code) : undefined
      if (entry?.protocolKey) {
        const proto = await getSuggestedProtocol(entry.protocolKey)
        if (proto) {
          await startRehabProtocol(athleteId, proto.id, diag.occurrence_id ?? null)
          router.push(rehabHref)
          return
        }
      }
      // No protocol mapped for this OSIICS code — open the manual plan form.
      router.push(`${rehabHref}&new=1`)
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : 'Erro ao iniciar reabilitação')
      setStarting(false)
    }
  }

  async function handleResolve() {
    setResolving(true)
    setResolveError(null)
    try {
      await resolveDiagnosis(diag.id, athleteId)
      onResolved(diag.id)
      router.refresh()
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : 'Erro ao resolver diagnóstico')
    } finally {
      setResolving(false)
      setConfirming(false)
    }
  }

  return (
    <div
      className="rounded-lg border p-3 space-y-2"
      style={{
        background: 'var(--sophi-bg3)',
        borderColor: diag.diagnosis_type === 'injury' ? 'var(--sophi-danger)' : 'var(--sophi-border)',
        borderLeftWidth: diag.diagnosis_type === 'injury' ? '3px' : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {diag.osiics_code && (
            <span className="text-[10px] font-mono mr-1.5" style={{ color: 'var(--sophi-text3)' }}>
              {diag.osiics_code}
            </span>
          )}
          <span className="text-xs font-semibold" style={{ color: 'var(--sophi-text)' }}>{title}</span>
          {diag.custom_description && diag.osiics_description && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--sophi-text3)' }}>{diag.custom_description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: statusCfg.bg, color: statusCfg.color }}
          >
            {statusCfg.label}
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--sophi-bg4)', color: 'var(--sophi-text3)' }}>
            {diag.diagnosis_type === 'injury' ? 'Lesão' : diag.diagnosis_type === 'disease' ? 'Doença' : '—'}
          </span>
        </div>
      </div>
      {!confirming && (
        <div className="flex items-center gap-3">
          {hasRehab && (
            <Link
              href={rehabHref}
              className="flex items-center gap-1 text-[10px] font-medium hover:opacity-80"
              style={{ color: 'var(--sophi-purple)', textDecoration: 'none' }}
            >
              Ver reabilitação →
            </Link>
          )}
          {canStartRehab && canResolve && (
            <button
              type="button"
              onClick={handleStartRehab}
              disabled={starting}
              className="flex items-center gap-1 text-[10px] font-bold hover:opacity-80"
              style={{ color: 'var(--sophi-purple)' }}
            >
              {starting ? <Loader2 size={10} className="animate-spin" /> : <Activity size={10} />}
              Iniciar reabilitação
            </button>
          )}
          {canResolve && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1 text-[10px] font-medium hover:opacity-80"
                style={{ color: 'var(--sophi-text2)' }}
              >
                <Pencil size={10} />
                Editar
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={resolving}
                className="flex items-center gap-1 text-[10px] font-medium hover:opacity-80"
                style={{ color: 'var(--sophi-green)' }}
              >
                <CheckCircle2 size={10} />
                Resolver diagnóstico
              </button>
            </>
          )}
        </div>
      )}
      {canResolve && confirming && (
        <div
          className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
          style={{ background: 'var(--sophi-green-bg)', borderColor: 'var(--sophi-green)' }}
        >
          <p className="text-[10px] flex-1" style={{ color: 'var(--sophi-text2)' }}>
            Confirma que o atleta fica <strong>Disponível</strong>, salvo outras ocorrências em aberto?
          </p>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={resolving}
            className="text-[10px] font-medium hover:opacity-80 shrink-0"
            style={{ color: 'var(--sophi-text3)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleResolve}
            disabled={resolving}
            className="flex items-center gap-1 text-[10px] font-bold hover:opacity-80 shrink-0"
            style={{ color: 'var(--sophi-green)' }}
          >
            {resolving ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
            Confirmar
          </button>
        </div>
      )}
      {resolveError && (
        <p className="text-[10px] px-2 py-1 rounded mt-1" style={{ color: 'var(--sophi-danger)', background: 'var(--sophi-danger-bg)' }}>
          {resolveError}
        </p>
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
  const [editingDiagnosis, setEditingDiagnosis] = useState<ActiveDiagnosis | null>(null)
  const router = useRouter()

  function handleResolved(id: string) {
    setDiagnoses((prev) => prev.filter((d) => d.id !== id))
  }

  async function refetchDiagnoses() {
    // router.refresh() preserves this mounted component's state, so re-read
    // the active diagnoses directly or the new/edited row won't show.
    const supabase = createClient()
    const { data } = await supabase
      .from('diagnoses')
      .select('id, osiics_code, osiics_description, diagnosis_type, custom_description, availability_status, diagnosed_at, is_resolved, occurrence_id')
      .eq('athlete_id', athleteId)
      .eq('is_resolved', false)
      .order('diagnosed_at', { ascending: false })
    if (data) setDiagnoses(data as ActiveDiagnosis[])
    router.refresh()
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text2)' }}>
          {diagnoses.some((d) => d.diagnosis_type === 'injury') ? 'Lesões & Diagnósticos Ativos' : 'Diagnósticos Ativos'}
        </p>
        {diagnoses.length > 0 && (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}>
            {diagnoses.length}
          </span>
        )}
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-[var(--sophi-green-bg)]"
            style={{ color: 'var(--sophi-green)' }}
          >
            <Plus size={10} /> Novo
          </button>
        )}
      </div>
      <div className="p-4">
        {diagnoses.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--sophi-text3)' }}>
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
                activePlans={profile.activeRehabPlans ?? []}
                onResolved={handleResolved}
                onEdit={() => setEditingDiagnosis(d)}
              />
            ))}
          </div>
        )}
      </div>

      {(showModal || editingDiagnosis) && (
        <DiagnosisModal
          athleteId={athleteId}
          occurrences={profile.activeOccurrences}
          existing={editingDiagnosis}
          onClose={() => { setShowModal(false); setEditingDiagnosis(null) }}
          onSaved={async () => {
            setShowModal(false)
            setEditingDiagnosis(null)
            await refetchDiagnoses()
          }}
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

      {/* Active diagnoses */}
      <ActiveDiagnosesSection
        diagnoses={profile.activeDiagnoses}
        canCreate={canCreateDiagnosis}
        athleteId={profile.id}
        profile={profile}
      />

      {/* Injury timeline */}
      <InjuryTimeline
        injuries={profile.injuryEvents}
        activeDiagnoses={profile.activeDiagnoses.filter((d) => d.diagnosis_type === 'injury')}
      />
    </div>
  )
}
