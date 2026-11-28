'use client'

// Medication administration log (antidoping log) — distinct from the
// prescribed/active medication list in MedicalTab: this records each actual
// dose given over time, rather than an ongoing prescription.
import { useState, useEffect, useMemo } from 'react'
import { Plus, Clock, Loader2, Syringe, AlertTriangle, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { administerMedication } from '@/lib/actions/clinical'
import { OWNER_ROLE, CLINICAL_ROLES } from '@/lib/roles'
import { checkProhibitedSubstance, WADA_LIST_VERSION } from '@/lib/medical/wadaProhibitedList'
import type { AthleteProfileData, MedicationAdministration, MedicationRecord } from '@/types/athlete-profile'

// Local-time default — UTC (toISOString) shifts the clinician's day/time by
// their timezone offset, which corrupts the medication administration log.
function localDateTimeValue(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const ROUTE_OPTIONS = [
  { value: 'oral',           label: 'Oral' },
  { value: 'im',             label: 'IM (intramuscular)' },
  { value: 'intra-articular', label: 'Intra-articular' },
  { value: 'iv',             label: 'IV (intravenoso)' },
  { value: 'topical',        label: 'Tópico' },
  { value: 'other',          label: 'Outro' },
]

function EmptyState({ label, cta, onClick }: { label: string; cta: string; onClick: () => void }) {
  return (
    <div className="py-6 flex flex-col items-center gap-2">
      <p className="text-xs" style={{ color: 'var(--sophi-text3)' }}>{label}</p>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed transition-colors hover:border-[var(--sophi-accent)] hover:text-[var(--sophi-accent)]"
        style={{ borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text3)' }}
      >
        <Plus size={11} />
        {cta}
      </button>
    </div>
  )
}

function TueCheck({ medName, route, existingMedications }: { medName: string; route: string; existingMedications: MedicationRecord[] }) {
  const match = useMemo(() => checkProhibitedSubstance(medName, route), [medName, route])
  if (!match) return null

  const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const needle = normalize(medName)
  const hasTue = existingMedications.some((m) => m.has_tue && (needle.includes(normalize(m.name)) || normalize(m.name).includes(needle)))

  if (hasTue) {
    return (
      <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--sophi-green-bg)' }}>
        <ShieldCheck size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--sophi-green)' }} />
        <p className="text-[11px]" style={{ color: 'var(--sophi-green)' }}>
          Pode constar da Lista de Proibições WADA ({match.matched.category} — {match.matched.categoryLabel}), mas existe uma AUT registada para "{medName}" na Medicação Habitual.
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--sophi-warn-bg)' }}>
      <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--sophi-warn)' }} />
      <div>
        <p className="text-[11px] font-semibold" style={{ color: 'var(--sophi-warn)' }}>
          Pode constar da Lista de Proibições WADA — {match.matched.category} ({match.matched.categoryLabel})
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--sophi-warn)' }}>{match.note}</p>
        <p className="text-[9px] mt-1" style={{ color: 'var(--sophi-text3)' }}>
          Sem AUT registada para este atleta. Verificar na lista oficial ({WADA_LIST_VERSION}) antes de administrar, ou registar a AUT na Medicação Habitual.
        </p>
        <p className="text-[9px]" style={{ color: 'var(--sophi-text3)' }}>
          Deteção automática por nome — não é uma verificação oficial; confirma sempre na lista publicada pela WADA.
        </p>
      </div>
    </div>
  )
}

function MedAdminModal({
  athleteId,
  existingMedications,
  onClose,
  onSaved,
}: {
  athleteId: string
  existingMedications: MedicationRecord[]
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
        <h3 className="font-semibold text-sm" style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-display)' }}>
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
        {medName.trim() && <TueCheck medName={medName} route={route} existingMedications={existingMedications} />}
        {error && <p className="text-xs" style={{ color: 'var(--sophi-danger)' }}>{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm border hover:bg-[var(--sophi-bg3)]"
            style={{ borderColor: 'var(--sophi-border)', color: 'var(--sophi-text2)' }}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
            style={{ background: 'var(--sophi-primary)', color: 'var(--sophi-on-primary)' }}>
            {saving && <Loader2 size={12} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

export function MedicationAdminSection({ profile }: { profile: AthleteProfileData }) {
  const canClinical = profile.viewerRole === OWNER_ROLE || CLINICAL_ROLES.includes(profile.viewerRole)

  const [records,  setRecords]  = useState<MedicationAdministration[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('medication_administrations')
          .select('id, medication_name, dose, route, administered_by_name, administered_at, notes, created_at')
          .eq('athlete_id', profile.id)
          .order('administered_at', { ascending: false })
          .limit(50)
        if (!cancelled) setRecords((data ?? []) as MedicationAdministration[])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [profile.id])

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
        <Syringe size={13} style={{ color: 'var(--sophi-accent)' }} />
        <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text2)' }}>
          Administração de Medicação{records.length > 0 ? ` (${records.length})` : ''}
        </p>
        {canClinical && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--sophi-accent-bg)]"
            style={{ color: 'var(--sophi-accent)' }}
          >
            <Plus size={10} /> Registar
          </button>
        )}
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--sophi-text3)' }} />
          </div>
        ) : records.length === 0 ? (
          canClinical ? (
            <EmptyState label="Sem administrações registadas" cta="Registar administração" onClick={() => setShowModal(true)} />
          ) : (
            <p className="py-6 text-center text-xs" style={{ color: 'var(--sophi-text3)' }}>Sem administrações registadas</p>
          )
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
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
      </div>

      {showModal && (
        <MedAdminModal
          athleteId={profile.id}
          existingMedications={profile.medicalHistory?.medications ?? []}
          onClose={() => setShowModal(false)}
          onSaved={(r) => { setRecords((prev) => [r, ...prev]); setShowModal(false) }}
        />
      )}
    </div>
  )
}
