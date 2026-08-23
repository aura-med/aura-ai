'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AthleteAvatar } from '@/components/ui/AthleteAvatar'
import { DiagnosisModal } from '@/components/athlete-profile/DiagnosisModal'
import { ChevronDown, ChevronUp, Plus, Check } from 'lucide-react'
import { resolveOccurrence, addOccurrenceRecord } from '@/app/(dashboard)/occurrences/actions'
import { todayStr } from '@/lib/utils/microcycle'
import type { AthleteAvailabilityStatus } from '@/types'

// Shared between the Ocorrências page and the athlete profile's Overview tab
// so an occurrence has exactly one editing experience — reassess, resolve,
// attach a diagnosis — regardless of where it's opened from.

export const STATUS_CONFIG: Record<AthleteAvailabilityStatus, { label: string; color: string; bg: string; dot: string }> = {
  available:   { label: 'Disponível',   color: 'var(--sophi-green)',  bg: 'rgba(0,229,160,0.1)',   dot: '#00e5a0' },
  evaluation:  { label: 'Em Avaliação', color: 'var(--sophi-warn)',   bg: 'rgba(246,173,85,0.1)',  dot: '#f6ad55' },
  unavailable: { label: 'Indisponível', color: 'var(--sophi-danger)', bg: 'rgba(255,77,109,0.1)',  dot: '#ff4d6d' },
  rtp:         { label: 'Em RTP',       color: 'var(--sophi-purple)', bg: 'rgba(180,141,252,0.1)', dot: '#b48dfc' },
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
  clinician_name: string | null
  created_at: string
}

export interface OccurrenceDiagnosis {
  id: string
  osiics_description: string | null
  custom_description: string | null
  availability_status: AthleteAvailabilityStatus | null
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
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [reevalData, setReevalData] = useState({
    observations: '',
    availability_status: occ.availability_status as AthleteAvailabilityStatus,
  })

  const a = occ.athletes
  const typeLabel = OCCURRENCE_TYPES.find((t) => t.value === occ.occurrence_type)?.label ?? occ.occurrence_type
  const activeDiagnosis = occ.diagnoses?.find((d) => !d.is_resolved)
  // What's shown first: the active diagnosis takes priority; otherwise the
  // most recent reassessment's note; otherwise the occurrence's own title.
  const latestRecord = occ.occurrence_records.length
    ? [...occ.occurrence_records].sort((x, y) => y.created_at.localeCompare(x.created_at))[0]
    : null
  const primaryLabel =
    (activeDiagnosis && (activeDiagnosis.osiics_description ?? activeDiagnosis.custom_description))
    || latestRecord?.assessment
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
      })
      setShowReeval(false)
      setReevalData({ observations: '', availability_status: occ.availability_status })
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
              </div>
            </div>
          )}

          {/* Re-evaluations */}
          {occ.occurrence_records.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Reavaliações ({occ.occurrence_records.length})
              </div>
              {occ.occurrence_records.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--sophi-border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)', flexShrink: 0 }}>{r.record_date}</span>
                  <span style={{ fontSize: 11, color: 'var(--sophi-text2)', flex: 1 }}>{r.assessment ?? r.subjective ?? '—'}</span>
                  {r.availability_status && <StatusBadge status={r.availability_status} />}
                  <span style={{ fontSize: 10, color: 'var(--sophi-text3)' }}>{r.clinician_name}</span>
                </div>
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

          {/* Actions */}
          {!occ.is_resolved && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                onClick={() => setShowReeval((v) => !v)}
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
            </div>
          )}

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
    </div>
  )
}
