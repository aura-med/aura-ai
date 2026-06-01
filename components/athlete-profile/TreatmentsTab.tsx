'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, Pill, Wrench, Plus, Clock, Edit2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type {
  AthleteProfileData,
  MedicalHistory,
  MedicationRecord,
  OrthoticRecord,
  RehabSession,
} from '@/types/athlete-profile'
import { MedicationModal }    from './MedicationModal'
import { RehabSessionModal }  from './RehabSessionModal'
import { OrthoticModal }      from './OrthoticModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const SESSION_TYPE_LABEL: Record<string, string> = {
  physio: 'Fisioterapia',
  gym:    'Ginásio',
  pool:   'Piscina',
  field:  'Campo',
  other:  'Outro',
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, action, children,
}: {
  icon: React.ElementType
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
        <Icon size={13} style={{ color: 'var(--aura-green)' }} />
        <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--aura-text2)' }}>
          {title}
        </p>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label, cta, onClick }: { label: string; cta: string; onClick: () => void }) {
  return (
    <div className="py-6 flex flex-col items-center gap-2">
      <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>{label}</p>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed transition-colors hover:border-[var(--aura-green)] hover:text-[var(--aura-green)]"
        style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text3)' }}
      >
        <Plus size={11} />
        {cta}
      </button>
    </div>
  )
}

// ── Medication Row ────────────────────────────────────────────────────────────

function MedicationRow({ m, onEdit }: { m: MedicationRecord; onEdit: () => void }) {
  const isActive = !m.end_date || new Date(m.end_date) > new Date()
  return (
    <div className="rounded-lg border px-3 py-3 space-y-1.5" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>{m.name}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>
            {m.dosage} · {m.frequency}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{
              background: isActive ? 'var(--aura-green-bg)' : 'var(--aura-bg4)',
              color: isActive ? 'var(--aura-green)' : 'var(--aura-text3)',
            }}
          >
            {isActive ? 'Ativa' : 'Concluída'}
          </span>
          <button type="button" onClick={onEdit} className="p-1 rounded hover:bg-white/10">
            <Edit2 size={11} style={{ color: 'var(--aura-text3)' }} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--aura-text3)' }}>
        {m.start_date && (
          <span className="flex items-center gap-1">
            <Clock size={9} />
            {formatDate(m.start_date)}
            {m.end_date ? ` → ${formatDate(m.end_date)}` : ''}
          </span>
        )}
        {m.prescriber && <span>· {m.prescriber}</span>}
      </div>
    </div>
  )
}

// ── Rehab Session Row ─────────────────────────────────────────────────────────

function RehabRow({ s, onEdit }: { s: RehabSession; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold" style={{ color: 'var(--aura-text)' }}>
            {formatDate(s.session_date)}
          </p>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'var(--aura-green-bg)', color: 'var(--aura-green)' }}>
            {SESSION_TYPE_LABEL[s.session_type] ?? s.session_type}
          </span>
          {s.duration_minutes && (
            <span className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>{s.duration_minutes} min</span>
          )}
        </div>
        {s.description && (
          <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--aura-text3)' }}>{s.description}</p>
        )}
        {s.clinician_name && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>{s.clinician_name}</p>
        )}
      </div>
      <button type="button" onClick={onEdit} className="p-1 rounded hover:bg-white/10 shrink-0">
        <Edit2 size={11} style={{ color: 'var(--aura-text3)' }} />
      </button>
    </div>
  )
}

// ── Orthotic Row ──────────────────────────────────────────────────────────────

function OrthoticRow({ o, onEdit }: { o: OrthoticRecord; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg border" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: 'var(--aura-text)' }}>{o.name}</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>
          {o.body_part}
          {o.prescribed_date ? ` · ${formatDate(o.prescribed_date)}` : ''}
          {o.prescriber ? ` · ${o.prescriber}` : ''}
        </p>
        {o.notes && (
          <p className="text-[10px] mt-0.5 italic" style={{ color: 'var(--aura-text3)' }}>{o.notes}</p>
        )}
      </div>
      <button type="button" onClick={onEdit} className="p-1 rounded hover:bg-white/10 shrink-0">
        <Edit2 size={11} style={{ color: 'var(--aura-text3)' }} />
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function TreatmentsTab({ profile }: { profile: AthleteProfileData }) {
  const router = useRouter()

  // ── Local state ────────────────────────────────────────────────────────────
  const [medHistory, setMedHistory] = useState<MedicalHistory | null>(profile.medicalHistory)

  // Rehab sessions
  const [sessions,   setSessions]   = useState<RehabSession[]>([])
  const [loadingS,   setLoadingS]   = useState(true)

  // Medication modal
  const [showMedModal,    setShowMedModal]    = useState(false)
  const [editingMed,      setEditingMed]      = useState<MedicationRecord | null>(null)
  const [editingMedIdx,   setEditingMedIdx]   = useState<number | null>(null)

  // Rehab session modal
  const [showRehabModal,  setShowRehabModal]  = useState(false)
  const [editingRehab,    setEditingRehab]    = useState<RehabSession | null>(null)

  // Orthotic modal
  const [showOrthoModal,  setShowOrthoModal]  = useState(false)
  const [editingOrtho,    setEditingOrtho]    = useState<OrthoticRecord | null>(null)
  const [editingOrthoIdx, setEditingOrthoIdx] = useState<number | null>(null)

  // ── Fetch rehab sessions ───────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    setLoadingS(true)
    try {
      const res = await fetch(`/api/athletes/${profile.id}/rehab-sessions`)
      if (res.ok) setSessions(await res.json())
    } finally {
      setLoadingS(false)
    }
  }, [profile.id])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  // ── Derived ────────────────────────────────────────────────────────────────
  const medications = medHistory?.medications ?? []
  const activeMeds  = medications.filter((m) => !m.end_date || new Date(m.end_date) > new Date())
  const pastMeds    = medications.filter((m) => m.end_date && new Date(m.end_date) <= new Date())
  const orthotics   = medHistory?.orthotics ?? []

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleMedSaved(updated: MedicalHistory) {
    setMedHistory(updated)
    setShowMedModal(false)
    setEditingMed(null)
    setEditingMedIdx(null)
    router.refresh()
  }

  function handleRehabSaved(s: RehabSession) {
    setSessions((prev) => {
      const idx = prev.findIndex((x) => x.id === s.id)
      if (idx >= 0) return prev.map((x, i) => i === idx ? s : x)
      return [s, ...prev]
    })
    setShowRehabModal(false)
    setEditingRehab(null)
    router.refresh()
  }

  function handleRehabDeleted(id: string) {
    setSessions((prev) => prev.filter((x) => x.id !== id))
    setShowRehabModal(false)
    setEditingRehab(null)
    router.refresh()
  }

  function handleOrthoSaved(updated: MedicalHistory) {
    setMedHistory(updated)
    setShowOrthoModal(false)
    setEditingOrtho(null)
    setEditingOrthoIdx(null)
    router.refresh()
  }

  function openNewMed() {
    setEditingMed(null)
    setEditingMedIdx(null)
    setShowMedModal(true)
  }

  function openEditMed(m: MedicationRecord, i: number) {
    setEditingMed(m)
    setEditingMedIdx(i)
    setShowMedModal(true)
  }

  function openNewOrtho() {
    setEditingOrtho(null)
    setEditingOrthoIdx(null)
    setShowOrthoModal(true)
  }

  function openEditOrtho(o: OrthoticRecord, i: number) {
    setEditingOrtho(o)
    setEditingOrthoIdx(i)
    setShowOrthoModal(true)
  }

  return (
    <>
      <div className="space-y-4">

        {/* Physiotherapy & Rehab */}
        <Section
          icon={Activity}
          title={`Fisioterapia & Reabilitação${sessions.length > 0 ? ` (${sessions.length})` : ''}`}
          action={
            <button
              type="button"
              onClick={() => { setEditingRehab(null); setShowRehabModal(true) }}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--aura-green-bg)]"
              style={{ color: 'var(--aura-green)' }}
            >
              <Plus size={10} /> Nova
            </button>
          }
        >
          {loadingS ? (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--aura-text3)' }} />
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState
              label="Sem sessões de fisioterapia registadas"
              cta="Nova Sessão"
              onClick={() => { setEditingRehab(null); setShowRehabModal(true) }}
            />
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <RehabRow
                  key={s.id}
                  s={s}
                  onEdit={() => { setEditingRehab(s); setShowRehabModal(true) }}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Active medication */}
        <Section
          icon={Pill}
          title={`Medicação Ativa${activeMeds.length > 0 ? ` (${activeMeds.length})` : ''}`}
          action={
            <button
              type="button"
              onClick={openNewMed}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--aura-green-bg)]"
              style={{ color: 'var(--aura-green)' }}
            >
              <Plus size={10} /> Adicionar
            </button>
          }
        >
          {activeMeds.length === 0 ? (
            <EmptyState label="Sem medicação ativa" cta="Registar Medicação" onClick={openNewMed} />
          ) : (
            <div className="space-y-2">
              {activeMeds.map((m, i) => (
                <MedicationRow
                  key={i}
                  m={m}
                  onEdit={() => openEditMed(m, medications.indexOf(m))}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Past medication */}
        {pastMeds.length > 0 && (
          <Section icon={Pill} title={`Medicação Anterior (${pastMeds.length})`}>
            <div className="space-y-2">
              {pastMeds.map((m, i) => (
                <MedicationRow
                  key={i}
                  m={m}
                  onEdit={() => openEditMed(m, medications.indexOf(m))}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Orthotics */}
        <Section
          icon={Wrench}
          title={`Ortóteses & Auxiliares${orthotics.length > 0 ? ` (${orthotics.length})` : ''}`}
          action={
            <button
              type="button"
              onClick={openNewOrtho}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--aura-green-bg)]"
              style={{ color: 'var(--aura-green)' }}
            >
              <Plus size={10} /> Adicionar
            </button>
          }
        >
          {orthotics.length === 0 ? (
            <EmptyState label="Sem ortóteses ou auxiliares registados" cta="Registar" onClick={openNewOrtho} />
          ) : (
            <div className="space-y-2">
              {orthotics.map((o, i) => (
                <OrthoticRow key={i} o={o} onEdit={() => openEditOrtho(o, i)} />
              ))}
            </div>
          )}
        </Section>

      </div>

      {/* Modals */}
      {showMedModal && (
        <MedicationModal
          athleteId={profile.id}
          medHistory={medHistory}
          editing={editingMed}
          editingIndex={editingMedIdx}
          onClose={() => { setShowMedModal(false); setEditingMed(null); setEditingMedIdx(null) }}
          onSaved={handleMedSaved}
        />
      )}
      {showRehabModal && (
        <RehabSessionModal
          athleteId={profile.id}
          existing={editingRehab}
          onClose={() => { setShowRehabModal(false); setEditingRehab(null) }}
          onSaved={handleRehabSaved}
          onDeleted={handleRehabDeleted}
        />
      )}
      {showOrthoModal && (
        <OrthoticModal
          athleteId={profile.id}
          medHistory={medHistory}
          editing={editingOrtho}
          editingIndex={editingOrthoIdx}
          onClose={() => { setShowOrthoModal(false); setEditingOrtho(null); setEditingOrthoIdx(null) }}
          onSaved={handleOrthoSaved}
        />
      )}
    </>
  )
}
