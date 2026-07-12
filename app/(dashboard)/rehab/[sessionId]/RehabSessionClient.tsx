'use client'
// app/(dashboard)/rehab/[sessionId]/RehabSessionClient.tsx
// Issue #20: interactive clinical assessment + phase gate UI + override modal

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type {
  RehabProtocolDef,
  ProtocolPhase,
  ClinicalAssessment,
  PhaseGate,
  ProgressionOverride,
  OverrideReason,
} from '@/types/rehab'

interface PhaseWithEligibility {
  phase: ProtocolPhase
  status: string
  eligibility: {
    gates: Array<{ gate: PhaseGate; passed: boolean; actual_value?: unknown }>
    all_gates_passed: boolean
    blocking_gates: PhaseGate[]
  }
}

interface Props {
  session: Record<string, unknown> & {
    id: string
    current_day: number
    rtp_criteria: Array<{ label: string; done: boolean }>
    athletes: { name: string; shirt_number: number; position: string; club: string } | null
    rehab_protocols: { name: string; key: string } | null
  }
  protocol: RehabProtocolDef
  assessment: ClinicalAssessment
  phaseEligibilities: PhaseWithEligibility[]
  canAdvance: boolean
  blockingGates: PhaseGate[]
  overrideLog: ProgressionOverride[]
  currentPhaseId: number
  startDate: string | null
  activeInjury: {
    injury_date: string
    return_date: string | null
    diagnosis: string | null
    severity: string | null
    location: string | null
  } | null
}

// ── Weekly planning calendar ─────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  minor: 'var(--aura-warn)', moderate: 'var(--aura-warn)',
  major: 'var(--aura-danger)', severe: 'var(--aura-danger)',
}

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function CalendarCell({
  dateKey,
  slot,
  initialValue,
  phaseColor,
  onSave,
}: {
  dateKey: string
  slot: string
  initialValue: string
  phaseColor: string
  onSave: (v: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)

  async function handleBlur() {
    if (value === initialValue) return
    setSaving(true)
    onSave(value)
    setSaving(false)
  }

  return (
    <textarea
      key={`${dateKey}-${slot}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="—"
      rows={3}
      style={{
        width: '100%',
        resize: 'vertical',
        border: `1px solid ${saving ? phaseColor : 'var(--aura-border)'}`,
        borderRadius: 6,
        background: 'var(--aura-bg3)',
        color: 'var(--aura-text)',
        fontSize: 11,
        fontFamily: 'var(--font-inter)',
        padding: '6px 8px',
        lineHeight: 1.5,
        boxSizing: 'border-box',
        transition: 'border-color .2s',
      }}
    />
  )
}

function WeekCalendar({
  assessment,
  updateAssessment,
  startDate,
  protocol,
}: {
  assessment: ClinicalAssessment
  updateAssessment: (field: string, value: unknown) => Promise<void>
  startDate: string | null
  protocol: RehabProtocolDef
}) {
  const [weekOffset, setWeekOffset] = useState(0)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const monday = mondayOf(new Date())
    monday.setDate(monday.getDate() + weekOffset * 7 + i)
    return monday
  })

  const calendar = (assessment.calendar ?? {}) as Record<string, { morning?: string; afternoon?: string }>

  function protocolDay(date: Date): number | null {
    if (!startDate) return null
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const diff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return diff >= 0 ? diff + 1 : null
  }

  function phaseFor(date: Date) {
    const d = protocolDay(date)
    if (d === null) return null
    return protocol.phases.find((p) => d >= p.d1 && d <= p.d2) ?? null
  }

  function saveCell(date: Date, slot: 'morning' | 'afternoon', text: string) {
    const key = date.toISOString().slice(0, 10)
    const updated = {
      ...calendar,
      [key]: { ...(calendar[key] ?? {}), [slot]: text },
    }
    updateAssessment('calendar', updated)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekLabel = `${weekDays[0].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div
      style={{
        background: 'var(--aura-bg2)',
        border: '1px solid var(--aura-border)',
        borderRadius: 12,
        padding: '18px 20px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          style={{
            width: 28, height: 28, borderRadius: 6, border: '1px solid var(--aura-border)',
            background: 'var(--aura-bg3)', color: 'var(--aura-text2)', cursor: 'pointer', fontSize: 14,
          }}
        >
          ←
        </button>
        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: 'var(--aura-text2)', flex: 1, textAlign: 'center' }}>
          {weekLabel}
        </span>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          style={{
            width: 28, height: 28, borderRadius: 6, border: '1px solid var(--aura-border)',
            background: 'var(--aura-bg3)', color: 'var(--aura-text2)', cursor: 'pointer', fontSize: 14,
          }}
        >
          →
        </button>
        {weekOffset !== 0 && (
          <button
            onClick={() => setWeekOffset(0)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--aura-border)',
              background: 'var(--aura-bg3)', color: 'var(--aura-text3)', cursor: 'pointer', fontSize: 10,
              fontFamily: 'var(--font-dm-mono)',
            }}
          >
            Hoje
          </button>
        )}
      </div>

      {/* Calendar grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ width: 60, padding: '6px 8px', textAlign: 'left' }} />
              {weekDays.map((day, i) => {
                const phase = phaseFor(day)
                const pDay = protocolDay(day)
                const isToday = day.getTime() === today.getTime()
                return (
                  <th
                    key={i}
                    style={{
                      padding: '6px 8px',
                      textAlign: 'center',
                      borderBottom: `2px solid ${phase?.color ?? 'var(--aura-border)'}`,
                      background: isToday ? `${phase?.color ?? 'var(--aura-green)'}10` : 'transparent',
                      borderRadius: isToday ? '6px 6px 0 0' : 0,
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: 'var(--aura-text3)' }}>
                      {DAY_LABELS[i]}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-dm-mono)', fontSize: 12,
                      color: isToday ? (phase?.color ?? 'var(--aura-green)') : 'var(--aura-text)',
                      fontWeight: isToday ? 700 : 400,
                    }}>
                      {day.getDate()}/{day.getMonth() + 1}
                    </div>
                    {pDay !== null && (
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-dm-mono)', color: phase?.color ?? 'var(--aura-text3)', marginTop: 1 }}>
                        D{pDay} {phase ? `· ${phase.name}` : ''}
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {(['morning', 'afternoon'] as const).map((slot) => (
              <tr key={slot}>
                <td style={{
                  padding: '8px',
                  fontFamily: 'var(--font-dm-mono)',
                  fontSize: 9,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: 'var(--aura-text3)',
                  verticalAlign: 'top',
                  paddingTop: 14,
                  borderTop: '1px solid var(--aura-border)',
                }}>
                  {slot === 'morning' ? 'Manhã' : 'Tarde'}
                </td>
                {weekDays.map((day, i) => {
                  const dateKey = day.toISOString().slice(0, 10)
                  const phase = phaseFor(day)
                  const phaseColor = phase?.color ?? 'var(--aura-border)'
                  const initial = calendar[dateKey]?.[slot] ?? ''
                  return (
                    <td
                      key={i}
                      style={{
                        padding: '6px 4px',
                        verticalAlign: 'top',
                        borderTop: '1px solid var(--aura-border)',
                      }}
                    >
                      <CalendarCell
                        key={`${weekOffset}-${dateKey}-${slot}`}
                        dateKey={dateKey}
                        slot={slot}
                        initialValue={initial}
                        phaseColor={phaseColor}
                        onSave={(text) => saveCell(day, slot, text)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!startDate && (
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
          * Sem data de início de sessão — dias de protocolo não calculados
        </div>
      )}
    </div>
  )
}

const OVERRIDE_REASONS: Array<{ value: OverrideReason; label: string }> = [
  { value: 'medical_clearance', label: 'Autorização médica' },
  { value: 'competition_urgency', label: 'Urgência competitiva' },
  { value: 'athlete_response', label: 'Resposta positiva do atleta' },
  { value: 'consultant_review', label: 'Revisão por especialista' },
  { value: 'other', label: 'Outro' },
]

export default function RehabSessionClient({
  session,
  protocol,
  assessment: initialAssessment,
  phaseEligibilities,
  canAdvance,
  blockingGates,
  overrideLog,
  currentPhaseId,
  startDate,
  activeInjury,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [assessment, setAssessment] = useState<ClinicalAssessment>(initialAssessment)
  const [rtp, setRtp] = useState(session.rtp_criteria ?? [])
  const [showOverride, setShowOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState<OverrideReason>('medical_clearance')
  const [overrideNotes, setOverrideNotes] = useState('')
  const [activeTab, setActiveTab] = useState<'assessment' | 'timeline' | 'calendario' | 'audit'>('assessment')
  const [saving, setSaving] = useState(false)
  const [savedField, setSavedField] = useState<string | null>(null)

  const athlete = session.athletes
  const currentPhase = protocol.phases.find(p => p.id === currentPhaseId)

  async function updateAssessment(field: string, value: unknown) {
    setAssessment(prev => ({ ...prev, [field]: value }))
    setSaving(true)
    setSavedField(field)
    try {
      await fetch(`/api/rehab/${session.id}/assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      })
    } finally {
      setSaving(false)
      setTimeout(() => setSavedField(null), 1500)
    }
  }

  async function advancePhase(withOverride = false) {
    const body: Record<string, unknown> = { to_phase: currentPhaseId + 1 }
    if (withOverride) {
      body.override_reason = overrideReason
      body.override_notes = overrideNotes
    }

    const res = await fetch(`/api/rehab/${session.id}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setShowOverride(false)
      startTransition(() => router.refresh())
    }
  }

  const progressPct = Math.round(((session.current_day - 1) / protocol.total_days) * 100)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: 'var(--aura-bg3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-dm-mono)',
            fontSize: 16,
            color: 'var(--aura-text2)',
            flexShrink: 0,
          }}
        >
          {athlete?.shirt_number}
        </div>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-syne)',
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--aura-text)',
              margin: 0,
            }}
          >
            {athlete?.name}
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--aura-text2)', fontFamily: 'var(--font-dm-mono)' }}>
            {athlete?.position} · {athlete?.club} · {protocol.name} · Dia {session.current_day}/{protocol.total_days}
          </div>
          {activeInjury?.diagnosis && (
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
                {activeInjury.diagnosis}
                {activeInjury.location && ` · ${activeInjury.location}`}
              </span>
              {activeInjury.severity && (
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-dm-mono)',
                  color: SEV_COLOR[activeInjury.severity] ?? 'var(--aura-text3)',
                  background: `${SEV_COLOR[activeInjury.severity] ?? 'var(--aura-bg3)'}20`,
                  padding: '1px 6px', borderRadius: 3,
                  border: `1px solid ${SEV_COLOR[activeInjury.severity] ?? 'var(--aura-border)'}40`,
                }}>
                  {activeInjury.severity}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Phase advancement button */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {currentPhaseId < protocol.phases.length && (
            canAdvance ? (
              <button
                onClick={() => advancePhase(false)}
                disabled={isPending}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--aura-green)',
                  color: '#000',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {isPending ? 'A avançar...' : '→ Avançar fase'}
              </button>
            ) : (
              <button
                onClick={() => setShowOverride(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--aura-warn)',
                  background: 'rgba(255,179,71,0.1)',
                  color: 'var(--aura-warn)',
                  fontWeight: 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Override ({blockingGates.length} gate{blockingGates.length > 1 ? 's' : ''} pendente{blockingGates.length > 1 ? 's' : ''})
              </button>
            )
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: 'var(--aura-bg4)', borderRadius: 3, overflow: 'hidden', marginBottom: '20px' }}>
        <div
          style={{
            width: `${progressPct}%`,
            height: 5,
            background: currentPhase?.color ?? 'var(--aura-green)',
            borderRadius: 3,
            transition: 'width .3s',
          }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {(['assessment', 'timeline', 'calendario', 'audit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-mono)',
              fontSize: '10px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              border: `1px solid ${activeTab === tab ? currentPhase?.color ?? 'var(--aura-green)' : 'var(--aura-border)'}`,
              background: activeTab === tab ? `${currentPhase?.color ?? '#00e5a0'}15` : 'transparent',
              color: activeTab === tab ? currentPhase?.color ?? 'var(--aura-green)' : 'var(--aura-text2)',
              transition: 'all .15s',
            }}
          >
            {tab === 'assessment' ? 'Avaliação clínica' : tab === 'timeline' ? 'Protocolo' : tab === 'calendario' ? 'Calendário' : 'Histórico'}
          </button>
        ))}
      </div>

      {/* ── Tab: Clinical Assessment ── */}
      {activeTab === 'assessment' && currentPhase && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {/* Assessment fields */}
          <div
            style={{
              background: 'var(--aura-bg2)',
              border: '1px solid var(--aura-border)',
              borderRadius: '12px',
              padding: '18px 20px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-dm-mono)',
                fontSize: '9px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: 'var(--aura-text3)',
                marginBottom: '14px',
              }}
            >
              Avaliação — {currentPhase.name}
            </div>

            {currentPhase.assessment_fields.map(field => {
              const currentVal = assessment[field.key]
              const isSaved = savedField === field.key && !saving

              return (
                <div key={field.key} style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: 'var(--aura-text2)' }}>
                      {field.label}
                    </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {isSaved && (
                        <span style={{ fontSize: '10px', color: 'var(--aura-green)', fontFamily: 'var(--font-dm-mono)' }}>
                          ✓
                        </span>
                      )}
                      {field.evidence_ref && (
                        <span
                          style={{
                            fontSize: '9px',
                            color: 'var(--aura-text3)',
                            fontFamily: 'var(--font-dm-mono)',
                          }}
                          title={field.evidence_ref}
                        >
                          {field.evidence_ref.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  {field.type === 'vas_slider' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--aura-text3)' }}>0</span>
                        <span
                          style={{
                            fontFamily: 'var(--font-dm-mono)',
                            fontSize: '12px',
                            fontWeight: 600,
                            color:
                              (currentVal as number) <= 2
                                ? 'var(--aura-green)'
                                : (currentVal as number) <= 5
                                ? 'var(--aura-warn)'
                                : 'var(--aura-danger)',
                          }}
                        >
                          {currentVal !== undefined && currentVal !== null ? `${currentVal}${field.unit ?? ''}` : '—'}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--aura-text3)' }}>10</span>
                      </div>
                      <input
                        type="range"
                        min={field.min ?? 0}
                        max={field.max ?? 10}
                        step={field.step ?? 1}
                        value={(currentVal as number) ?? 5}
                        onChange={e => updateAssessment(field.key, parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--aura-green)', cursor: 'pointer' }}
                      />
                    </div>
                  )}

                  {field.type === 'button_select' && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {(field.options ?? []).map(opt => {
                        const isActive = currentVal === opt.value
                        return (
                          <button
                            key={String(opt.value)}
                            onClick={() => updateAssessment(field.key, opt.value)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontFamily: 'var(--font-dm-mono)',
                              fontSize: '11px',
                              cursor: 'pointer',
                              transition: 'all .15s',
                              border: `1px solid ${isActive ? 'var(--aura-green)' : 'var(--aura-border)'}`,
                              background: isActive ? 'rgba(0,229,160,0.12)' : 'var(--aura-bg3)',
                              color: isActive ? 'var(--aura-green)' : 'var(--aura-text2)',
                            }}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {field.type === 'boolean_toggle' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(field.options ?? []).map(opt => {
                        const isActive = currentVal === opt.value
                        const isNeg = opt.value === true
                        return (
                          <button
                            key={String(opt.value)}
                            onClick={() => updateAssessment(field.key, opt.value)}
                            style={{
                              flex: 1,
                              padding: '6px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              border: `1px solid ${isActive ? (isNeg ? 'var(--aura-green)' : 'var(--aura-danger)') : 'var(--aura-border)'}`,
                              background: isActive ? (isNeg ? 'rgba(0,229,160,0.1)' : 'rgba(255,77,109,0.1)') : 'var(--aura-bg3)',
                              color: isActive ? (isNeg ? 'var(--aura-green)' : 'var(--aura-danger)') : 'var(--aura-text2)',
                              transition: 'all .15s',
                            }}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Gate status */}
          <div
            style={{
              background: 'var(--aura-bg2)',
              border: '1px solid var(--aura-border)',
              borderRadius: '12px',
              padding: '18px 20px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-dm-mono)',
                fontSize: '9px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: 'var(--aura-text3)',
                marginBottom: '14px',
              }}
            >
              Phase gates — critérios de progressão
            </div>

            {phaseEligibilities
              .find(pe => pe.phase.id === currentPhaseId)
              ?.eligibility.gates.map(({ gate, passed, actual_value }) => (
                <div
                  key={gate.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    background: passed ? 'rgba(0,229,160,0.06)' : 'rgba(255,77,109,0.06)',
                    border: `1px solid ${passed ? 'rgba(0,229,160,0.2)' : 'rgba(255,77,109,0.2)'}`,
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: passed ? 'var(--aura-green)' : 'var(--aura-danger)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      flexShrink: 0,
                      color: passed ? '#000' : '#fff',
                    }}
                  >
                    {passed ? '✓' : '✗'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: passed ? 'var(--aura-text)' : 'var(--aura-text2)' }}>
                      {gate.label}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--aura-text3)', marginTop: '2px', fontFamily: 'var(--font-dm-mono)' }}>
                      {actual_value !== null && actual_value !== undefined
                        ? `Actual: ${actual_value}`
                        : 'Não avaliado'}
                      {gate.evidence_ref && ` · ${gate.evidence_ref}`}
                    </div>
                    {!passed && gate.overridable && (
                      <div style={{ fontSize: '9px', color: 'var(--aura-warn)', marginTop: '2px', fontFamily: 'var(--font-dm-mono)' }}>
                        Overridable pelo clínico
                      </div>
                    )}
                    {!passed && !gate.overridable && (
                      <div style={{ fontSize: '9px', color: 'var(--aura-danger)', marginTop: '2px', fontFamily: 'var(--font-dm-mono)' }}>
                        Mandatório — sem override possível
                      </div>
                    )}
                  </div>
                </div>
              ))}

            {/* RTP criteria */}
            <div
              style={{
                fontFamily: 'var(--font-dm-mono)',
                fontSize: '9px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: 'var(--aura-text3)',
                margin: '16px 0 10px',
              }}
            >
              Critérios de retorno ao jogo
            </div>
            {rtp.map((criterion, idx) => (
              <div
                key={idx}
                onClick={async () => {
                  const updated = rtp.map((r, i) =>
                    i === idx ? { ...r, done: !r.done } : r
                  )
                  setRtp(updated)
                  const res = await fetch(`/api/rehab/${session.id}/rtp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rtp_criteria: updated }),
                  })
                  if (!res.ok) setRtp(rtp)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '7px 0',
                  borderBottom: idx < rtp.length - 1 ? '1px solid var(--aura-border)' : 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '4px',
                    border: `1px solid ${criterion.done ? 'var(--aura-green)' : 'var(--aura-border)'}`,
                    background: criterion.done ? 'var(--aura-green)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    color: criterion.done ? '#000' : 'transparent',
                    flexShrink: 0,
                    transition: 'all .15s',
                  }}
                >
                  ✓
                </div>
                <span style={{ color: criterion.done ? 'var(--aura-green)' : 'var(--aura-text2)' }}>
                  {criterion.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Protocol Timeline ── */}
      {activeTab === 'timeline' && (
        <div
          style={{
            background: 'var(--aura-bg2)',
            border: '1px solid var(--aura-border)',
            borderRadius: '12px',
            padding: '18px 20px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-dm-mono)',
              fontSize: '9px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: 'var(--aura-text3)',
              marginBottom: '16px',
            }}
          >
            {protocol.name} · {protocol.total_days} dias
          </div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
            {protocol.phases.map(phase => {
              const isDone = phase.id < currentPhaseId
              const isActive = phase.id === currentPhaseId
              return (
                <div
                  key={phase.id}
                  style={{
                    flex: '0 0 auto',
                    minWidth: 200,
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${isActive ? phase.color : isDone ? 'rgba(0,229,160,0.25)' : 'var(--aura-border)'}`,
                    background: isActive ? `${phase.color}15` : isDone ? 'rgba(0,229,160,0.05)' : 'var(--aura-bg3)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-dm-mono)',
                      fontSize: '9px',
                      color: 'var(--aura-text3)',
                      marginBottom: '4px',
                    }}
                  >
                    {phase.d1 === phase.d2 ? `Dia ${phase.d1}` : `Dia ${phase.d1}–${phase.d2}`}
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '13px',
                      color: isDone ? 'var(--aura-green)' : isActive ? phase.color : 'var(--aura-text3)',
                      marginBottom: '10px',
                    }}
                  >
                    {isDone ? '✓ ' : ''}{phase.name}
                  </div>
                  {phase.exercises.map((ex, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: '11px',
                        color: 'var(--aura-text2)',
                        padding: '3px 0',
                        borderBottom: i < phase.exercises.length - 1 ? '1px solid var(--aura-border)' : 'none',
                      }}
                    >
                      {ex}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Audit Log ── */}
      {activeTab === 'audit' && (
        <div
          style={{
            background: 'var(--aura-bg2)',
            border: '1px solid var(--aura-border)',
            borderRadius: '12px',
            padding: '18px 20px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-dm-mono)',
              fontSize: '9px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: 'var(--aura-text3)',
              marginBottom: '14px',
            }}
          >
            Histórico de overrides ({overrideLog.length})
          </div>
          {overrideLog.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--aura-text3)', padding: '1rem 0' }}>
              Sem overrides registados. Todas as progressões seguiram os critérios clínicos.
            </div>
          ) : (
            overrideLog.map(entry => (
              <div
                key={entry.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255,179,71,0.06)',
                  border: '1px solid rgba(255,179,71,0.2)',
                  marginBottom: '8px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--aura-warn)' }}>
                    Fase {entry.from_phase} → Fase {entry.to_phase}
                  </span>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '10px', color: 'var(--aura-text3)' }}>
                    {new Date(entry.overridden_at).toLocaleDateString('pt-PT', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div style={{ color: 'var(--aura-text2)' }}>
                  Motivo: {OVERRIDE_REASONS.find(r => r.value === entry.reason)?.label ?? entry.reason}
                </div>
                {entry.notes && (
                  <div style={{ color: 'var(--aura-text3)', marginTop: '4px', fontStyle: 'italic' }}>
                    &ldquo;{entry.notes}&rdquo;
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Tab: Calendário ── */}
      {activeTab === 'calendario' && (
        <WeekCalendar
          assessment={assessment}
          updateAssessment={updateAssessment}
          startDate={startDate}
          protocol={protocol}
        />
      )}

      {/* ── Override Modal ── */}
      {showOverride && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={e => e.target === e.currentTarget && setShowOverride(false)}
        >
          <div
            style={{
              background: 'var(--aura-bg2)',
              border: '1px solid rgba(255,179,71,0.3)',
              borderRadius: '14px',
              padding: '24px',
              width: '100%',
              maxWidth: '460px',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-syne)',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--aura-warn)',
                marginBottom: '6px',
              }}
            >
              Override de fase
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--aura-text2)', marginBottom: '16px' }}>
              Os seguintes critérios não estão cumpridos. O override ficará registado no histórico de auditoria.
            </p>

            {/* Blocking gates */}
            <div style={{ marginBottom: '16px' }}>
              {blockingGates.map(g => (
                <div
                  key={g.id}
                  style={{
                    fontSize: '12px',
                    color: 'var(--aura-danger)',
                    padding: '5px 0',
                    borderBottom: '1px solid var(--aura-border)',
                    display: 'flex',
                    gap: '8px',
                  }}
                >
                  <span>✗</span>
                  <span>{g.label}</span>
                </div>
              ))}
            </div>

            {/* Reason select */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--aura-text2)', marginBottom: '6px', fontFamily: 'var(--font-dm-mono)' }}>
                MOTIVO DO OVERRIDE
              </label>
              <select
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value as OverrideReason)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--aura-bg3)',
                  border: '1px solid var(--aura-border)',
                  borderRadius: '8px',
                  color: 'var(--aura-text)',
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {OVERRIDE_REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--aura-text2)', marginBottom: '6px', fontFamily: 'var(--font-dm-mono)' }}>
                NOTAS CLÍNICAS (opcional)
              </label>
              <textarea
                value={overrideNotes}
                onChange={e => setOverrideNotes(e.target.value)}
                rows={3}
                placeholder="Justificação clínica adicional..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--aura-bg3)',
                  border: '1px solid var(--aura-border)',
                  borderRadius: '8px',
                  color: 'var(--aura-text)',
                  fontSize: '13px',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowOverride(false)}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  border: '1px solid var(--aura-border)',
                  background: 'transparent',
                  color: 'var(--aura-text2)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => advancePhase(true)}
                disabled={isPending}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--aura-warn)',
                  color: '#000',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                Confirmar override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
