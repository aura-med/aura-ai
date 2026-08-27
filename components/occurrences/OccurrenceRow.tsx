'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AthleteAvatar } from '@/components/ui/AthleteAvatar'
import { DiagnosisModal } from '@/components/athlete-profile/DiagnosisModal'
import { ChevronDown, ChevronUp, Plus, Check, Pencil, CheckCircle2, Loader2 } from 'lucide-react'
import { resolveOccurrence, addOccurrenceRecord, updateOccurrence, updateOccurrenceRecord } from '@/app/(dashboard)/occurrences/actions'
import { resolveDiagnosis } from '@/lib/actions/clinical'
import { todayStr } from '@/lib/utils/microcycle'
import { LoadManagementFields, restrictionLabels } from '@/components/shared/LoadManagementFields'
import type { AthleteAvailabilityStatus } from '@/types'

// Shared between the Ocorrências page and the athlete profile's Overview tab
// so an occurrence has exactly one editing experience — reassess, resolve,
// attach a diagnosis — regardless of where it's opened from.

export const STATUS_CONFIG: Record<AthleteAvailabilityStatus, { label: string; color: string; bg: string; dot: string }> = {
  available:       { label: 'Disponível',      color: 'var(--sophi-green)',  bg: 'rgba(0,229,160,0.1)',   dot: '#00e5a0' },
  evaluation:      { label: 'Em Avaliação',    color: 'var(--sophi-warn)',   bg: 'rgba(246,173,85,0.1)',  dot: '#f6ad55' },
  load_management: { label: 'Gestão de Carga', color: 'var(--sophi-orange)', bg: 'rgba(204,85,0,0.1)',    dot: '#cc5500' },
  unavailable:     { label: 'Indisponível',    color: 'var(--sophi-danger)', bg: 'rgba(255,77,109,0.1)',  dot: '#ff4d6d' },
  rtp:             { label: 'Em RTP',          color: 'var(--sophi-purple)', bg: 'rgba(180,141,252,0.1)', dot: '#b48dfc' },
}

export const OCCURRENCE_TYPES = [
  { value: 'complaint', label: 'Queixa' },
  { value: 'trauma', label: 'Trauma' },
  { value: 'disease', label: 'Doença' },
  { value: 'other', label: 'Outro' },
]

export interface Athlete {
  id: string
  name: string
  shirt_number: number | null
  photo_url: string | null
  position: string | null
  availability_status: AthleteAvailabilityStatus
}

export interface OccurrenceRecord {
  id: string
  record_date: string
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  availability_status: AthleteAvailabilityStatus | null
  load_management_restrictions?: string[]
  load_management_notes?: string | null
  clinician_name: string | null
  created_at: string
}

export interface OccurrenceDiagnosis {
  id: string
  osiics_code: string | null
  osiics_description: string | null
  diagnosis_type: string | null
  custom_description: string | null
  availability_status: AthleteAvailabilityStatus | null
  load_management_restrictions?: string[]
  load_management_notes?: string | null
  is_resolved: boolean
}

export interface Occurrence {
  id: string
  athlete_id: string
  title: string | null
  occurrence_date: string
  occurrence_type: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  availability_status: AthleteAvailabilityStatus
  load_management_restrictions?: string[]
  load_management_notes?: string | null
  clinician_name: string | null
  clinician_role: string | null
  is_resolved: boolean
  resolved_at: string | null
  occurrence_records: OccurrenceRecord[]
  diagnoses: OccurrenceDiagnosis[]
  athletes: Athlete
}

export function StatusBadge({ status }: { status: AthleteAvailabilityStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontFamily: 'var(--font-dm-mono)', fontWeight: 700,
      padding: '2px 8px', borderRadius: 999,
      background: cfg.bg, color: cfg.color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

export function OccurrenceRow({ occ, canCreateDiagnosis, onRevalidate }: { occ: Occurrence; canCreateDiagnosis: boolean; onRevalidate: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [showReeval, setShowReeval] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false)
  const [showEditDiagnosis, setShowEditDiagnosis] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [reevalData, setReevalData] = useState({
    observations: '',
    availability_status: occ.availability_status as AthleteAvailabilityStatus,
    // Defaults to the occurrence's own current restrictions/notes — a
    // reassessment that keeps the status as load_management (the common
    // case: logging progress without changing the decision) must not
    // silently blank out the athlete's real restrictions just because the
    // clinician didn't re-check every box.
    restrictions: occ.load_management_restrictions ?? [] as string[],
    notes: occ.load_management_notes ?? '',
  })
  const [editData, setEditData] = useState({
    title: occ.title ?? '',
    occurrenceDate: occ.occurrence_date,
    occurrenceType: (occ.occurrence_type ?? 'complaint') as 'complaint' | 'trauma' | 'disease' | 'other',
    observations: occ.assessment ?? '',
    availability_status: occ.availability_status as AthleteAvailabilityStatus,
    restrictions: occ.load_management_restrictions ?? [],
    notes: occ.load_management_notes ?? '',
  })
  const [resolvingDiagnosis, setResolvingDiagnosis] = useState(false)
  const [confirmResolveDiagnosis, setConfirmResolveDiagnosis] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [recordEditData, setRecordEditData] = useState({
    recordDate: '',
    assessment: '',
    availability_status: 'available' as AthleteAvailabilityStatus,
    restrictions: [] as string[],
    notes: '',
  })

  const a = occ.athletes
  const typeLabel = OCCURRENCE_TYPES.find((t) => t.value === occ.occurrence_type)?.label ?? occ.occurrence_type
  const activeDiagnosis = occ.diagnoses?.find((d) => !d.is_resolved)
  // What's shown first: the active diagnosis takes priority; otherwise the
  // occurrence's own (original) title — never a reassessment's note, which is
  // just a dated log entry, not a replacement headline for the issue itself.
  const primaryLabel =
    (activeDiagnosis && (activeDiagnosis.osiics_description ?? activeDiagnosis.custom_description))
    || occ.title
    || a.name

  function handleResolve() {
    startTransition(async () => {
      await resolveOccurrence(occ.id, occ.athlete_id, 'available')
      onRevalidate()
    })
  }

  function handleAddRecord() {
    startTransition(async () => {
      await addOccurrenceRecord({
        occurrenceId: occ.id,
        athleteId: occ.athlete_id,
        recordDate: todayStr(),
        subjective: '',
        objective: '',
        assessment: reevalData.observations,
        plan: '',
        availabilityStatus: reevalData.availability_status,
        loadManagementRestrictions: reevalData.restrictions,
        loadManagementNotes: reevalData.notes.trim() || null,
      })
      setShowReeval(false)
      setReevalData({
        observations: '',
        availability_status: occ.availability_status,
        restrictions: occ.load_management_restrictions ?? [],
        notes: occ.load_management_notes ?? '',
      })
      onRevalidate()
    })
  }

  function handleUpdate() {
    startTransition(async () => {
      await updateOccurrence({
        occurrenceId: occ.id,
        title: editData.title,
        occurrenceDate: editData.occurrenceDate,
        occurrenceType: editData.occurrenceType,
        observations: editData.observations,
        availabilityStatus: editData.availability_status,
        loadManagementRestrictions: editData.restrictions,
        loadManagementNotes: editData.notes.trim() || null,
      })
      setShowEdit(false)
      onRevalidate()
    })
  }

  async function handleResolveDiagnosis() {
    if (!activeDiagnosis) return
    setResolvingDiagnosis(true)
    try {
      // Author/recompute handled server-side.
      await resolveDiagnosis(activeDiagnosis.id, occ.athlete_id)
      onRevalidate()
    } finally {
      setResolvingDiagnosis(false)
      setConfirmResolveDiagnosis(false)
    }
  }

  function startEditRecord(r: OccurrenceRecord) {
    setRecordEditData({
      recordDate: r.record_date,
      assessment: r.assessment ?? '',
      availability_status: (r.availability_status ?? 'available') as AthleteAvailabilityStatus,
      restrictions: r.load_management_restrictions ?? [],
      notes: r.load_management_notes ?? '',
    })
    setEditingRecordId(r.id)
  }

  function handleUpdateRecord() {
    if (!editingRecordId) return
    startTransition(async () => {
      await updateOccurrenceRecord({
        recordId: editingRecordId,
        recordDate: recordEditData.recordDate,
        assessment: recordEditData.assessment,
        availabilityStatus: recordEditData.availability_status,
        loadManagementRestrictions: recordEditData.restrictions,
        loadManagementNotes: recordEditData.notes.trim() || null,
      })
      setEditingRecordId(null)
      onRevalidate()
    })
  }

  return (
    <div style={{
      background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)',
      borderRadius: 10, overflow: 'hidden',
      opacity: occ.is_resolved ? 0.6 : 1,
    }}>
      {/* Row header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded((e) => !e)}
      >
        <Link href={`/athletes/${occ.athlete_id}`} onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <AthleteAvatar photoUrl={a.photo_url} shirtNumber={a.shirt_number} name={a.name} size={36} />
        </Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sophi-text)' }}>
            {primaryLabel}
          </div>
          <div style={{ fontSize: 11, color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}>
            <Link href={`/athletes/${occ.athlete_id}`} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none' }}>
              {a.name}
            </Link>
            {' · '}{a.position ?? '—'} · {typeLabel} · {occ.occurrence_date}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* The athlete's own current status, not the occurrence's snapshot
              field — the latter can only change when something explicitly
              writes to this occurrence, so it drifted stale whenever a
              diagnosis or another occurrence changed the athlete's real
              state without touching this row. */}
          <StatusBadge status={a.availability_status} />
          {occ.is_resolved && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)' }}>Resolvida</span>
          )}
          {expanded ? <ChevronUp size={14} color="var(--sophi-text3)" /> : <ChevronDown size={14} color="var(--sophi-text3)" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--sophi-border)', padding: '12px 16px' }}>
          {/* SOAP */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { key: 'S', label: 'Subjetivo', value: occ.subjective },
              { key: 'O', label: 'Objetivo', value: occ.objective },
              { key: 'A', label: 'Observações', value: occ.assessment },
              { key: 'P', label: 'Plano', value: occ.plan },
            ].map(({ key, label, value }) => value && (
              <div key={key} style={{ background: 'var(--sophi-bg3)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {key === 'A' ? label : `${key} — ${label}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--sophi-text)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Restrições de Gestão de Carga */}
          {occ.availability_status === 'load_management' && (occ.load_management_restrictions?.length || occ.load_management_notes) && (
            <div style={{ marginBottom: 12, background: 'var(--sophi-orange-bg)', border: '1px solid var(--sophi-orange)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-orange)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Restrições de Gestão de Carga
              </div>
              {occ.load_management_restrictions?.length ? (
                <div style={{ fontSize: 12, color: 'var(--sophi-text)', marginBottom: occ.load_management_notes ? 4 : 0 }}>
                  {restrictionLabels(occ.load_management_restrictions)}
                </div>
              ) : null}
              {occ.load_management_notes && (
                <div style={{ fontSize: 11, color: 'var(--sophi-text2)' }}>{occ.load_management_notes}</div>
              )}
            </div>
          )}

          {/* Diagnóstico */}
          {activeDiagnosis && (
            <div style={{ marginBottom: 12, background: 'var(--sophi-bg3)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Diagnóstico
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--sophi-text)', flex: 1 }}>
                  {activeDiagnosis.osiics_description ?? activeDiagnosis.custom_description ?? '—'}
                </span>
                {activeDiagnosis.availability_status && <StatusBadge status={activeDiagnosis.availability_status} />}
                {canCreateDiagnosis && !confirmResolveDiagnosis && (
                  <button
                    onClick={() => setShowEditDiagnosis(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-text2)', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <Pencil size={9} />
                    Editar
                  </button>
                )}
                {canCreateDiagnosis && !confirmResolveDiagnosis && (
                  <button
                    onClick={() => setConfirmResolveDiagnosis(true)}
                    disabled={resolvingDiagnosis}
                    style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '3px 7px', borderRadius: 6, border: '1px solid rgba(0,229,160,0.3)', background: 'rgba(0,229,160,0.06)', color: 'var(--sophi-green)', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <CheckCircle2 size={9} />
                    Resolver diagnóstico
                  </button>
                )}
              </div>
              {activeDiagnosis.availability_status === 'load_management' && (activeDiagnosis.load_management_restrictions?.length || activeDiagnosis.load_management_notes) && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--sophi-orange)' }}>
                  {restrictionLabels(activeDiagnosis.load_management_restrictions)}
                  {activeDiagnosis.load_management_notes ? ` — ${activeDiagnosis.load_management_notes}` : ''}
                </div>
              )}
              {confirmResolveDiagnosis && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, borderRadius: 6, border: '1px solid var(--sophi-green)', background: 'var(--sophi-green-bg)', padding: '6px 8px' }}>
                  <p style={{ fontSize: 10, flex: 1, color: 'var(--sophi-text2)' }}>
                    Confirma que este diagnóstico fica resolvido?
                  </p>
                  <button
                    onClick={() => setConfirmResolveDiagnosis(false)}
                    disabled={resolvingDiagnosis}
                    style={{ fontSize: 10, color: 'var(--sophi-text3)', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleResolveDiagnosis}
                    disabled={resolvingDiagnosis}
                    style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--sophi-green)', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                  >
                    {resolvingDiagnosis ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                    Confirmar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Re-evaluations */}
          {occ.occurrence_records.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Reavaliações ({occ.occurrence_records.length})
              </div>
              {occ.occurrence_records.map((r) => (
                editingRecordId === r.id ? (
                  <div key={r.id} style={{ background: 'var(--sophi-bg3)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                      <div>
                        <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>
                          Data
                        </label>
                        <input
                          type="date"
                          value={recordEditData.recordDate}
                          onChange={(e) => setRecordEditData((d) => ({ ...d, recordDate: e.target.value }))}
                          style={{ width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12, background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)', color: 'var(--sophi-text)', fontFamily: 'inherit' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>
                          Estado de disponibilidade
                        </label>
                        <select
                          value={recordEditData.availability_status}
                          onChange={(e) => setRecordEditData((d) => ({ ...d, availability_status: e.target.value as AthleteAvailabilityStatus }))}
                          style={{ width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12, background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)', color: 'var(--sophi-text)', fontFamily: 'inherit' }}
                        >
                          {Object.entries(STATUS_CONFIG).map(([v, cfg]) => (
                            <option key={v} value={v}>{cfg.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {recordEditData.availability_status === 'load_management' && (
                      <LoadManagementFields
                        restrictions={recordEditData.restrictions}
                        onRestrictionsChange={(next) => setRecordEditData((d) => ({ ...d, restrictions: next }))}
                        notes={recordEditData.notes}
                        onNotesChange={(next) => setRecordEditData((d) => ({ ...d, notes: next }))}
                      />
                    )}
                    <div style={{ marginBottom: 6 }}>
                      <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>
                        Observações
                      </label>
                      <textarea
                        value={recordEditData.assessment}
                        onChange={(e) => setRecordEditData((d) => ({ ...d, assessment: e.target.value }))}
                        rows={3}
                        style={{ width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12, background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)', color: 'var(--sophi-text)', resize: 'vertical', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={handleUpdateRecord}
                        disabled={isPending}
                        style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--sophi-green)', color: '#000', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {isPending ? 'A guardar...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => setEditingRecordId(null)}
                        style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-text2)', cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--sophi-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)', flexShrink: 0 }}>{r.record_date}</span>
                      <span style={{ fontSize: 11, color: 'var(--sophi-text2)', flex: 1 }}>{r.assessment ?? r.subjective ?? '—'}</span>
                      {r.availability_status && <StatusBadge status={r.availability_status} />}
                      <span style={{ fontSize: 10, color: 'var(--sophi-text3)' }}>{r.clinician_name}</span>
                      <button
                        onClick={() => startEditRecord(r)}
                        style={{ display: 'flex', alignItems: 'center', padding: 3, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--sophi-text3)', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <Pencil size={11} />
                      </button>
                    </div>
                    {r.availability_status === 'load_management' && (r.load_management_restrictions?.length || r.load_management_notes) && (
                      <div style={{ fontSize: 10, color: 'var(--sophi-orange)', marginTop: 2 }}>
                        {restrictionLabels(r.load_management_restrictions)}
                        {r.load_management_notes ? ` — ${r.load_management_notes}` : ''}
                      </div>
                    )}
                  </div>
                )
              ))}
            </div>
          )}

          {/* Re-evaluation form */}
          {showReeval && !occ.is_resolved && (
            <div style={{ background: 'var(--sophi-bg3)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sophi-text2)', marginBottom: 8 }}>Nova Reavaliação</div>
              <div style={{ marginBottom: 6 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>
                  Observações
                </label>
                <textarea
                  value={reevalData.observations}
                  onChange={(e) => setReevalData((d) => ({ ...d, observations: e.target.value }))}
                  rows={3}
                  style={{
                    width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12,
                    background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)',
                    color: 'var(--sophi-text)', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>
                  Estado de disponibilidade
                </label>
                <select
                  value={reevalData.availability_status}
                  onChange={(e) => setReevalData((d) => ({ ...d, availability_status: e.target.value as AthleteAvailabilityStatus }))}
                  style={{
                    borderRadius: 6, padding: '6px 8px', fontSize: 12,
                    background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)',
                    color: 'var(--sophi-text)', fontFamily: 'inherit',
                  }}
                >
                  {Object.entries(STATUS_CONFIG).map(([v, cfg]) => (
                    <option key={v} value={v}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              {reevalData.availability_status === 'load_management' && (
                <LoadManagementFields
                  restrictions={reevalData.restrictions}
                  onRestrictionsChange={(next) => setReevalData((d) => ({ ...d, restrictions: next }))}
                  notes={reevalData.notes}
                  onNotesChange={(next) => setReevalData((d) => ({ ...d, notes: next }))}
                />
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleAddRecord}
                  disabled={isPending}
                  style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--sophi-green)', color: '#000', fontWeight: 700, cursor: 'pointer' }}
                >
                  {isPending ? 'A guardar...' : 'Guardar'}
                </button>
                <button
                  onClick={() => setShowReeval(false)}
                  style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-text2)', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Edit form — corrects the occurrence's own record, unlike
              Reavaliar which appends a new dated entry. */}
          {showEdit && (
            <div style={{ background: 'var(--sophi-bg3)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sophi-text2)', marginBottom: 8 }}>Editar Ocorrência</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>
                    Data
                  </label>
                  <input
                    type="date"
                    value={editData.occurrenceDate}
                    onChange={(e) => setEditData((d) => ({ ...d, occurrenceDate: e.target.value }))}
                    style={{
                      width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12,
                      background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)',
                      color: 'var(--sophi-text)', fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>
                    Tipo
                  </label>
                  <select
                    value={editData.occurrenceType}
                    onChange={(e) => setEditData((d) => ({ ...d, occurrenceType: e.target.value as typeof editData.occurrenceType }))}
                    style={{
                      width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12,
                      background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)',
                      color: 'var(--sophi-text)', fontFamily: 'inherit',
                    }}
                  >
                    {OCCURRENCE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>
                  Título
                </label>
                <input
                  value={editData.title}
                  onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))}
                  placeholder="ex: Dor no gémeo direito"
                  style={{
                    width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12,
                    background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)',
                    color: 'var(--sophi-text)', fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ marginBottom: 6 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>
                  Observações
                </label>
                <textarea
                  value={editData.observations}
                  onChange={(e) => setEditData((d) => ({ ...d, observations: e.target.value }))}
                  rows={3}
                  style={{
                    width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12,
                    background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)',
                    color: 'var(--sophi-text)', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>
                  Estado de disponibilidade
                </label>
                <select
                  value={editData.availability_status}
                  onChange={(e) => setEditData((d) => ({ ...d, availability_status: e.target.value as AthleteAvailabilityStatus }))}
                  style={{
                    borderRadius: 6, padding: '6px 8px', fontSize: 12,
                    background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)',
                    color: 'var(--sophi-text)', fontFamily: 'inherit',
                  }}
                >
                  {Object.entries(STATUS_CONFIG).map(([v, cfg]) => (
                    <option key={v} value={v}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              {editData.availability_status === 'load_management' && (
                <LoadManagementFields
                  restrictions={editData.restrictions}
                  onRestrictionsChange={(next) => setEditData((d) => ({ ...d, restrictions: next }))}
                  notes={editData.notes}
                  onNotesChange={(next) => setEditData((d) => ({ ...d, notes: next }))}
                />
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleUpdate}
                  disabled={isPending}
                  style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--sophi-green)', color: '#000', fontWeight: 700, cursor: 'pointer' }}
                >
                  {isPending ? 'A guardar...' : 'Guardar'}
                </button>
                <button
                  onClick={() => setShowEdit(false)}
                  style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-text2)', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <button
              onClick={() => { setShowEdit((v) => !v); setShowReeval(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-text2)', cursor: 'pointer' }}
            >
              <Pencil size={11} />
              Editar
            </button>
            {!occ.is_resolved && (
              <>
                <button
                  onClick={() => {
                    // Re-seed from the occurrence's current data every time
                    // the form is opened, not just at first mount — this row
                    // can stay mounted (e.g. via router.refresh() after some
                    // other action changed this same occurrence) for a while
                    // before "Reavaliar" gets clicked.
                    setReevalData((d) => (showReeval ? d : {
                      observations: '',
                      availability_status: occ.availability_status as AthleteAvailabilityStatus,
                      restrictions: occ.load_management_restrictions ?? [],
                      notes: occ.load_management_notes ?? '',
                    }))
                    setShowReeval((v) => !v)
                    setShowEdit(false)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-text2)', cursor: 'pointer' }}
                >
                  <Plus size={11} />
                  Reavaliar
                </button>
                <button
                  onClick={handleResolve}
                  disabled={isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(0,229,160,0.3)', background: 'rgba(0,229,160,0.06)', color: 'var(--sophi-green)', cursor: 'pointer' }}
                >
                  <Check size={11} />
                  Resolver
                </button>
                {canCreateDiagnosis && !activeDiagnosis && (
                  <button
                    onClick={() => setShowDiagnosisModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-text2)', cursor: 'pointer' }}
                  >
                    <Plus size={11} />
                    Adicionar Diagnóstico
                  </button>
                )}
              </>
            )}
          </div>

          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}>
            Registado por {occ.clinician_name ?? '—'} {occ.clinician_role ? `· ${occ.clinician_role}` : ''}
          </div>
        </div>
      )}

      {showDiagnosisModal && (
        <DiagnosisModal
          athleteId={occ.athlete_id}
          occurrences={[occ]}
          onClose={() => setShowDiagnosisModal(false)}
          onSaved={() => { setShowDiagnosisModal(false); onRevalidate() }}
        />
      )}

      {showEditDiagnosis && activeDiagnosis && (
        <DiagnosisModal
          athleteId={occ.athlete_id}
          occurrences={[occ]}
          existing={{
            id:                  activeDiagnosis.id,
            osiics_code:         activeDiagnosis.osiics_code,
            osiics_description:  activeDiagnosis.osiics_description,
            diagnosis_type:      activeDiagnosis.diagnosis_type,
            custom_description:  activeDiagnosis.custom_description,
            availability_status: activeDiagnosis.availability_status,
            load_management_restrictions: activeDiagnosis.load_management_restrictions,
            load_management_notes: activeDiagnosis.load_management_notes,
            occurrence_id:       occ.id,
          }}
          onClose={() => setShowEditDiagnosis(false)}
          onSaved={() => { setShowEditDiagnosis(false); onRevalidate() }}
        />
      )}
    </div>
  )
}
