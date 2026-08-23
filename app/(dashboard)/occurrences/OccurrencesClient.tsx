'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AthleteAvatar } from '@/components/ui/AthleteAvatar'
import { DiagnosisModal } from '@/components/athlete-profile/DiagnosisModal'
import { ChevronDown, ChevronUp, Plus, X, Check } from 'lucide-react'
import { registerOccurrence, resolveOccurrence, addOccurrenceRecord } from './actions'
import { calculateMDStatus, todayStr, type MicrocycleStatus } from '@/lib/utils/microcycle'
import { exportOccurrencesPDF } from '@/lib/utils/pdf-export'
import { useUiStore } from '@/stores/uiStore'
import { Download } from 'lucide-react'
import type { AthleteAvailabilityStatus } from '@/types'

const STATUS_CONFIG: Record<AthleteAvailabilityStatus, { label: string; color: string; bg: string; dot: string }> = {
  available:   { label: 'Disponível',   color: 'var(--sophi-green)',  bg: 'rgba(0,229,160,0.1)',   dot: '#00e5a0' },
  evaluation:  { label: 'Em Avaliação', color: 'var(--sophi-warn)',   bg: 'rgba(246,173,85,0.1)',  dot: '#f6ad55' },
  unavailable: { label: 'Indisponível', color: 'var(--sophi-danger)', bg: 'rgba(255,77,109,0.1)',  dot: '#ff4d6d' },
  rtp:         { label: 'Em RTP',       color: 'var(--sophi-purple)', bg: 'rgba(180,141,252,0.1)', dot: '#b48dfc' },
}

interface Athlete {
  id: string
  name: string
  shirt_number: number | null
  photo_url: string | null
  position: string | null
}

interface OccurrenceRecord {
  id: string
  record_date: string
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  availability_status: AthleteAvailabilityStatus | null
  clinician_name: string | null
}

interface OccurrenceDiagnosis {
  id: string
  osiics_description: string | null
  custom_description: string | null
  availability_status: AthleteAvailabilityStatus | null
  is_resolved: boolean
}

interface Occurrence {
  id: string
  athlete_id: string
  title: string | null
  occurrence_date: string
  occurrence_type: string
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

interface OccurrencesClientProps {
  occurrences: Occurrence[]
  athletes: Athlete[]
  orgId: string
  squadId: string | null
  microcycle: MicrocycleStatus
  matchDays: string[]
  currentDate: string
  clinicianName: string
  clinicianRole: string
}

const OCCURRENCE_TYPES = [
  { value: 'complaint', label: 'Queixa' },
  { value: 'trauma', label: 'Trauma' },
  { value: 'disease', label: 'Doença' },
  { value: 'other', label: 'Outro' },
]

function StatusBadge({ status }: { status: AthleteAvailabilityStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 15, fontFamily: 'var(--font-dm-mono)', fontWeight: 700,
      padding: '3px 12px', borderRadius: 999,
      background: cfg.bg, color: cfg.color,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

function OccurrenceRow({ occ, canCreateDiagnosis, onRevalidate }: { occ: Occurrence; canCreateDiagnosis: boolean; onRevalidate: () => void }) {
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
      borderRadius: 15, overflow: 'hidden',
      opacity: occ.is_resolved ? 0.6 : 1,
    }}>
      {/* Row header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '18px 24px', cursor: 'pointer' }}
        onClick={() => setExpanded((e) => !e)}
      >
        <AthleteAvatar photoUrl={a.photo_url} shirtNumber={a.shirt_number} name={a.name} size={54} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--sophi-text)' }}>
            {occ.title || a.name}
          </div>
          <div style={{ fontSize: 17, color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}>
            {occ.title ? `${a.name} · ` : ''}{a.position ?? '—'} · {typeLabel} · {occ.occurrence_date}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <StatusBadge status={occ.availability_status} />
          {occ.is_resolved && (
            <span style={{ fontSize: 15, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)' }}>Resolvida</span>
          )}
          {expanded ? <ChevronUp size={21} color="var(--sophi-text3)" /> : <ChevronDown size={21} color="var(--sophi-text3)" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--sophi-border)', padding: '18px 24px' }}>
          {/* SOAP */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
            {[
              { key: 'S', label: 'Subjetivo', value: occ.subjective },
              { key: 'O', label: 'Objetivo', value: occ.objective },
              { key: 'A', label: 'Observações', value: occ.assessment },
              { key: 'P', label: 'Plano', value: occ.plan },
            ].map(({ key, label, value }) => value && (
              <div key={key} style={{ background: 'var(--sophi-bg3)', borderRadius: 9, padding: '12px 15px' }}>
                <div style={{ fontSize: 14, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {key === 'A' ? label : `${key} — ${label}`}
                </div>
                <div style={{ fontSize: 18, color: 'var(--sophi-text)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Diagnóstico */}
          {activeDiagnosis && (
            <div style={{ marginBottom: 18, background: 'var(--sophi-bg3)', borderRadius: 9, padding: '12px 15px' }}>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Diagnóstico
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18, color: 'var(--sophi-text)', flex: 1 }}>
                  {activeDiagnosis.osiics_description ?? activeDiagnosis.custom_description ?? '—'}
                </span>
                {activeDiagnosis.availability_status && <StatusBadge status={activeDiagnosis.availability_status} />}
              </div>
            </div>
          )}

          {/* Re-evaluations */}
          {occ.occurrence_records.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', marginBottom: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Reavaliações ({occ.occurrence_records.length})
              </div>
              {occ.occurrence_records.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--sophi-border)' }}>
                  <span style={{ fontSize: 17, color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)', flexShrink: 0 }}>{r.record_date}</span>
                  <span style={{ fontSize: 17, color: 'var(--sophi-text2)', flex: 1 }}>{r.assessment ?? r.subjective ?? '—'}</span>
                  {r.availability_status && <StatusBadge status={r.availability_status} />}
                  <span style={{ fontSize: 15, color: 'var(--sophi-text3)' }}>{r.clinician_name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Re-evaluation form */}
          {showReeval && !occ.is_resolved && (
            <div style={{ background: 'var(--sophi-bg3)', borderRadius: 12, padding: 18, marginBottom: 15 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--sophi-text2)', marginBottom: 12 }}>Nova Reavaliação</div>
              <div style={{ marginBottom: 9 }}>
                <label style={{ fontSize: 15, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>
                  Observações
                </label>
                <textarea
                  value={reevalData.observations}
                  onChange={(e) => setReevalData((d) => ({ ...d, observations: e.target.value }))}
                  rows={4}
                  style={{
                    width: '100%', borderRadius: 9, padding: '9px 12px', fontSize: 18,
                    background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)',
                    color: 'var(--sophi-text)', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 15, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>
                  Estado de disponibilidade
                </label>
                <select
                  value={reevalData.availability_status}
                  onChange={(e) => setReevalData((d) => ({ ...d, availability_status: e.target.value as AthleteAvailabilityStatus }))}
                  style={{
                    borderRadius: 9, padding: '9px 12px', fontSize: 18,
                    background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)',
                    color: 'var(--sophi-text)', fontFamily: 'inherit',
                  }}
                >
                  {Object.entries(STATUS_CONFIG).map(([v, cfg]) => (
                    <option key={v} value={v}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 9 }}>
                <button
                  onClick={handleAddRecord}
                  disabled={isPending}
                  style={{ fontSize: 17, padding: '8px 18px', borderRadius: 9, border: 'none', background: 'var(--sophi-green)', color: '#000', fontWeight: 700, cursor: 'pointer' }}
                >
                  {isPending ? 'A guardar...' : 'Guardar'}
                </button>
                <button
                  onClick={() => setShowReeval(false)}
                  style={{ fontSize: 17, padding: '8px 18px', borderRadius: 9, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-text2)', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!occ.is_resolved && (
            <div style={{ display: 'flex', gap: 9, marginTop: 6 }}>
              <button
                onClick={() => setShowReeval((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 17, padding: '8px 15px', borderRadius: 9, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-text2)', cursor: 'pointer' }}
              >
                <Plus size={17} />
                Reavaliar
              </button>
              <button
                onClick={handleResolve}
                disabled={isPending}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 17, padding: '8px 15px', borderRadius: 9, border: '1px solid rgba(0,229,160,0.3)', background: 'rgba(0,229,160,0.06)', color: 'var(--sophi-green)', cursor: 'pointer' }}
              >
                <Check size={17} />
                Resolver
              </button>
              {canCreateDiagnosis && !activeDiagnosis && (
                <button
                  onClick={() => setShowDiagnosisModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 17, padding: '8px 15px', borderRadius: 9, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-text2)', cursor: 'pointer' }}
                >
                  <Plus size={17} />
                  Adicionar Diagnóstico
                </button>
              )}
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 15, color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}>
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

function RegisterModal({
  athletes,
  orgId,
  squadId,
  matchDays,
  clinicianName,
  clinicianRole,
  onClose,
}: {
  athletes: Athlete[]
  orgId: string
  squadId: string | null
  matchDays: string[]
  clinicianName: string
  clinicianRole: string
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    athleteId: athletes[0]?.id ?? '',
    title: '',
    occurrenceDate: todayStr(),
    occurrenceType: 'complaint' as 'complaint' | 'trauma' | 'disease' | 'other',
    observations: '',
    availabilityStatus: 'evaluation' as AthleteAvailabilityStatus,
  })
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    if (!form.title.trim()) { setError('Título obrigatório'); return }
    setError(null)
    startTransition(async () => {
      // Derive the microcycle from the chosen occurrence date, not the page's
      // today value, so back/future-dated occurrences classify correctly.
      const microcycleNumber = calculateMDStatus(form.occurrenceDate, matchDays).microcycleNumber
      await registerOccurrence({
        athleteId: form.athleteId,
        orgId,
        squadId,
        microcycleNumber,
        title: form.title.trim(),
        occurrenceDate: form.occurrenceDate,
        occurrenceType: form.occurrenceType,
        subjective: '',
        objective: '',
        assessment: form.observations,
        plan: '',
        availabilityStatus: form.availabilityStatus,
        clinicianName,
        clinicianRole,
      })
      onClose()
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)',
        borderRadius: 14, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}>
            Registar Ocorrência
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sophi-text3)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {/* Athlete selector */}
          <div>
            <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
              Atleta
            </label>
            <select
              value={form.athleteId}
              onChange={(e) => setForm((f) => ({ ...f, athleteId: e.target.value }))}
              style={{ width: '100%', borderRadius: 6, padding: '7px 10px', fontSize: 12, background: 'var(--sophi-bg3)', border: '1px solid var(--sophi-border)', color: 'var(--sophi-text)' }}
            >
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.shirt_number != null ? `${a.shirt_number}. ` : ''}{a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
              Data
            </label>
            <input
              type="date"
              value={form.occurrenceDate}
              onChange={(e) => setForm((f) => ({ ...f, occurrenceDate: e.target.value }))}
              style={{ width: '100%', borderRadius: 6, padding: '7px 10px', fontSize: 12, background: 'var(--sophi-bg3)', border: '1px solid var(--sophi-border)', color: 'var(--sophi-text)' }}
            />
          </div>

          {/* Type */}
          <div>
            <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
              Tipo
            </label>
            <select
              value={form.occurrenceType}
              onChange={(e) => setForm((f) => ({ ...f, occurrenceType: e.target.value as typeof form.occurrenceType }))}
              style={{ width: '100%', borderRadius: 6, padding: '7px 10px', fontSize: 12, background: 'var(--sophi-bg3)', border: '1px solid var(--sophi-border)', color: 'var(--sophi-text)' }}
            >
              {OCCURRENCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Availability status */}
          <div>
            <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
              Estado de disponibilidade
            </label>
            <select
              value={form.availabilityStatus}
              onChange={(e) => setForm((f) => ({ ...f, availabilityStatus: e.target.value as AthleteAvailabilityStatus }))}
              style={{ width: '100%', borderRadius: 6, padding: '7px 10px', fontSize: 12, background: 'var(--sophi-bg3)', border: '1px solid var(--sophi-border)', color: 'var(--sophi-text)' }}
            >
              {/* RTP não é um estado que se regista aqui — é atribuído pelo protocolo de reabilitação */}
              {Object.entries(STATUS_CONFIG)
                .filter(([v]) => v !== 'rtp')
                .map(([v, cfg]) => (
                  <option key={v} value={v}>{cfg.label}</option>
                ))}
            </select>
          </div>
        </div>

        {/* Título */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
            Título
          </label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="ex: Dor no gémeo direito"
            style={{
              width: '100%', borderRadius: 6, padding: '7px 10px', fontSize: 12,
              background: 'var(--sophi-bg3)', border: '1px solid var(--sophi-border)',
              color: 'var(--sophi-text)', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Observações */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
            Observações
          </label>
          <textarea
            value={form.observations}
            onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
            placeholder="Queixa, exame físico, impressão clínica, plano..."
            rows={4}
            style={{
              width: '100%', borderRadius: 6, padding: '7px 10px', fontSize: 12,
              background: 'var(--sophi-bg3)', border: '1px solid var(--sophi-border)',
              color: 'var(--sophi-text)', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
        </div>

        {error && <p style={{ fontSize: 11, color: 'var(--sophi-danger)', marginBottom: 8 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{ fontSize: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-text2)', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !form.athleteId}
            style={{ fontSize: 12, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--sophi-green)', color: '#000', fontWeight: 700, cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}
          >
            {isPending ? 'A registar...' : 'Registar Ocorrência'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function OccurrencesClient({
  occurrences,
  athletes,
  orgId,
  squadId,
  microcycle,
  matchDays,
  currentDate,
  clinicianName,
  clinicianRole,
}: OccurrencesClientProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active')
  const [showRegister, setShowRegister] = useState(false)
  const router = useRouter()
  const squads = useUiStore((s) => s.squads)
  const squadName = squads.find((s) => s.id === squadId)?.name

  function refresh() { router.refresh() }

  const filtered = occurrences.filter((o) => {
    if (filter === 'active') return !o.is_resolved
    if (filter === 'resolved') return o.is_resolved
    return true
  })

  function handleExport() {
    exportOccurrencesPDF(
      filtered.map((o) => ({
        athleteName: o.athletes?.name ?? '—',
        position: o.athletes?.position ?? null,
        occurrenceType: o.occurrence_type,
        occurrenceDate: o.occurrence_date,
        availabilityStatus: o.availability_status,
        clinicianName: o.clinician_name,
        isResolved: o.is_resolved,
      })),
      { squadName, microcycleLabel: microcycle.microcycleNumber != null ? `MC ${microcycle.microcycleNumber} · ${microcycle.label}` : undefined, currentDate },
    )
  }

  const activeCount = occurrences.filter((o) => !o.is_resolved).length
  const canCreateDiagnosis = clinicianRole === 'doctor' || clinicianRole === 'owner'

  return (
    <div>
      {/* Header */}
      <div className="sec-hdr">
        <div>
          <div className="sec-title">Ocorrências</div>
          <div className="sec-sub">
            {microcycle.microcycleNumber != null
              ? `MC ${microcycle.microcycleNumber} · ${microcycle.label} · ${currentDate}`
              : currentDate}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              background: 'transparent', border: '1px solid var(--sophi-border)',
              color: 'var(--sophi-text2)', fontWeight: 600, fontSize: 12,
              cursor: filtered.length === 0 ? 'default' : 'pointer',
              opacity: filtered.length === 0 ? 0.5 : 1,
            }}
          >
            <Download size={13} />
            Exportar PDF
          </button>
          <button
            onClick={() => setShowRegister(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: 'var(--sophi-green)', border: 'none',
              color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}
          >
            <Plus size={13} />
            Registar Ocorrência
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {([['all', 'Todas'], ['active', `Ativas (${activeCount})`], ['resolved', 'Resolvidas']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            style={{
              fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
              fontFamily: 'var(--font-dm-mono)',
              background: filter === v ? 'var(--sophi-green)' : 'var(--sophi-bg3)',
              border: filter === v ? 'none' : '1px solid var(--sophi-border)',
              color: filter === v ? '#000' : 'var(--sophi-text2)',
              fontWeight: filter === v ? 700 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Occurrences list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)', fontSize: 12 }}>
            {filter === 'active' ? 'Sem ocorrências ativas' : filter === 'resolved' ? 'Sem ocorrências resolvidas' : 'Sem ocorrências registadas'}
          </div>
        ) : (
          filtered.map((occ) => (
            <OccurrenceRow key={occ.id} occ={occ} canCreateDiagnosis={canCreateDiagnosis} onRevalidate={refresh} />
          ))
        )}
      </div>

      {/* Register modal */}
      {showRegister && (
        <RegisterModal
          athletes={athletes}
          orgId={orgId}
          squadId={squadId}
          matchDays={matchDays}
          clinicianName={clinicianName}
          clinicianRole={clinicianRole}
          onClose={() => { setShowRegister(false); refresh() }}
        />
      )}
    </div>
  )
}
