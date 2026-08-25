'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Activity, Plus, Clock, Edit2, Loader2, Syringe, CalendarClock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { administerMedication } from '@/lib/actions/clinical'
import { OWNER_ROLE, CLINICAL_ROLES, REHAB_ROLES } from '@/lib/roles'
import type {
  AthleteProfileData,
  RehabSession,
  MedicationAdministration,
} from '@/types/athlete-profile'

const RehabSessionModal = dynamic(() => import('./RehabSessionModal').then((mod) => mod.RehabSessionModal))
const RehabPlanSection = dynamic(() => import('./RehabPlanSection').then((mod) => mod.RehabPlanSection))

// ── Helpers ───────────────────────────────────────────────────────────────────

// Local-time default — UTC (toISOString) shifts the clinician's day/time by
// their timezone offset, which corrupts the medication administration log.
function localDateTimeValue(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const SESSION_TYPE_LABEL: Record<string, string> = {
  physio:  'Fisioterapia',
  gym:     'Ginásio',
  massage: 'Massagem',
  field:   'Campo',
  other:   'Outro',
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
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
        <Icon size={13} style={{ color: 'var(--sophi-green)' }} />
        <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text2)' }}>
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
      <p className="text-xs" style={{ color: 'var(--sophi-text3)' }}>{label}</p>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed transition-colors hover:border-[var(--sophi-green)] hover:text-[var(--sophi-green)]"
        style={{ borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text3)' }}
      >
        <Plus size={11} />
        {cta}
      </button>
    </div>
  )
}

// ── Rehab Session Row ─────────────────────────────────────────────────────────

function RehabRow({ s, occurrenceLabel, onEdit }: { s: RehabSession; occurrenceLabel?: string | null; onEdit?: () => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold" style={{ color: 'var(--sophi-text)' }}>
            {formatDate(s.session_date)}
          </p>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'var(--sophi-green-bg)', color: 'var(--sophi-green)' }}>
            {SESSION_TYPE_LABEL[s.session_type] ?? s.session_type}
          </span>
          {s.duration_minutes && (
            <span className="text-[10px]" style={{ color: 'var(--sophi-text3)' }}>{s.duration_minutes} min</span>
          )}
        </div>
        {s.description && (
          <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--sophi-text3)' }}>{s.description}</p>
        )}
        {occurrenceLabel && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--sophi-purple)' }}>↳ {occurrenceLabel}</p>
        )}
        {s.clinician_name && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--sophi-text3)' }}>{s.clinician_name}</p>
        )}
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} className="p-1 rounded hover:bg-white/10 shrink-0">
          <Edit2 size={11} style={{ color: 'var(--sophi-text3)' }} />
        </button>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Medication Administration Modal ──────────────────────────────────────────

const ROUTE_OPTIONS = [
  { value: 'oral',           label: 'Oral' },
  { value: 'im',             label: 'IM (intramuscular)' },
  { value: 'intra-articular', label: 'Intra-articular' },
  { value: 'iv',             label: 'IV (intravenoso)' },
  { value: 'topical',        label: 'Tópico' },
  { value: 'other',          label: 'Outro' },
]

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function MedAdminModal({
  athleteId,
  onClose,
  onSaved,
}: {
  athleteId: string
  onClose: () => void
  onSaved: (record: MedicationAdministration) => void
}) {
  const [medName,        setMedName]        = useState('')
  const [dose,           setDose]           = useState('')
  const [route,          setRoute]          = useState('oral')
  const [notes,          setNotes]          = useState('')
  const [administeredAt, setAdministeredAt] = useState(localDateTimeValue)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  async function handleSave() {
    if (!medName.trim()) { setError('Nome do medicamento obrigatório'); return }
    setSaving(true)
    setError(null)
    try {
      // Author/org derived server-side so the antidoping log can't be forged.
      const data = await administerMedication({
        athleteId,
        medicationName: medName.trim(),
        dose:           dose.trim() || null,
        route,
        notes:          notes.trim() || null,
        administeredAt: new Date(administeredAt).toISOString(),
      })
      onSaved(data as MedicationAdministration)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm rounded-2xl border shadow-2xl p-5 space-y-4" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}>
          Registar Administração
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Medicamento</label>
            <input value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="Nome do medicamento"
              className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
              style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Dose</label>
              <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="ex: 500 mg"
                className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Via</label>
              <select value={route} onChange={(e) => setRoute(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}>
                {ROUTE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Data e hora</label>
            <input type="datetime-local" value={administeredAt} onChange={(e) => setAdministeredAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
              style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Notas (opcional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais"
              className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
              style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }} />
          </div>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--sophi-danger)' }}>{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm border hover:bg-[var(--sophi-bg3)]"
            style={{ borderColor: 'var(--sophi-border)', color: 'var(--sophi-text2)' }}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
            style={{ background: 'var(--sophi-green)', color: '#000' }}>
            {saving && <Loader2 size={12} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function TreatmentsTab({ profile }: { profile: AthleteProfileData }) {
  const router = useRouter()

  // Clinical write actions mirror the RLS insert policies (owner/doctor/physio/
  // masseur) — other roles get a read-only view instead of an RLS error on save.
  const canClinical = profile.viewerRole === OWNER_ROLE || CLINICAL_ROLES.includes(profile.viewerRole)
  // Rehab sessions have a narrower writer set (018 rehab_clinical_write: owner +
  // doctor/physio only — masseurs are excluded).
  const canRehab = profile.viewerRole === OWNER_ROLE || REHAB_ROLES.includes(profile.viewerRole)

  // Rehab sessions
  const [sessions,   setSessions]   = useState<RehabSession[]>([])
  const [loadingS,   setLoadingS]   = useState(true)

  // Occurrence titles for sessions associated with one — profile.activeOccurrences
  // only covers open/recent ones, which is the same set offered when creating a
  // new association, so an older resolved occurrence link just shows no label.
  const occurrenceLabelById = new Map(
    profile.activeOccurrences.map((occ) => [occ.id, occ.title || occ.occurrence_type || 'Ocorrência']),
  )

  // Rehab session modal
  const [showRehabModal,  setShowRehabModal]  = useState(false)
  const [editingRehab,    setEditingRehab]    = useState<RehabSession | null>(null)

  // Medication administrations (clinical table)
  const [medAdminRecords,  setMedAdminRecords]  = useState<MedicationAdministration[]>([])
  const [loadingMedAdmin,  setLoadingMedAdmin]  = useState(true)
  const [showMedAdminModal, setShowMedAdminModal] = useState(false)

  // ── Fetch rehab sessions ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingS(true)
      try {
        const res = await fetch(`/api/athletes/${profile.id}/rehab-sessions`)
        if (!cancelled && res.ok) setSessions(await res.json())
      } finally {
        if (!cancelled) setLoadingS(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [profile.id])

  // ── Fetch medication administrations ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingMedAdmin(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('medication_administrations')
          .select('id, medication_name, dose, route, administered_by_name, administered_at, notes, created_at')
          .eq('athlete_id', profile.id)
          .order('administered_at', { ascending: false })
          .limit(50)
        if (!cancelled) setMedAdminRecords((data ?? []) as MedicationAdministration[])
      } finally {
        if (!cancelled) setLoadingMedAdmin(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [profile.id])

  // ── Handlers ───────────────────────────────────────────────────────────────
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

  return (
    <>
      <div className="space-y-4">

        {/* Rehab plan calendar — day-by-day programme, distinct from the
            physio session log below it. */}
        <Section icon={CalendarClock} title="Plano de Reabilitação">
          <RehabPlanSection profile={profile} />
        </Section>

        {/* Physiotherapy & Rehab */}
        <Section
          icon={Activity}
          title={`Fisioterapia & Reabilitação${sessions.length > 0 ? ` (${sessions.length})` : ''}`}
          action={canRehab ? (
            <button
              type="button"
              onClick={() => { setEditingRehab(null); setShowRehabModal(true) }}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--sophi-green-bg)]"
              style={{ color: 'var(--sophi-green)' }}
            >
              <Plus size={10} /> Nova
            </button>
          ) : undefined}
        >
          {loadingS ? (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--sophi-text3)' }} />
            </div>
          ) : sessions.length === 0 ? (
            canRehab ? (
              <EmptyState
                label="Sem sessões de fisioterapia registadas"
                cta="Nova Sessão"
                onClick={() => { setEditingRehab(null); setShowRehabModal(true) }}
              />
            ) : (
              <p className="py-6 text-center text-xs" style={{ color: 'var(--sophi-text3)' }}>Sem sessões de fisioterapia registadas</p>
            )
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <RehabRow
                  key={s.id}
                  s={s}
                  occurrenceLabel={s.occurrence_id ? occurrenceLabelById.get(s.occurrence_id) : null}
                  onEdit={canRehab ? () => { setEditingRehab(s); setShowRehabModal(true) } : undefined}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Medication administrations (antidoping log) */}
        <Section
          icon={Syringe}
          title={`Medicação${medAdminRecords.length > 0 ? ` (${medAdminRecords.length})` : ''}`}
          action={canClinical ? (
            <button
              type="button"
              onClick={() => setShowMedAdminModal(true)}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--sophi-green-bg)]"
              style={{ color: 'var(--sophi-green)' }}
            >
              <Plus size={10} /> Registar
            </button>
          ) : undefined}
        >
          {loadingMedAdmin ? (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--sophi-text3)' }} />
            </div>
          ) : medAdminRecords.length === 0 ? (
            canClinical ? (
              <EmptyState label="Sem administrações registadas" cta="Registar administração" onClick={() => setShowMedAdminModal(true)} />
            ) : (
              <p className="py-6 text-center text-xs" style={{ color: 'var(--sophi-text3)' }}>Sem administrações registadas</p>
            )
          ) : (
            <div className="space-y-2">
              {medAdminRecords.map((r) => (
                <div key={r.id} className="rounded-lg border px-3 py-2.5 space-y-1" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold" style={{ color: 'var(--sophi-text)' }}>{r.medication_name}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.route && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={{ background: 'var(--sophi-bg4)', color: 'var(--sophi-text3)' }}>
                          {r.route}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--sophi-text3)' }}>
                    {r.dose && <span>{r.dose}</span>}
                    <span className="flex items-center gap-1"><Clock size={9} />{formatDateTime(r.administered_at)}</span>
                    {r.administered_by_name && <span>· {r.administered_by_name}</span>}
                  </div>
                  {r.notes && <p className="text-[10px] italic" style={{ color: 'var(--sophi-text3)' }}>{r.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>

      {/* Modals */}
      {showRehabModal && (
        <RehabSessionModal
          athleteId={profile.id}
          existing={editingRehab}
          occurrences={profile.activeOccurrences}
          onClose={() => { setShowRehabModal(false); setEditingRehab(null) }}
          onSaved={handleRehabSaved}
          onDeleted={handleRehabDeleted}
        />
      )}
      {showMedAdminModal && (
        <MedAdminModal
          athleteId={profile.id}
          onClose={() => setShowMedAdminModal(false)}
          onSaved={(r) => { setMedAdminRecords((prev) => [r, ...prev]); setShowMedAdminModal(false) }}
        />
      )}
    </>
  )
}
