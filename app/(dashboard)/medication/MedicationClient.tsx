'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pill, Plus, Search, X, Clock, Loader2 } from 'lucide-react'
import { administerMedication } from '@/lib/actions/clinical'
import { isOwner, CLINICAL_ROLES } from '@/lib/roles'
import type { UserRole } from '@/types'
import type { TeamMedicationRecord, MedicationAthlete } from './page'

const ROUTE_OPTIONS = [
  { value: 'oral',            label: 'Oral' },
  { value: 'im',              label: 'IM (intramuscular)' },
  { value: 'intra-articular', label: 'Intra-articular' },
  { value: 'iv',              label: 'IV (intravenoso)' },
  { value: 'topical',         label: 'Tópico' },
  { value: 'other',           label: 'Outro' },
]
const ROUTE_LABEL: Record<string, string> = Object.fromEntries(ROUTE_OPTIONS.map((r) => [r.value, r.label]))

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

export function MedicationClient({
  role,
  athletes,
  records,
}: {
  role: string | null
  athletes: MedicationAthlete[]
  records: TeamMedicationRecord[]
}) {
  const router = useRouter()
  const canWrite = isOwner(role as UserRole) || CLINICAL_ROLES.includes(role as UserRole)

  const [items, setItems] = useState<TeamMedicationRecord[]>(records)
  const [query, setQuery] = useState('')
  const [showModal, setShowModal] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((r) =>
      r.medication_name.toLowerCase().includes(q) ||
      (r.athletes?.name ?? '').toLowerCase().includes(q)
    )
  }, [items, query])

  function handleSaved(record: TeamMedicationRecord) {
    setItems((prev) => [record, ...prev])
    setShowModal(false)
    router.refresh() // keep the athlete clinical file in sync on next navigation
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Pill size={18} style={{ color: 'var(--aura-green)' }} />
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
              Medicação
            </h1>
            <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>
              Histórico de administrações da equipa
            </p>
          </div>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            disabled={athletes.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-40"
            style={{ background: 'var(--aura-green)', color: '#000' }}
          >
            <Plus size={13} /> Registar Administração
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--aura-text3)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Procurar por atleta ou medicamento…"
          className="w-full pl-8 pr-3 py-2 rounded-lg text-xs border focus:outline-none"
          style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
          <Pill size={28} className="mx-auto mb-3" style={{ color: 'var(--aura-text3)' }} />
          <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
            {items.length === 0 ? 'Sem administrações registadas' : 'Sem resultados para a pesquisa'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border px-4 py-3"
              style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg2)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: 'var(--aura-text)' }}>
                      {r.medication_name}
                    </span>
                    {r.route && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={{ background: 'var(--aura-bg4)', color: 'var(--aura-text3)' }}>
                        {ROUTE_LABEL[r.route] ?? r.route}
                      </span>
                    )}
                    {r.dose && <span className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>{r.dose}</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: 'var(--aura-text2)' }}>
                    <span className="font-medium" style={{ color: 'var(--aura-text)' }}>
                      {r.athletes?.shirt_number != null ? `#${r.athletes.shirt_number} ` : ''}{r.athletes?.name ?? 'Atleta'}
                    </span>
                    {r.athletes?.position && <span style={{ color: 'var(--aura-text3)' }}>· {r.athletes.position}</span>}
                  </div>
                  {r.notes && <p className="mt-1 text-[10px] italic" style={{ color: 'var(--aura-text3)' }}>{r.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 justify-end text-[10px]" style={{ color: 'var(--aura-text3)' }}>
                    <Clock size={9} /> {formatDateTime(r.administered_at)}
                  </div>
                  {r.administered_by_name && (
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>{r.administered_by_name}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <MedicationModal
          athletes={athletes}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function MedicationModal({
  athletes,
  onClose,
  onSaved,
}: {
  athletes: MedicationAthlete[]
  onClose: () => void
  onSaved: (record: TeamMedicationRecord) => void
}) {
  const [athleteId,      setAthleteId]      = useState(athletes[0]?.id ?? '')
  const [medName,        setMedName]        = useState('')
  const [dose,           setDose]           = useState('')
  const [route,          setRoute]          = useState('oral')
  const [notes,          setNotes]          = useState('')
  const [administeredAt, setAdministeredAt] = useState(localDateTimeValue)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  async function handleSave() {
    const athlete = athletes.find((a) => a.id === athleteId)
    if (!athlete) { setError('Seleciona um atleta'); return }
    if (!medName.trim()) { setError('Nome do medicamento obrigatório'); return }
    setSaving(true)
    setError(null)
    try {
      // Same server action as the athlete clinical file — author/org derived
      // server-side, so the two views write identical, synchronized rows.
      const data = await administerMedication({
        athleteId:      athlete.id,
        medicationName: medName.trim(),
        dose:           dose.trim() || null,
        route,
        notes:          notes.trim() || null,
        administeredAt: new Date(administeredAt).toISOString(),
      })
      const row = data as { id: string; medication_name: string; dose: string | null; route: string | null; administered_by_name: string | null; administered_at: string; notes: string | null }
      onSaved({
        id: row.id,
        athlete_id: athlete.id,
        medication_name: row.medication_name,
        dose: row.dose,
        route: row.route,
        administered_by_name: row.administered_by_name,
        administered_at: row.administered_at,
        notes: row.notes,
        athletes: { id: athlete.id, name: athlete.name, shirt_number: athlete.shirt_number, photo_url: null, position: athlete.position },
      })
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
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
            Registar Administração
          </h3>
          <button type="button" onClick={onClose}><X size={14} style={{ color: 'var(--aura-text3)' }} /></button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Atleta</label>
            <select value={athleteId} onChange={(e) => setAthleteId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
              style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.shirt_number != null ? `#${a.shirt_number} ` : ''}{a.name}
                </option>
              ))}
            </select>
          </div>
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
        {error && <p role="alert" className="text-xs" style={{ color: 'var(--aura-danger)' }}>{error}</p>}
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
