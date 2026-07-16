'use client'

/**
 * RecordInjuryModal
 *
 * 4-step wizard for registering a new injury session.
 *
 * Features:
 *  0. OSIICS list only renders after 2+ chars typed OR a cascade filter selected
 *  2. Recurrence tracking alert — amber warning if same region/code in last 12 months
 *  3. Protocol sandbox — clinician can preview & customize phases before saving
 *     (customised structure saved in clinical_data.custom_phases, templates untouched)
 */

import { useState, useEffect, useCallback, useId } from 'react'
import {
  X, Search, AlertTriangle, CheckCircle2, Plus, Trash2,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  OsiicsCode, Athlete, AvailabilityStatus, ActiveRehabSession, RehabPhase,
} from '@/types'

// ── Local types ───────────────────────────────────────────────────────────────

interface EditablePhase {
  tempId: string
  name: string
  range: string
  d1: number
  d2: number
  color: string
  exercises: string[]
  criteria: string[]     // split from RehabPhase.criteria for individual editing
}

interface FullProtocol {
  id: string
  name: string
  key: string
  total_days: number | null
  phases: RehabPhase[]
  color: string | null
  evidence: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toEditablePhase(p: RehabPhase, idx: number): EditablePhase {
  return {
    tempId: `ph-${idx}-${p.id ?? idx}`,
    name: p.name,
    range: p.range ?? '',
    d1: p.d1 ?? 0,
    d2: p.d2 ?? 0,
    color: p.color ?? '#00e5a0',
    exercises: Array.isArray(p.exercises) ? p.exercises : [],
    criteria: p.criteria
      ? p.criteria.split(/[;\n]/).map((s) => s.trim()).filter(Boolean)
      : [],
  }
}

function mapSeverity(label: string | null): 'minor' | 'moderate' | 'major' | 'severe' {
  switch (label?.toLowerCase()) {
    case 'minor':    return 'minor'
    case 'moderate': return 'moderate'
    case 'major':    return 'major'
    case 'severe':   return 'severe'
    default:         return 'minor'
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UefaPreview({ code }: { code: OsiicsCode | null }) {
  if (!code) return null
  return (
    <div
      className="rounded-lg p-3 border space-y-1"
      style={{ background: 'rgba(0,229,160,0.05)', borderColor: 'var(--aura-green)' }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--aura-green)' }}
      >
        Referência UEFA
      </p>
      <p className="text-xs font-semibold" style={{ color: 'var(--aura-text)' }}>
        {code.diagnosis}
      </p>
      <div className="flex items-center gap-3">
        <span className="text-[11px]" style={{ color: 'var(--aura-text3)' }}>
          Severidade:{' '}
          <strong style={{ color: 'var(--aura-text2)' }}>{code.severity_label ?? '—'}</strong>
        </span>
        <span className="text-[11px]" style={{ color: 'var(--aura-text3)' }}>
          Recuperação:{' '}
          <strong style={{ color: 'var(--aura-text2)' }}>
            {code.expected_recovery_min ?? '?'}–{code.expected_recovery_max ?? '?'}d
          </strong>
        </span>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label
        className="block text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--aura-text3)' }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

// ── Feature 2: Recurrence Warning Banner ──────────────────────────────────────

function RecurrenceWarning({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div
      className="flex items-start gap-2 rounded-lg p-3 border text-xs"
      style={{
        background: 'rgba(255,196,0,0.08)',
        borderColor: 'var(--aura-warn)',
        color: 'var(--aura-warn)',
      }}
    >
      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
      <span>
        <strong>Possível Recidiva:</strong> Este atleta sofreu uma lesão semelhante
        (mesma região ou código OSIICS) nos últimos 12 meses.
        Avalie o historial clínico antes de prosseguir.
      </span>
    </div>
  )
}

// ── Feature 3: Protocol Sandbox ───────────────────────────────────────────────

function ProtocolSandbox({
  phases,
  onChange,
}: {
  phases: EditablePhase[]
  onChange: (updated: EditablePhase[]) => void
}) {
  const [openPhaseId, setOpenPhaseId] = useState<string | null>(
    phases[0]?.tempId ?? null,
  )
  const uid = useId()

  if (phases.length === 0) return null

  function updatePhase(tempId: string, patch: Partial<EditablePhase>) {
    onChange(phases.map((p) => (p.tempId === tempId ? { ...p, ...patch } : p)))
  }

  function addCriterion(tempId: string) {
    const phase = phases.find((p) => p.tempId === tempId)
    if (!phase) return
    updatePhase(tempId, { criteria: [...phase.criteria, ''] })
  }

  function updateCriterion(tempId: string, idx: number, val: string) {
    const phase = phases.find((p) => p.tempId === tempId)
    if (!phase) return
    const criteria = [...phase.criteria]
    criteria[idx] = val
    updatePhase(tempId, { criteria })
  }

  function removeCriterion(tempId: string, idx: number) {
    const phase = phases.find((p) => p.tempId === tempId)
    if (!phase) return
    updatePhase(tempId, { criteria: phase.criteria.filter((_, i) => i !== idx) })
  }

  const isLastPhase = (idx: number) => idx === phases.length - 1

  return (
    <div className="space-y-2">
      {phases.map((phase, phaseIdx) => {
        const isOpen = openPhaseId === phase.tempId
        const isRtp = isLastPhase(phaseIdx)
        return (
          <div
            key={phase.tempId}
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: isRtp ? 'var(--aura-warn)' : 'var(--aura-border)' }}
          >
            {/* Phase header */}
            <button
              type="button"
              onClick={() => setOpenPhaseId(isOpen ? null : phase.tempId)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[var(--aura-bg3)]"
              style={{ background: 'var(--aura-bg4)' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: phase.color }}
                />
                <span className="text-xs font-semibold" style={{ color: 'var(--aura-text)' }}>
                  {phaseIdx + 1}. {phase.name}
                </span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--aura-text3)' }}>
                  {phase.range}
                </span>
                {isRtp && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,196,0,0.15)', color: 'var(--aura-warn)' }}
                  >
                    RTP
                  </span>
                )}
              </div>
              {isOpen
                ? <ChevronDown size={13} style={{ color: 'var(--aura-text3)' }} />
                : <ChevronRight size={13} style={{ color: 'var(--aura-text3)' }} />
              }
            </button>

            {/* Phase body */}
            {isOpen && (
              <div
                className="px-3 pb-3 pt-2 space-y-3"
                style={{ background: 'var(--aura-bg2)' }}
              >
                {/* Phase name */}
                <div className="space-y-1">
                  <p
                    className="text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--aura-text3)' }}
                  >
                    Nome da fase
                  </p>
                  <input
                    value={phase.name}
                    onChange={(e) => updatePhase(phase.tempId, { name: e.target.value })}
                    className="w-full rounded-md border px-2.5 py-1.5 text-xs outline-none"
                    style={{
                      background: 'var(--aura-bg3)',
                      borderColor: 'var(--aura-border)',
                      color: 'var(--aura-text)',
                    }}
                  />
                </div>

                {/* Exercises (read-only tags) */}
                {phase.exercises.length > 0 && (
                  <div className="space-y-1">
                    <p
                      className="text-[9px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--aura-text3)' }}
                    >
                      Exercícios
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {phase.exercises.map((ex, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded"
                          style={{ background: 'var(--aura-bg3)', color: 'var(--aura-text3)' }}
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Criteria — editable */}
                <div className="space-y-1.5">
                  <p
                    className="text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--aura-text3)' }}
                  >
                    Critérios de progressão
                  </p>
                  {phase.criteria.length === 0 && (
                    <p className="text-[11px] italic" style={{ color: 'var(--aura-text3)' }}>
                      Sem critérios definidos.
                    </p>
                  )}
                  {phase.criteria.map((c, i) => (
                    <div key={`${uid}-${phase.tempId}-c${i}`} className="flex items-center gap-2">
                      <input
                        value={c}
                        onChange={(e) => updateCriterion(phase.tempId, i, e.target.value)}
                        placeholder="Descrever critério…"
                        className="flex-1 rounded-md border px-2.5 py-1 text-xs outline-none"
                        style={{
                          background: 'var(--aura-bg3)',
                          borderColor: 'var(--aura-border)',
                          color: 'var(--aura-text)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeCriterion(phase.tempId, i)}
                        className="shrink-0 p-1 rounded transition-colors hover:bg-[var(--aura-danger-bg)]"
                      >
                        <Trash2 size={11} style={{ color: 'var(--aura-danger)' }} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addCriterion(phase.tempId)}
                    className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md transition-colors hover:bg-[var(--aura-bg3)]"
                    style={{ color: 'var(--aura-green)' }}
                  >
                    <Plus size={11} />
                    Adicionar critério
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors'
const inputStyle = {
  background: 'var(--aura-bg3)',
  borderColor: 'var(--aura-border)',
  color: 'var(--aura-text)',
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface RecordInjuryModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (session: ActiveRehabSession) => void
  athletes: Athlete[]
}

type Step = 'athlete' | 'injury' | 'protocol' | 'confirm'
const STEPS: Step[] = ['athlete', 'injury', 'protocol', 'confirm']

export function RecordInjuryModal({
  open,
  onClose,
  onSuccess,
  athletes,
}: RecordInjuryModalProps) {
  // ── Step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('athlete')

  // ── Step 1: Athlete fields ────────────────────────────────────────────────
  const [athleteId, setAthleteId]       = useState('')
  const [injuryDate, setInjuryDate]     = useState('')
  const [mechanism, setMechanism]       = useState('')
  const [notes, setNotes]               = useState('')
  const [availability, setAvailability] = useState<AvailabilityStatus>('unfit')

  // ── Step 2: OSIICS cascade ────────────────────────────────────────────────
  const [osiicsCodes, setOsiicsCodes]   = useState<OsiicsCode[]>([])
  const [loadingCodes, setLoadingCodes] = useState(false)
  const [bodyRegion, setBodyRegion]     = useState('')
  const [injuryType, setInjuryType]     = useState('')
  const [osiicsSearch, setOsiicsSearch] = useState('')
  const [selectedCode, setSelectedCode] = useState<OsiicsCode | null>(null)

  // Feature 2: recurrence tracking
  const [recurrenceWarning, setRecurrenceWarning] = useState(false)

  // ── Step 3: Protocol + sandbox ────────────────────────────────────────────
  const [protocols, setProtocols]               = useState<FullProtocol[]>([])
  const [selectedProtocol, setSelectedProtocol] = useState('')
  const [customPhases, setCustomPhases]         = useState<EditablePhase[]>([])
  const [sandboxOpen, setSandboxOpen]           = useState(false)

  // ── Submission ────────────────────────────────────────────────────────────
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Load OSIICS codes on step 2 ───────────────────────────────────────────
  useEffect(() => {
    if (step !== 'injury' || osiicsCodes.length > 0) return
    void (async () => {
      setLoadingCodes(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('dim_osiics_codes')
        .select(
          'code, body_region, injury_type, diagnosis, severity_label, expected_recovery_min, expected_recovery_max',
        )
        .order('code')
      setOsiicsCodes(data ?? [])
      setLoadingCodes(false)
    })()
  }, [step, osiicsCodes.length])

  // ── Feature 2: recurrence check ───────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      if (!athleteId || (!bodyRegion && !selectedCode)) {
        setRecurrenceWarning(false)
        return
      }
      const supabase = createClient()
      const cutoff = new Date()
      cutoff.setFullYear(cutoff.getFullYear() - 1)
      const cutoffStr = cutoff.toISOString().split('T')[0]

      const { data } = await supabase
        .from('injury_events')
        .select('location, osiics_code, injury_date')
        .eq('athlete_id', athleteId)
        .gte('injury_date', cutoffStr)

      if (!data || data.length === 0) { setRecurrenceWarning(false); return }

      const hasMatch = data.some((e) => {
        const regionMatch =
          bodyRegion &&
          (e.location ?? '').toLowerCase().includes(bodyRegion.toLowerCase())
        const codeMatch =
          selectedCode && e.osiics_code === selectedCode.code
        return regionMatch || codeMatch
      })
      setRecurrenceWarning(hasMatch)
    }
    run()
  }, [athleteId, bodyRegion, selectedCode])

  // ── Load full protocols (with phases) on step 3 ───────────────────────────
  useEffect(() => {
    if (step !== 'protocol' || protocols.length > 0) return
    const supabase = createClient()
    supabase
      .from('rehab_protocols')
      .select('id, name, key, total_days, phases, color, evidence')
      .order('name')
      .then(({ data }) => setProtocols((data ?? []) as FullProtocol[]))
  }, [step, protocols.length])

  // ── When protocol changes, populate sandbox ───────────────────────────────
  useEffect(() => {
    const apply = () => {
      const proto = protocols.find((p) => p.id === selectedProtocol)
      if (!proto?.phases?.length) {
        setCustomPhases([])
        setSandboxOpen(false)
        return
      }
      const phases = (proto.phases as RehabPhase[]).map(toEditablePhase)
      setCustomPhases(phases)
      setSandboxOpen(true)
    }
    apply()
  }, [selectedProtocol, protocols])

  // ── Derived: OSIICS cascade filters ──────────────────────────────────────
  const bodyRegions = Array.from(new Set(osiicsCodes.map((c) => c.body_region))).sort()
  const injuryTypes = Array.from(
    new Set(
      osiicsCodes
        .filter((c) => !bodyRegion || c.body_region === bodyRegion)
        .map((c) => c.injury_type),
    ),
  ).sort()

  // Feature 0: only compute list when enough context is provided
  const showCodeList = osiicsSearch.length >= 2 || !!bodyRegion || !!injuryType
  const filteredCodes = showCodeList
    ? osiicsCodes.filter((c) => {
        if (bodyRegion && c.body_region !== bodyRegion) return false
        if (injuryType && c.injury_type !== injuryType) return false
        if (osiicsSearch.length >= 2) {
          const q = osiicsSearch.toLowerCase()
          return (
            c.code.toLowerCase().includes(q) ||
            c.diagnosis.toLowerCase().includes(q)
          )
        }
        return true
      })
    : []

  // ── Reset on close ────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setStep('athlete')
    setAthleteId('')
    setInjuryDate('')
    setMechanism('')
    setNotes('')
    setAvailability('unfit')
    setBodyRegion('')
    setInjuryType('')
    setOsiicsSearch('')
    setSelectedCode(null)
    setRecurrenceWarning(false)
    setSelectedProtocol('')
    setCustomPhases([])
    setSandboxOpen(false)
    setSaveError(null)
    onClose()
  }, [onClose])

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!athleteId || !injuryDate) return
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()

    // 1. Insert injury_event
    const { data: injuryData, error: injuryError } = await supabase
      .from('injury_events')
      .insert({
        athlete_id: athleteId,
        injury_date: injuryDate,
        diagnosis: selectedCode?.diagnosis ?? 'Lesão registada',
        location: selectedCode?.body_region ?? '',
        mechanism: mechanism || null,
        severity: mapSeverity(selectedCode?.severity_label ?? null),
        is_recurrence: false,
        notes: notes || null,
        osiics_code: selectedCode?.code ?? null,
      })
      .select('id')
      .single()

    if (injuryError || !injuryData) {
      setSaveError(injuryError?.message ?? 'Erro ao registar lesão.')
      setSaving(false)
      return
    }

    // Build clinical_data: include custom_phases from sandbox (Feature 3)
    const clinicalData: Record<string, unknown> = {
      notes: notes ? [{ text: notes, created_at: new Date().toISOString() }] : [],
      phase_progress: {},
      ...(selectedCode?.code ? { osiics_code: selectedCode.code } : {}),
      ...(customPhases.length
        ? {
            custom_phases: customPhases.map(({ tempId: _t, ...rest }) => ({
              ...rest,
              criteria: rest.criteria.join('; '),  // re-join for storage
            })),
          }
        : {}),
    }

    // 2. Insert rehab_session — try with migration columns, fall back to base
    function isSchemaCacheError(err: { code?: string; message?: string } | null) {
      if (!err) return false
      return (
        err.code === 'PGRST204' ||
        err.code === '42703' ||
        (err.message ?? '').toLowerCase().includes('schema cache') ||
        (err.message ?? '').toLowerCase().includes('could not find')
      )
    }

    const fullPayload: Record<string, unknown> = {
      athlete_id: athleteId,
      protocol_id: selectedProtocol || null,
      injury_event_id: injuryData.id,
      start_date: injuryDate,
      current_day: 1,
      rtp_criteria: [],
      clinical_data: clinicalData,
      availability_status: availability,
    }
    const basePayload: Record<string, unknown> = {
      athlete_id: athleteId,
      protocol_id: selectedProtocol || null,
      start_date: injuryDate,
      current_day: 1,
      rtp_criteria: [],
      clinical_data: clinicalData,
    }

    let sessionId: string | null = null
    const attempt1 = await supabase
      .from('rehab_sessions')
      .insert(fullPayload)
      .select('id')
      .single()

    if (attempt1.error) {
      if (isSchemaCacheError(attempt1.error)) {
        console.warn('[RecordInjuryModal] Schema fallback — run migration 002.')
        const attempt2 = await supabase
          .from('rehab_sessions')
          .insert(basePayload)
          .select('id')
          .single()
        if (attempt2.error || !attempt2.data) {
          setSaveError(attempt2.error?.message ?? 'Erro ao criar sessão.')
          setSaving(false)
          return
        }
        sessionId = attempt2.data.id
      } else {
        setSaveError(attempt1.error.message ?? 'Erro ao criar sessão.')
        setSaving(false)
        return
      }
    } else {
      sessionId = attempt1.data?.id ?? null
    }

    if (!sessionId) {
      setSaveError('Erro inesperado ao criar sessão.')
      setSaving(false)
      return
    }

    // Build optimistic ActiveRehabSession in-memory (avoids joined SELECT)
    const athlete = athletes.find((a) => a.id === athleteId)
    const protocol = protocols.find((p) => p.id === selectedProtocol) ?? null
    const now = new Date().toISOString()

    const builtSession: ActiveRehabSession = {
      id: sessionId,
      athlete_id: athleteId,
      protocol_id: selectedProtocol || null,
      injury_event_id: injuryData.id,
      start_date: injuryDate,
      current_day: 1,
      rtp_criteria: [],
      clinical_data: clinicalData,
      availability_status: availability,
      created_at: now,
      updated_at: now,
      athletes: athlete
        ? {
            id: athlete.id,
            name: athlete.name,
            shirt_number: athlete.shirt_number ?? 0,
            position: athlete.position ?? '',
            status: athlete.status,
          }
        : null,
      rehab_protocols: protocol
        ? {
            id: protocol.id,
            key: protocol.key,
            name: protocol.name,
            total_days: protocol.total_days,
            phases: customPhases.length
              ? (customPhases.map(({ tempId: _t, criteria, ...rest }) => ({
                  ...rest,
                  criteria: criteria.join('; '),
                  id: 0,
                })) as RehabPhase[])
              : (protocol.phases as RehabPhase[]),
            color: protocol.color,
            evidence: protocol.evidence,
          }
        : null,
      injury_events: {
        id: injuryData.id,
        diagnosis: selectedCode?.diagnosis ?? 'Lesão registada',
        location: selectedCode?.body_region ?? '',
        injury_date: injuryDate,
        severity: mapSeverity(selectedCode?.severity_label ?? null),
        osiics_code: selectedCode?.code ?? null,
        mechanism: mechanism || null,
      },
    }

    setSaving(false)
    onSuccess(builtSession)
    handleClose()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!open) return null

  const currentStepIdx = STEPS.indexOf(step)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--aura-bg2)',
          borderColor: 'var(--aura-border)',
          maxHeight: '90vh',
        }}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--aura-border)' }}
        >
          <div>
            <h2
              className="text-base font-bold"
              style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
            >
              Registar Lesão
            </h2>
            {/* Step dots */}
            <div className="flex items-center gap-1.5 mt-1">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full transition-all"
                    style={{
                      background:
                        s === step
                          ? 'var(--aura-green)'
                          : i < currentStepIdx
                          ? 'var(--aura-text3)'
                          : 'var(--aura-bg4)',
                    }}
                  />
                  {i < STEPS.length - 1 && (
                    <div className="w-4 h-px" style={{ background: 'var(--aura-border)' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--aura-bg3)]"
          >
            <X size={16} style={{ color: 'var(--aura-text3)' }} />
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ── Step 1: Athlete ──────────────────────────────────────────── */}
          {step === 'athlete' && (
            <>
              <Field label="Atleta">
                <select
                  aria-label="Atleta"
                  value={athleteId}
                  onChange={(e) => setAthleteId(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">— Seleccionar atleta —</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id} style={{ background: 'var(--aura-bg2)' }}>
                      #{a.shirt_number} {a.name} ({a.position})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Data da Lesão">
                <input
                  type="date"
                  value={injuryDate}
                  onChange={(e) => setInjuryDate(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </Field>

              <Field label="Mecanismo (opcional)">
                <input
                  type="text"
                  value={mechanism}
                  onChange={(e) => setMechanism(e.target.value)}
                  placeholder="ex: contacto, não-contacto, overuse…"
                  className={inputClass}
                  style={inputStyle}
                />
              </Field>

              <Field label="Estado de Disponibilidade Inicial">
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value as AvailabilityStatus)}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="unfit">Indisponível</option>
                  <option value="modified">Treino Modificado</option>
                  <option value="monitoring">Em Monitorização</option>
                  <option value="delayed">Adiado</option>
                </select>
              </Field>
            </>
          )}

          {/* ── Step 2: OSIICS code ──────────────────────────────────────── */}
          {step === 'injury' && (
            <>
              {/* Feature 2: Recurrence warning */}
              <RecurrenceWarning visible={recurrenceWarning} />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Região Corporal">
                  <select
                    value={bodyRegion}
                    onChange={(e) => {
                      setBodyRegion(e.target.value)
                      setInjuryType('')
                      setSelectedCode(null)
                    }}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="">Todas as regiões</option>
                    {bodyRegions.map((r) => (
                      <option key={r} value={r} style={{ background: 'var(--aura-bg2)' }}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Tipo de Lesão">
                  <select
                    value={injuryType}
                    onChange={(e) => { setInjuryType(e.target.value); setSelectedCode(null) }}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="">Todos os tipos</option>
                    {injuryTypes.map((t) => (
                      <option key={t} value={t} style={{ background: 'var(--aura-bg2)' }}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Código OSIICS">
                {/* Search input */}
                <div
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                  style={{
                    borderColor: 'var(--aura-border)',
                    background: 'var(--aura-bg3)',
                  }}
                >
                  <Search size={13} style={{ color: 'var(--aura-text3)' }} />
                  <input
                    value={osiicsSearch}
                    onChange={(e) => setOsiicsSearch(e.target.value)}
                    placeholder="Pesquisar código ou diagnóstico…"
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: 'var(--aura-text)' }}
                  />
                </div>

                {/* Feature 0: list only appears with sufficient input */}
                {loadingCodes ? (
                  <p className="text-xs mt-2" style={{ color: 'var(--aura-text3)' }}>
                    A carregar códigos…
                  </p>
                ) : !showCodeList ? (
                  <p
                    className="text-xs mt-2 text-center py-4 italic"
                    style={{ color: 'var(--aura-text3)' }}
                  >
                    Escreva pelo menos 2 caracteres ou seleccione uma região para pesquisar.
                  </p>
                ) : (
                  <div
                    className="mt-1 rounded-lg border overflow-y-auto"
                    style={{ borderColor: 'var(--aura-border)', maxHeight: 220 }}
                  >
                    {filteredCodes.length === 0 ? (
                      <p
                        className="text-xs px-3 py-4 text-center"
                        style={{ color: 'var(--aura-text3)' }}
                      >
                        Nenhum código encontrado.
                      </p>
                    ) : (
                      filteredCodes.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setSelectedCode(c)}
                          className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors hover:bg-[var(--aura-bg3)] border-b last:border-b-0"
                          style={{
                            borderColor: 'var(--aura-border)',
                            background:
                              selectedCode?.code === c.code
                                ? 'rgba(0,229,160,0.08)'
                                : undefined,
                          }}
                        >
                          <span
                            className="font-mono font-bold text-[11px] shrink-0 px-1.5 py-0.5 rounded"
                            style={{
                              color: 'var(--aura-green)',
                              background: 'rgba(0,229,160,0.08)',
                            }}
                          >
                            {c.code}
                          </span>
                          <span
                            className="text-xs flex-1 leading-tight"
                            style={{ color: 'var(--aura-text2)' }}
                          >
                            {c.diagnosis}
                          </span>
                          {selectedCode?.code === c.code && (
                            <CheckCircle2 size={13} style={{ color: 'var(--aura-green)' }} />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </Field>

              {/* UEFA preview */}
              <UefaPreview code={selectedCode} />

              <Field label="Notas clínicas iniciais (opcional)">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações clínicas, contexto…"
                  rows={3}
                  className={inputClass + ' resize-none'}
                  style={inputStyle}
                />
              </Field>
            </>
          )}

          {/* ── Step 3: Protocol + sandbox ───────────────────────────────── */}
          {step === 'protocol' && (
            <>
              {/* OSIICS code badge recap */}
              {selectedCode && (
                <div
                  className="rounded-lg p-3 border text-xs"
                  style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border)' }}
                >
                  <span className="font-mono font-bold" style={{ color: 'var(--aura-green)' }}>
                    {selectedCode.code}
                  </span>
                  <span className="ml-2" style={{ color: 'var(--aura-text2)' }}>
                    {selectedCode.diagnosis}
                  </span>
                </div>
              )}

              <Field label="Protocolo de Reabilitação (opcional)">
                <select
                  value={selectedProtocol}
                  onChange={(e) => setSelectedProtocol(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">— Sem protocolo por agora —</option>
                  {protocols.map((p) => (
                    <option key={p.id} value={p.id} style={{ background: 'var(--aura-bg2)' }}>
                      {p.name}{p.total_days ? ` (${p.total_days}d)` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] mt-1" style={{ color: 'var(--aura-text3)' }}>
                  Pode ser atribuído ou alterado mais tarde no painel médico.
                </p>
              </Field>

              {/* Feature 3: Protocol Sandbox */}
              {customPhases.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setSandboxOpen((o) => !o)}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 border transition-colors hover:bg-[var(--aura-bg3)]"
                    style={{
                      background: 'var(--aura-bg3)',
                      borderColor: 'var(--aura-border)',
                    }}
                  >
                    <span className="text-xs font-semibold" style={{ color: 'var(--aura-text)' }}>
                      Preview & Personalizar Fases do Protocolo
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono" style={{ color: 'var(--aura-text3)' }}>
                        {customPhases.length} fases
                      </span>
                      {sandboxOpen
                        ? <ChevronDown size={13} style={{ color: 'var(--aura-text3)' }} />
                        : <ChevronRight size={13} style={{ color: 'var(--aura-text3)' }} />
                      }
                    </div>
                  </button>

                  {sandboxOpen && (
                    <div className="space-y-2">
                      <p className="text-[11px]" style={{ color: 'var(--aura-text3)' }}>
                        Personalize esta instância para o atleta. Os templates globais em{' '}
                        <code className="font-mono text-[10px]">rehab_protocols</code> não são
                        alterados.
                      </p>
                      <ProtocolSandbox
                        phases={customPhases}
                        onChange={setCustomPhases}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Step 4: Confirm ──────────────────────────────────────────── */}
          {step === 'confirm' && (
            <div className="space-y-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>
                Confirmar registo de lesão
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {[
                  ['Atleta',       athletes.find((a) => a.id === athleteId)?.name ?? '—'],
                  ['Data',         injuryDate],
                  ['Diagnóstico',  selectedCode?.diagnosis ?? '—'],
                  ['Código OSIICS', selectedCode?.code ?? '—'],
                  ['Região',       selectedCode?.body_region ?? '—'],
                  ['Protocolo',    protocols.find((p) => p.id === selectedProtocol)?.name ?? 'Nenhum'],
                  ['Fases custom', customPhases.length ? `${customPhases.length} fases personalizadas` : 'Template padrão'],
                  ['Disponibilidade', availability],
                  ['Mecanismo',    mechanism || '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt style={{ color: 'var(--aura-text3)' }}>{k}</dt>
                    <dd className="font-semibold mt-0.5" style={{ color: 'var(--aura-text)' }}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>

              {saveError && (
                <div
                  className="flex items-start gap-2 rounded-lg p-3 border text-xs"
                  style={{
                    background: 'var(--aura-danger-bg)',
                    borderColor: 'var(--aura-danger)',
                    color: 'var(--aura-danger)',
                  }}
                >
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  {saveError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: 'var(--aura-border)' }}
        >
          <button
            type="button"
            onClick={() => {
              if (step === 'athlete') handleClose()
              else setStep(STEPS[currentStepIdx - 1])
            }}
            className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--aura-bg3)]"
            style={{ color: 'var(--aura-text2)' }}
          >
            {step === 'athlete' ? 'Cancelar' : '← Anterior'}
          </button>

          {step !== 'confirm' ? (
            <button
              type="button"
              disabled={step === 'athlete' && (!athleteId || !injuryDate)}
              onClick={() => setStep(STEPS[currentStepIdx + 1])}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: 'var(--aura-green)', color: '#000' }}
            >
              Seguinte →
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: 'var(--aura-green)', color: '#000' }}
            >
              {saving ? 'A guardar…' : 'Confirmar e Guardar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
