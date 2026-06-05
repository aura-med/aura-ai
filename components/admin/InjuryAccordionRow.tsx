'use client'

/**
 * InjuryAccordionRow
 *
 * Expandable table row for a single active rehab session.
 *
 * Features:
 *  1. Edit button — opens EditInjuryModal to fix date / swap protocol
 *  4. RTP Metrics — final phase shows objective numeric fields (strength deficit
 *     + GPS sprint volume) with pass/fail indicators; Advance button only
 *     activates when both thresholds are met
 *  5. Staff Sync — phase advance & availability changes send a background
 *     notification to the `notifications` table for coaching staff
 */

import { useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  ChevronRight, CheckCircle2, Circle, ArrowRight, ArrowLeft, Clock,
  AlertTriangle, Edit2, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { ActiveRehabSession, AvailabilityStatus, ClinicalNote, RehabPhase } from '@/types'
import { useFederatedSync } from '@/lib/federated/useFederatedSync'
import {
  sendStaffNotification,
  buildPhaseAdvanceMessage,
  buildAvailabilityMessage,
  buildRtpClearedMessage,
} from '@/lib/medical/notifications'

const EditInjuryModal = dynamic(() => import('./EditInjuryModal').then((mod) => mod.EditInjuryModal))

// ── RTP thresholds ─────────────────────────────────────────────────────────────
const RTP_STRENGTH_THRESHOLD = 10    // deficit must be < 10 %
const RTP_SPRINT_THRESHOLD   = 80    // volume must be ≥ 80 %

// ── Availability badge ────────────────────────────────────────────────────────

const AVAIL_CONFIG: Record<AvailabilityStatus, { label: string; color: string; bg: string }> = {
  unfit:      { label: 'Indisponível',   color: 'var(--aura-danger)',  bg: 'var(--aura-danger-bg)'      },
  modified:   { label: 'Modificado',     color: 'var(--aura-warn)',    bg: 'rgba(255,196,0,0.12)'        },
  monitoring: { label: 'Monitorização',  color: 'var(--aura-blue)',    bg: 'var(--aura-blue-bg)'         },
  delayed:    { label: 'Adiado',         color: '#ff9330',             bg: 'rgba(255,147,48,0.12)'       },
  recovered:  { label: 'Recuperado',     color: 'var(--aura-green)',   bg: 'rgba(0,229,160,0.10)'        },
}

function AvailBadge({ status }: { status: AvailabilityStatus | null }) {
  const cfg = status ? AVAIL_CONFIG[status] : null
  if (!cfg) return <span style={{ color: 'var(--aura-text3)', fontSize: 12 }}>—</span>
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  )
}

// ── UEFA progress bar ─────────────────────────────────────────────────────────

function UefaProgressBar({
  daysIn,
  totalExpected,
}: {
  daysIn: number
  totalExpected: number | null
}) {
  if (!totalExpected) return null
  const pct = Math.min(100, Math.round((daysIn / totalExpected) * 100))
  const overdue = daysIn > totalExpected
  return (
    <div className="space-y-1">
      <div
        className="flex items-center justify-between text-[10px]"
        style={{ color: 'var(--aura-text3)' }}
      >
        <span>Progresso UEFA</span>
        <span className={cn('font-mono font-bold', overdue && 'text-[var(--aura-danger)]')}>
          {daysIn}d / {totalExpected}d {overdue ? '⚠' : ''}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--aura-bg4)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: overdue ? 'var(--aura-danger)' : 'var(--aura-green)',
          }}
        />
      </div>
    </div>
  )
}

// ── Feature 4: RTP Metrics panel ──────────────────────────────────────────────

interface RtpMetrics {
  strengthDeficit: number | ''
  sprintVolume: number | ''
}

function RtpMetricsPanel({
  metrics,
  onChange,
}: {
  metrics: RtpMetrics
  onChange: (m: RtpMetrics) => void
}) {
  const strengthOk =
    metrics.strengthDeficit !== '' &&
    (metrics.strengthDeficit as number) < RTP_STRENGTH_THRESHOLD
  const sprintOk =
    metrics.sprintVolume !== '' &&
    (metrics.sprintVolume as number) >= RTP_SPRINT_THRESHOLD

  return (
    <div
      className="rounded-lg border p-3 space-y-3 mt-2"
      style={{ background: 'rgba(255,196,0,0.04)', borderColor: 'var(--aura-warn)' }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: 'var(--aura-warn)' }}
      >
        🎯 Métricas Objectivas de Retorno ao Jogo
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Strength deficit */}
        <div className="space-y-1">
          <label
            className="text-[10px]"
            style={{ color: 'var(--aura-text3)' }}
          >
            Défice de Força Assimétrico (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={metrics.strengthDeficit}
            onChange={(e) =>
              onChange({
                ...metrics,
                strengthDeficit: e.target.value === '' ? '' : Number(e.target.value),
              })
            }
            placeholder={`< ${RTP_STRENGTH_THRESHOLD}% para aprovação`}
            className="w-full rounded-md border px-2.5 py-1.5 text-xs outline-none"
            style={{
              background: 'var(--aura-bg2)',
              borderColor: strengthOk
                ? 'var(--aura-green)'
                : metrics.strengthDeficit !== ''
                ? 'var(--aura-danger)'
                : 'var(--aura-border)',
              color: 'var(--aura-text)',
            }}
          />
          {metrics.strengthDeficit !== '' && (
            <p
              className="text-[10px] font-semibold"
              style={{ color: strengthOk ? 'var(--aura-green)' : 'var(--aura-danger)' }}
            >
              {strengthOk ? '✓ Aprovado' : `✗ Limiar: < ${RTP_STRENGTH_THRESHOLD}%`}
            </p>
          )}
        </div>

        {/* Sprint volume */}
        <div className="space-y-1">
          <label
            className="text-[10px]"
            style={{ color: 'var(--aura-text3)' }}
          >
            Volume de Sprint GPS (% do limiar)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={metrics.sprintVolume}
            onChange={(e) =>
              onChange({
                ...metrics,
                sprintVolume: e.target.value === '' ? '' : Number(e.target.value),
              })
            }
            placeholder={`≥ ${RTP_SPRINT_THRESHOLD}% para aprovação`}
            className="w-full rounded-md border px-2.5 py-1.5 text-xs outline-none"
            style={{
              background: 'var(--aura-bg2)',
              borderColor: sprintOk
                ? 'var(--aura-green)'
                : metrics.sprintVolume !== ''
                ? 'var(--aura-danger)'
                : 'var(--aura-border)',
              color: 'var(--aura-text)',
            }}
          />
          {metrics.sprintVolume !== '' && (
            <p
              className="text-[10px] font-semibold"
              style={{ color: sprintOk ? 'var(--aura-green)' : 'var(--aura-danger)' }}
            >
              {sprintOk ? '✓ Aprovado' : `✗ Limiar: ≥ ${RTP_SPRINT_THRESHOLD}%`}
            </p>
          )}
        </div>
      </div>

      {strengthOk && sprintOk && (
        <p
          className="text-[11px] font-semibold text-center py-1 rounded-md"
          style={{ background: 'rgba(0,229,160,0.10)', color: 'var(--aura-green)' }}
        >
          ✓ Todos os critérios de RTP cumpridos — pronto para autorização médica
        </p>
      )}
    </div>
  )
}

// ── Phase stepper ─────────────────────────────────────────────────────────────

function PhaseStepper({
  phases,
  currentDay,
  phaseProgress,
  rtpMetrics,
  onProgressUpdate,
  onRtpMetricsChange,
  onAdvancePhase,
  onRegressPhase,
}: {
  phases: RehabPhase[]
  currentDay: number
  phaseProgress: Record<string, boolean[]>
  rtpMetrics: RtpMetrics
  onProgressUpdate: (phaseId: string, idx: number, checked: boolean) => void
  onRtpMetricsChange: (m: RtpMetrics) => void
  onAdvancePhase: () => void
  onRegressPhase: () => void
}) {
  const [confirmRegress, setConfirmRegress] = useState(false)

  if (!phases.length) return null

  const currentPhase = phases.find((p) => currentDay >= p.d1 && currentDay <= p.d2)
    ?? phases[phases.length - 1]
  const currentPhaseIndex = phases.indexOf(currentPhase)
  const isLastPhase  = currentPhaseIndex === phases.length - 1
  const isFirstPhase = currentPhaseIndex === 0

  const criteria = currentPhase.criteria
    ? currentPhase.criteria.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
    : []
  const phaseKey = String(currentPhase.id ?? currentPhaseIndex)
  const progress = phaseProgress[phaseKey] ?? []
  const allChecked = criteria.length > 0 && criteria.every((_, i) => progress[i])

  // Feature 4: RTP gate — only on last phase
  const rtpStrengthOk =
    !isLastPhase ||
    (rtpMetrics.strengthDeficit !== '' &&
      (rtpMetrics.strengthDeficit as number) < RTP_STRENGTH_THRESHOLD)
  const rtpSprintOk =
    !isLastPhase ||
    (rtpMetrics.sprintVolume !== '' &&
      (rtpMetrics.sprintVolume as number) >= RTP_SPRINT_THRESHOLD)
  const rtpValid = rtpStrengthOk && rtpSprintOk
  const canAdvance = allChecked && rtpValid

  return (
    <div className="space-y-4">
      {/* Phase timeline */}
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {phases.map((phase, idx) => {
          const done = currentDay > phase.d2
          const active = phase === currentPhase
          return (
            <div key={idx} className="flex items-center shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                  style={{
                    background: done
                      ? 'var(--aura-green)'
                      : active
                      ? (phase.color ?? 'var(--aura-blue)')
                      : 'var(--aura-bg4)',
                    color: done || active ? '#fff' : 'var(--aura-text3)',
                    boxShadow: active
                      ? `0 0 0 2px ${phase.color ?? 'var(--aura-blue)'}40`
                      : undefined,
                  }}
                >
                  {done ? '✓' : idx + 1}
                </div>
                <span
                  className="text-[9px] text-center max-w-[60px] leading-tight"
                  style={{ color: active ? 'var(--aura-text)' : 'var(--aura-text3)' }}
                >
                  {phase.name}
                </span>
                <span className="text-[8px] font-mono" style={{ color: 'var(--aura-text3)' }}>
                  {phase.range}
                </span>
              </div>
              {idx < phases.length - 1 && (
                <div
                  className="h-px w-8 mx-1 mb-4"
                  style={{ background: done ? 'var(--aura-green)' : 'var(--aura-border)' }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Current phase detail */}
      <div
        className="rounded-lg p-3 border space-y-2"
        style={{ background: 'var(--aura-bg4)', borderColor: 'var(--aura-border)' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold" style={{ color: 'var(--aura-text)' }}>
            {currentPhase.name}
          </p>
          <span className="text-[10px] font-mono" style={{ color: 'var(--aura-text3)' }}>
            Dia {currentDay} · {currentPhase.range}
          </span>
        </div>

        {/* Exercises */}
        {(currentPhase.exercises ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(currentPhase.exercises ?? []).map((ex, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: 'var(--aura-bg2)', color: 'var(--aura-text3)' }}
              >
                {ex}
              </span>
            ))}
          </div>
        )}

        {/* Criteria checklist */}
        {criteria.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--aura-text3)' }}
            >
              Critérios de progressão
            </p>
            {criteria.map((criterion, i) => {
              const checked = progress[i] ?? false
              return (
                <div
                  key={i}
                  role="checkbox"
                  aria-checked={checked}
                  tabIndex={0}
                  onClick={() => onProgressUpdate(phaseKey, i, !checked)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onProgressUpdate(phaseKey, i, !checked)
                    }
                  }}
                  className="flex items-start gap-2 cursor-pointer select-none rounded px-1 py-0.5 transition-colors hover:bg-[var(--aura-bg2)]"
                >
                  <div className="mt-0.5 shrink-0">
                    {checked ? (
                      <CheckCircle2 size={14} style={{ color: 'var(--aura-green)' }} />
                    ) : (
                      <Circle size={14} style={{ color: 'var(--aura-text3)' }} />
                    )}
                  </div>
                  <span
                    className={cn('text-xs leading-relaxed', checked && 'line-through')}
                    style={{ color: checked ? 'var(--aura-text3)' : 'var(--aura-text2)' }}
                  >
                    {criterion}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Feature 4: RTP metrics — only on final phase */}
        {isLastPhase && (
          <RtpMetricsPanel metrics={rtpMetrics} onChange={onRtpMetricsChange} />
        )}

        {/* ── Action row: regress (left) + advance/complete (right) ── */}
        <div className={cn('mt-2 flex gap-2', isFirstPhase ? 'justify-end' : 'justify-between')}>

          {/* Regress button — hidden on first phase */}
          {!isFirstPhase && (
            <div className="flex flex-col items-start gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (!confirmRegress) {
                    setConfirmRegress(true)
                    return
                  }
                  setConfirmRegress(false)
                  onRegressPhase()
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: confirmRegress
                    ? 'color-mix(in srgb, var(--aura-warn) 20%, transparent)'
                    : 'var(--aura-bg3)',
                  color: confirmRegress ? 'var(--aura-warn)' : 'var(--aura-text3)',
                  border: confirmRegress
                    ? '1px solid var(--aura-warn)'
                    : '1px solid var(--aura-border)',
                }}
                title="Regredir para a fase anterior e limpar critérios"
              >
                <ArrowLeft size={12} />
                {confirmRegress ? 'Confirmar regressão?' : `← ${phases[currentPhaseIndex - 1]?.name}`}
              </button>
              {confirmRegress && (
                <p className="text-[10px] px-1" style={{ color: 'var(--aura-warn)' }}>
                  Clique novamente para confirmar.{' '}
                  <button
                    className="underline"
                    onClick={() => setConfirmRegress(false)}
                  >
                    Cancelar
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Advance / complete button */}
          {!isLastPhase ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={onAdvancePhase}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all',
                canAdvance ? 'hover:opacity-90 cursor-pointer' : 'opacity-40 cursor-not-allowed',
              )}
              style={{
                background: canAdvance ? 'var(--aura-green)' : 'var(--aura-bg3)',
                color: canAdvance ? '#000' : 'var(--aura-text3)',
              }}
              title={!allChecked ? 'Cumprir todos os critérios para avançar' : undefined}
            >
              <ArrowRight size={13} />
              {canAdvance
                ? `Avançar → ${phases[currentPhaseIndex + 1]?.name}`
                : 'Cumprir todos os critérios para avançar'}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={onAdvancePhase}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all',
                canAdvance ? 'hover:opacity-90 cursor-pointer' : 'opacity-40 cursor-not-allowed',
              )}
              style={{
                background: canAdvance ? 'var(--aura-green)' : 'var(--aura-bg3)',
                color: canAdvance ? '#000' : 'var(--aura-text3)',
              }}
            >
              <CheckCircle2 size={13} />
              {canAdvance
                ? 'Concluir Reabilitação — Autorizar RTP'
                : 'Preencher métricas de RTP e critérios'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Clinical journal ──────────────────────────────────────────────────────────

function ClinicalJournal({
  notes,
  sessionId,
  onNotesChanged,
}: {
  notes: ClinicalNote[]
  sessionId: string
  onNotesChanged: (notes: ClinicalNote[]) => void
}) {
  const [text, setText]               = useState('')
  const [saving, setSaving]           = useState(false)
  const [editingIdx, setEditingIdx]   = useState<number | null>(null)
  const [editText, setEditText]       = useState('')

  /** Persist the full notes array and propagate to parent */
  async function persist(updated: ClinicalNote[]) {
    onNotesChanged(updated)
    const supabase = createClient()
    const { error } = await supabase
      .from('rehab_sessions')
      .update({ clinical_data: { notes: updated } })
      .eq('id', sessionId)
    if (error) console.error('[journal] persist:', error)
  }

  async function handleAdd() {
    const trimmed = text.trim()
    if (!trimmed) return
    setSaving(true)
    const newNote: ClinicalNote = { text: trimmed, created_at: new Date().toISOString() }
    await persist([...notes, newNote])
    setText('')
    setSaving(false)
  }

  async function handleSaveEdit(idx: number) {
    const trimmed = editText.trim()
    if (!trimmed) return
    const updated = notes.map((n, i) => (i === idx ? { ...n, text: trimmed } : n))
    await persist(updated)
    setEditingIdx(null)
  }

  async function handleDelete(idx: number) {
    await persist(notes.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      <p
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--aura-text3)' }}
      >
        Diário Clínico
      </p>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {notes.length === 0 && (
          <p className="text-xs italic" style={{ color: 'var(--aura-text3)' }}>
            Sem notas clínicas.
          </p>
        )}
        {notes.map((n, i) => (
          <div
            key={i}
            className="rounded-lg p-2.5 border"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            {editingIdx === i ? (
              /* Edit mode */
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  autoFocus
                  className="w-full rounded-md border px-2.5 py-2 text-xs outline-none resize-none"
                  style={{
                    background: 'var(--aura-bg3)',
                    borderColor: 'var(--aura-border)',
                    color: 'var(--aura-text)',
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(i)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold"
                    style={{ background: 'var(--aura-green)', color: '#000' }}
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIdx(null)}
                    className="px-2.5 py-1 rounded-md text-[11px] transition-colors hover:bg-[var(--aura-bg3)]"
                    style={{ color: 'var(--aura-text2)' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              /* Display mode */
              <>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--aura-text)' }}>
                  {n.text}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>
                    {new Date(n.created_at).toLocaleString('pt-PT', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Editar nota"
                      onClick={() => { setEditingIdx(i); setEditText(n.text) }}
                      className="p-1 rounded transition-colors hover:bg-[var(--aura-bg3)]"
                    >
                      <Edit2 size={11} style={{ color: 'var(--aura-text3)' }} />
                    </button>
                    <button
                      type="button"
                      title="Apagar nota"
                      onClick={() => handleDelete(i)}
                      className="p-1 rounded transition-colors hover:bg-[var(--aura-danger-bg)]"
                    >
                      <Trash2 size={11} style={{ color: 'var(--aura-danger)' }} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* New note */}
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Adicionar nota clínica… (Ctrl+Enter para guardar)"
          rows={2}
          className="flex-1 rounded-lg border px-3 py-2 text-xs resize-none outline-none"
          style={{
            background: 'var(--aura-bg4)',
            borderColor: 'var(--aura-border)',
            color: 'var(--aura-text)',
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd() }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!text.trim() || saving}
          className="self-end px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
          style={{ background: 'var(--aura-green)', color: '#000' }}
        >
          {saving ? '…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface InjuryAccordionRowProps {
  session: ActiveRehabSession
  index: number
  totalRows: number
  onUpdated: () => void
}

export function InjuryAccordionRow({
  session,
  index,
  totalRows,
  onUpdated,
}: InjuryAccordionRowProps) {
  const [open, setOpen]               = useState(false)
  const [showEdit, setShowEdit]       = useState(false)    // Feature 1
  const [localNotes, setLocalNotes]   = useState<ClinicalNote[]>(
    session.clinical_data?.notes ?? [],
  )
  const [localPhaseProgress, setLocalPhaseProgress] = useState<Record<string, boolean[]>>(
    session.clinical_data?.phase_progress ?? {},
  )
  // Feature 4: RTP metrics state
  const [rtpMetrics, setRtpMetrics] = useState<RtpMetrics>({
    strengthDeficit: '',
    sprintVolume: '',
  })

  const { recordObservation } = useFederatedSync()

  const athlete  = session.athletes
  const protocol = session.rehab_protocols
  const injury   = session.injury_events

  // Prefer custom_phases stored in clinical_data (from protocol sandbox) over template
  const rawPhases = useMemo<RehabPhase[]>(
    () =>
      (session.clinical_data?.custom_phases as RehabPhase[] | undefined) ??
      (protocol?.phases as RehabPhase[] | undefined) ??
      [],
    [session.clinical_data?.custom_phases, protocol?.phases],
  )

  // ── Derived ──────────────────────────────────────────────────────────────
  const daysIn = session.current_day
  const currentPhase = rawPhases.find((p) => daysIn >= p.d1 && daysIn <= p.d2)
    ?? rawPhases[rawPhases.length - 1]
  const currentPhaseIndex = currentPhase ? rawPhases.indexOf(currentPhase) : 0
  const phaseLabel =
    rawPhases.length > 0
      ? `Fase ${currentPhaseIndex + 1} de ${rawPhases.length}`
      : '—'

  // ── Phase progress update ─────────────────────────────────────────────────
  const handleProgressUpdate = useCallback(
    async (phaseId: string, idx: number, checked: boolean) => {
      const updated = { ...localPhaseProgress }
      const existing = [...(updated[phaseId] ?? [])]
      existing[idx] = checked
      updated[phaseId] = existing
      setLocalPhaseProgress(updated)
      recordObservation('hrv', checked ? -0.05 : 0.05)

      const supabase = createClient()
      await supabase
        .from('rehab_sessions')
        .update({
          clinical_data: { ...session.clinical_data, phase_progress: updated },
        })
        .eq('id', session.id)
    },
    [localPhaseProgress, session, recordObservation],
  )

  // ── Advance phase ─────────────────────────────────────────────────────────
  const handleAdvancePhase = useCallback(async () => {
    if (!currentPhase) return
    const nextPhase = rawPhases[currentPhaseIndex + 1]
    const isLastPhase = currentPhaseIndex === rawPhases.length - 1
    const supabase = createClient()

    if (isLastPhase) {
      // RTP completion — store metrics and mark recovered
      const rtpMeta = {
        strength_deficit_pct: rtpMetrics.strengthDeficit,
        sprint_volume_pct: rtpMetrics.sprintVolume,
        cleared_at: new Date().toISOString(),
      }
      await supabase
        .from('rehab_sessions')
        .update({
          clinical_data: { ...session.clinical_data, rtp_metrics: rtpMeta },
          availability_status: 'recovered',
        })
        .eq('id', session.id)

      // Feature 5: RTP cleared notification
      if (athlete?.id) {
        await sendStaffNotification({
          type: 'rtp_cleared',
          message: buildRtpClearedMessage(
            athlete.name,
            rtpMetrics.strengthDeficit as number,
            rtpMetrics.sprintVolume as number,
          ),
          athlete_id: athlete.id,
          session_id: session.id,
          metadata: rtpMeta,
        })
      }
      recordObservation('history', -0.05)
      onUpdated()
      return
    }

    // Normal phase advance
    const { error } = await supabase
      .from('rehab_sessions')
      .update({ current_day: nextPhase.d1 })
      .eq('id', session.id)

    if (error) { console.error('[advance-phase]', error); return }

    // Feature 5: Phase advance notification
    if (athlete?.id) {
      await sendStaffNotification({
        type: 'phase_advance',
        message: buildPhaseAdvanceMessage(
          athlete.name,
          currentPhase.name,
          nextPhase.name,
          currentPhase.exercises ?? [],
        ),
        athlete_id: athlete.id,
        session_id: session.id,
        metadata: {
          from_phase: currentPhase.name,
          to_phase: nextPhase.name,
          day: nextPhase.d1,
        },
      })
    }

    recordObservation('history', -0.03)
    onUpdated()
  }, [
    currentPhase, currentPhaseIndex, rawPhases, session,
    athlete, rtpMetrics, recordObservation, onUpdated,
  ])

  // ── Regress phase ─────────────────────────────────────────────────────────
  const handleRegressPhase = useCallback(async () => {
    if (!currentPhase || currentPhaseIndex === 0) return
    const prevPhase = rawPhases[currentPhaseIndex - 1]
    const supabase = createClient()

    // Move current_day back to the start of the previous phase
    const { error } = await supabase
      .from('rehab_sessions')
      .update({ current_day: prevPhase.d1 })
      .eq('id', session.id)

    if (error) { console.error('[regress-phase]', error); return }

    // Clear the criteria progress for both the current phase AND the previous
    // phase (clinician must re-verify everything from scratch)
    const currentPhaseKey  = String(currentPhase.id  ?? currentPhaseIndex)
    const prevPhaseKey     = String(prevPhase.id      ?? (currentPhaseIndex - 1))
    const updatedProgress  = { ...localPhaseProgress }
    delete updatedProgress[currentPhaseKey]
    delete updatedProgress[prevPhaseKey]
    setLocalPhaseProgress(updatedProgress)

    await supabase
      .from('rehab_sessions')
      .update({
        clinical_data: { ...session.clinical_data, phase_progress: updatedProgress },
      })
      .eq('id', session.id)

    recordObservation('history', 0.02)
    onUpdated()
  }, [
    currentPhase, currentPhaseIndex, rawPhases, session,
    localPhaseProgress, recordObservation, onUpdated,
  ])

  if (!athlete) return null

  return (
    <>
      {/* ── Parent row ─────────────────────────────────────────────────── */}
      <tr
        className="group transition-colors hover:bg-[var(--aura-bg3)] cursor-pointer"
        style={{
          borderBottom:
            !open && index < totalRows - 1
              ? '1px solid var(--aura-border)'
              : undefined,
        }}
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
      >
        {/* Chevron */}
        <td className="pl-4 pr-2 py-3 w-8">
          <ChevronRight
            size={14}
            className="transition-transform"
            style={{
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              color: 'var(--aura-text3)',
            }}
          />
        </td>

        {/* OSIICS */}
        <td className="px-3 py-3 w-20">
          {injury?.osiics_code ? (
            <span
              className="font-mono font-bold text-[11px] px-2 py-1 rounded"
              style={{ background: 'rgba(0,229,160,0.08)', color: 'var(--aura-green)' }}
            >
              {injury.osiics_code}
            </span>
          ) : (
            <span className="font-mono text-[11px]" style={{ color: 'var(--aura-text3)' }}>
              —
            </span>
          )}
        </td>

        {/* Athlete + diagnosis */}
        <td className="px-3 py-3 min-w-[160px]">
          <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--aura-text)' }}>
            {athlete.name}
          </p>
          <p
            className="text-[11px] mt-0.5 line-clamp-1"
            style={{ color: 'var(--aura-text3)' }}
          >
            {injury?.diagnosis ?? protocol?.name ?? '—'}
          </p>
        </td>

        {/* Body region */}
        <td
          className="px-3 py-3 text-xs whitespace-nowrap"
          style={{ color: 'var(--aura-text2)' }}
        >
          {injury?.location ?? '—'}
        </td>

        {/* Phase */}
        <td className="px-3 py-3">
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: 'var(--aura-blue-bg)', color: 'var(--aura-blue)' }}
          >
            {phaseLabel}
          </span>
        </td>

        {/* Availability */}
        <td className="px-3 py-3">
          <AvailBadge status={session.availability_status} />
        </td>

        {/* Days + Edit button (Feature 1) */}
        <td className="px-3 py-3 text-right pr-4">
          <div className="flex items-center justify-end gap-2">
            <div className="flex items-center gap-1.5">
              <Clock size={11} style={{ color: 'var(--aura-text3)' }} />
              <span className="text-xs font-mono" style={{ color: 'var(--aura-text2)' }}>
                {daysIn}d
              </span>
              {protocol?.total_days && daysIn > protocol.total_days && (
                <AlertTriangle size={11} style={{ color: 'var(--aura-warn)' }} />
              )}
            </div>

            {/* Feature 1: Edit button */}
            <button
              type="button"
              title="Editar data / protocolo"
              onClick={(e) => {
                e.stopPropagation()   // prevent accordion toggle
                setShowEdit(true)
              }}
              className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100 hover:bg-[var(--aura-bg4)]"
            >
              <Edit2 size={12} style={{ color: 'var(--aura-text3)' }} />
            </button>
          </div>
        </td>
      </tr>

      {/* ── Expanded accordion panel ──────────────────────────────────── */}
      {open && (
        <tr
          style={{
            borderBottom:
              index < totalRows - 1 ? '1px solid var(--aura-border)' : undefined,
          }}
        >
          <td colSpan={7} className="px-4 pb-5 pt-0">
            <div
              className="rounded-xl border p-5 mt-1 grid gap-6"
              style={{
                background: 'var(--aura-bg)',
                borderColor: 'var(--aura-border)',
                gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)',
              }}
            >
              {/* Left: overview */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--aura-text3)' }}
                  >
                    Dados da Lesão
                  </p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {[
                      [
                        'Data da lesão',
                        injury?.injury_date
                          ? new Date(injury.injury_date).toLocaleDateString('pt-PT', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })
                          : '—',
                      ],
                      ['Severidade',  injury?.severity   ?? '—'],
                      ['Mecanismo',   injury?.mechanism  ?? '—'],
                      ['Protocolo',   protocol?.name     ?? '—'],
                      ['Localização', injury?.location   ?? '—'],
                      ['Evidência',   protocol?.evidence ?? '—'],
                    ].map(([k, v]) => (
                      <div key={k as string}>
                        <dt className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>
                          {k}
                        </dt>
                        <dd
                          className="text-xs font-medium mt-0.5 truncate"
                          style={{ color: 'var(--aura-text)' }}
                        >
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <UefaProgressBar
                  daysIn={daysIn}
                  totalExpected={protocol?.total_days ?? null}
                />

                {/* Availability selector (Feature 5: sends notification on change) */}
                <div className="space-y-1.5">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--aura-text3)' }}
                  >
                    Estado de Disponibilidade
                  </p>
                  <select
                    defaultValue={session.availability_status ?? ''}
                    className="w-full rounded-lg border px-3 py-1.5 text-xs outline-none"
                    style={{
                      background: 'var(--aura-bg3)',
                      borderColor: 'var(--aura-border)',
                      color: 'var(--aura-text)',
                    }}
                    onChange={async (e) => {
                      const val = e.target.value as AvailabilityStatus
                      const supabase = createClient()
                      await supabase
                        .from('rehab_sessions')
                        .update({ availability_status: val })
                        .eq('id', session.id)

                      // Feature 5: availability notification
                      if (athlete?.id) {
                        await sendStaffNotification({
                          type: 'availability_change',
                          message: buildAvailabilityMessage(athlete.name, val),
                          athlete_id: athlete.id,
                          session_id: session.id,
                          metadata: { previous: session.availability_status, current: val },
                        })
                      }
                      onUpdated()
                    }}
                  >
                    <option value="">— Seleccionar —</option>
                    {(Object.keys(AVAIL_CONFIG) as AvailabilityStatus[]).map((s) => (
                      <option key={s} value={s} style={{ background: 'var(--aura-bg2)' }}>
                        {AVAIL_CONFIG[s].label}
                      </option>
                    ))}
                  </select>
                </div>

                <ClinicalJournal
                  notes={localNotes}
                  sessionId={session.id}
                  onNotesChanged={setLocalNotes}
                />
              </div>

              {/* Right: phase stepper */}
              <div className="space-y-4">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--aura-text3)' }}
                >
                  Faseamento de Reabilitação
                </p>
                {rawPhases.length > 0 ? (
                  <PhaseStepper
                    phases={rawPhases}
                    currentDay={daysIn}
                    phaseProgress={localPhaseProgress}
                    rtpMetrics={rtpMetrics}
                    onProgressUpdate={handleProgressUpdate}
                    onRtpMetricsChange={setRtpMetrics}
                    onAdvancePhase={handleAdvancePhase}
                    onRegressPhase={handleRegressPhase}
                  />
                ) : (
                  <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>
                    Sem protocolo de fases definido para esta sessão.
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Feature 1: Edit modal */}
      {showEdit && (
        <EditInjuryModal
          open={showEdit}
          session={session}
          onClose={() => setShowEdit(false)}
          onSuccess={onUpdated}
        />
      )}
    </>
  )
}
