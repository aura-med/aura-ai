'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { registerOccurrence } from './actions'
import { calculateMDStatus, todayStr, type MicrocycleStatus } from '@/lib/utils/microcycle'
import { exportOccurrencesPDF } from '@/lib/utils/pdf-export'
import { useUiStore } from '@/stores/uiStore'
import { Download } from 'lucide-react'
import type { AthleteAvailabilityStatus } from '@/types'
import {
  STATUS_CONFIG, OCCURRENCE_TYPES, OccurrenceRow,
  type Athlete, type Occurrence,
} from '@/components/occurrences/OccurrenceRow'

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
        occurrenceType: o.occurrence_type ?? 'other',
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
