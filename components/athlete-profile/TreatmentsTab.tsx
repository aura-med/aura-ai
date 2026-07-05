'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Activity, Pill, Wrench, Plus, Clock, Edit2, Loader2, Syringe, Bandage } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { administerMedication } from '@/lib/actions/clinical'
import type {
  AthleteProfileData,
  MedicalHistory,
  MedicationRecord,
  OrthoticRecord,
  RehabSession,
  MedicationAdministration,
  OrthosisRecord,
} from '@/types/athlete-profile'

const MedicationModal = dynamic(() => import('./MedicationModal').then((mod) => mod.MedicationModal))
const RehabSessionModal = dynamic(() => import('./RehabSessionModal').then((mod) => mod.RehabSessionModal))
const OrthoticModal = dynamic(() => import('./OrthoticModal').then((mod) => mod.OrthoticModal))

// ── Helpers ───────────────────────────────────────────────────────────────────

// Local-time defaults — UTC (toISOString) shifts the clinician's day/time by
// their timezone offset, which corrupts the medication/orthosis audit log.
function localDateTimeValue(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function localDateValue(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

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
      <div className="w-full max-w-sm rounded-2xl border shadow-2xl p-5 space-y-4" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
          Registar Administração
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Medicamento</label>
            <input value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="Nome do medicamento"
              className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
              style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Dose</label>
              <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="ex: 500 mg"
                className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Via</label>
              <select value={route} onChange={(e) => setRoute(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}>
                {ROUTE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Data e hora</label>
            <input type="datetime-local" value={administeredAt} onChange={(e) => setAdministeredAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
              style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Notas (opcional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais"
              className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
              style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }} />
          </div>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--aura-danger)' }}>{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm border hover:bg-[var(--aura-bg3)]"
            style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text2)' }}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
            style={{ background: 'var(--aura-green)', color: '#000' }}>
            {saving && <Loader2 size={12} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Orthosis Record Modal ─────────────────────────────────────────────────────

function OrthosisModal({
  athleteId,
  onClose,
  onSaved,
}: {
  athleteId: string
  onClose: () => void
  onSaved: (record: OrthosisRecord) => void
}) {
  const [orthosisType, setOrthosisType] = useState('')
  const [bodyPart,     setBodyPart]     = useState('')
  const [appliedBy,    setAppliedBy]    = useState('')
  const [requiresDaily, setRequiresDaily] = useState(false)
  const [notes,        setNotes]        = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  async function handleSave() {
    if (!orthosisType.trim()) { setError('Tipo de ortótese obrigatório'); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('org_id, full_name').eq('id', user?.id ?? '').single()
      const today = localDateValue()
      const { data, error: err } = await supabase.from('orthosis_records').insert({
        athlete_id:                 athleteId,
        org_id:                     prof?.org_id ?? null,
        orthosis_type:              orthosisType.trim(),
        body_part:                  bodyPart.trim() || null,
        registered_by_name:         prof?.full_name ?? null,
        applied_by_name:            appliedBy.trim() || null,
        application_date:           today,
        requires_daily_application: requiresDaily,
        notes:                      notes.trim() || null,
        is_active:                  true,
      }).select().single()
      if (err) throw err
      onSaved(data as OrthosisRecord)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm rounded-2xl border shadow-2xl p-5 space-y-4" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
          Registar Ortótese / Ligadura
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Tipo de ortótese / ligadura</label>
            <input value={orthosisType} onChange={(e) => setOrthosisType(e.target.value)} placeholder="ex: Ligadura funcional, Taping, Joelheira"
              className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
              style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Segmento corporal</label>
              <input value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} placeholder="ex: Tornozelo"
                className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Aplicado por</label>
              <input value={appliedBy} onChange={(e) => setAppliedBy(e.target.value)} placeholder="Nome do clínico"
                className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={requiresDaily} onChange={(e) => setRequiresDaily(e.target.checked)} />
            <span className="text-xs" style={{ color: 'var(--aura-text2)' }}>Requer aplicação diária</span>
          </label>
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Notas (opcional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações"
              className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
              style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }} />
          </div>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--aura-danger)' }}>{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm border hover:bg-[var(--aura-bg3)]"
            style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text2)' }}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
            style={{ background: 'var(--aura-green)', color: '#000' }}>
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

  // Clinical write actions mirror the RLS insert policies (admin/doctor/physio/
  // masseur) — other roles get a read-only view instead of an RLS error on save.
  const canClinical = ['admin', 'doctor', 'physio', 'masseur'].includes(profile.viewerRole)

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

  // Medication administrations (clinical table)
  const [medAdminRecords,  setMedAdminRecords]  = useState<MedicationAdministration[]>([])
  const [loadingMedAdmin,  setLoadingMedAdmin]  = useState(true)
  const [showMedAdminModal, setShowMedAdminModal] = useState(false)

  // Orthosis records (clinical table)
  const [orthosisRecords,  setOrthosisRecords]  = useState<OrthosisRecord[]>([])
  const [loadingOrthosis,  setLoadingOrthosis]  = useState(true)
  const [showOrthosisModal, setShowOrthosisModal] = useState(false)

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

  // ── Fetch orthosis records ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingOrthosis(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('orthosis_records')
          .select('id, orthosis_type, body_part, registered_by_name, applied_by_name, application_date, requires_daily_application, is_active, notes, created_at')
          .eq('athlete_id', profile.id)
          .order('application_date', { ascending: false })
          .limit(50)
        if (!cancelled) setOrthosisRecords((data ?? []) as OrthosisRecord[])
      } finally {
        if (!cancelled) setLoadingOrthosis(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [profile.id])

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

        {/* Orthotics (JSONB legacy) */}
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

        {/* Medication administrations (antidoping log) */}
        <Section
          icon={Syringe}
          title={`Administração de Medicamentos${medAdminRecords.length > 0 ? ` (${medAdminRecords.length})` : ''}`}
          action={canClinical ? (
            <button
              type="button"
              onClick={() => setShowMedAdminModal(true)}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--aura-green-bg)]"
              style={{ color: 'var(--aura-green)' }}
            >
              <Plus size={10} /> Registar
            </button>
          ) : undefined}
        >
          {loadingMedAdmin ? (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--aura-text3)' }} />
            </div>
          ) : medAdminRecords.length === 0 ? (
            canClinical ? (
              <EmptyState label="Sem administrações registadas" cta="Registar administração" onClick={() => setShowMedAdminModal(true)} />
            ) : (
              <p className="py-6 text-center text-xs" style={{ color: 'var(--aura-text3)' }}>Sem administrações registadas</p>
            )
          ) : (
            <div className="space-y-2">
              {medAdminRecords.map((r) => (
                <div key={r.id} className="rounded-lg border px-3 py-2.5 space-y-1" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold" style={{ color: 'var(--aura-text)' }}>{r.medication_name}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.route && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={{ background: 'var(--aura-bg4)', color: 'var(--aura-text3)' }}>
                          {r.route}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--aura-text3)' }}>
                    {r.dose && <span>{r.dose}</span>}
                    <span className="flex items-center gap-1"><Clock size={9} />{formatDateTime(r.administered_at)}</span>
                    {r.administered_by_name && <span>· {r.administered_by_name}</span>}
                  </div>
                  {r.notes && <p className="text-[10px] italic" style={{ color: 'var(--aura-text3)' }}>{r.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Orthosis records (clinical table) */}
        <Section
          icon={Bandage}
          title={`Ligaduras & Ortóteses Clínicas${orthosisRecords.length > 0 ? ` (${orthosisRecords.length})` : ''}`}
          action={canClinical ? (
            <button
              type="button"
              onClick={() => setShowOrthosisModal(true)}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--aura-green-bg)]"
              style={{ color: 'var(--aura-green)' }}
            >
              <Plus size={10} /> Registar
            </button>
          ) : undefined}
        >
          {loadingOrthosis ? (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--aura-text3)' }} />
            </div>
          ) : orthosisRecords.length === 0 ? (
            canClinical ? (
              <EmptyState label="Sem registos clínicos de ligaduras" cta="Registar" onClick={() => setShowOrthosisModal(true)} />
            ) : (
              <p className="py-6 text-center text-xs" style={{ color: 'var(--aura-text3)' }}>Sem registos clínicos de ligaduras</p>
            )
          ) : (
            <div className="space-y-2">
              {orthosisRecords.map((r) => (
                <div key={r.id} className="rounded-lg border px-3 py-2.5 space-y-1" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold" style={{ color: 'var(--aura-text)' }}>
                      {r.orthosis_type}{r.body_part ? ` · ${r.body_part}` : ''}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.is_active && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--aura-green-bg)', color: 'var(--aura-green)' }}>Ativo</span>
                      )}
                      {r.requires_daily_application && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--aura-warn-bg)', color: 'var(--aura-warn)' }}>Diário</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--aura-text3)' }}>
                    <span className="flex items-center gap-1"><Clock size={9} />{r.application_date}</span>
                    {r.registered_by_name && <span>Reg.: {r.registered_by_name}</span>}
                    {r.applied_by_name && <span>Apl.: {r.applied_by_name}</span>}
                  </div>
                  {r.notes && <p className="text-[10px] italic" style={{ color: 'var(--aura-text3)' }}>{r.notes}</p>}
                </div>
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
      {showMedAdminModal && (
        <MedAdminModal
          athleteId={profile.id}
          onClose={() => setShowMedAdminModal(false)}
          onSaved={(r) => { setMedAdminRecords((prev) => [r, ...prev]); setShowMedAdminModal(false) }}
        />
      )}
      {showOrthosisModal && (
        <OrthosisModal
          athleteId={profile.id}
          onClose={() => setShowOrthosisModal(false)}
          onSaved={(r) => { setOrthosisRecords((prev) => [r, ...prev]); setShowOrthosisModal(false) }}
        />
      )}
    </>
  )
}
