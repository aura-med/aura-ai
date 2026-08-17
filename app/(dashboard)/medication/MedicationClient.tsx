'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pill, Plus, Search, X, Clock, Loader2, Pencil, Trash2, Users, List } from 'lucide-react'
import {
  administerMedication,
  updateMedicationAdministration,
  deleteMedicationAdministration,
} from '@/lib/actions/clinical'
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

function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function formatDateTime(dt: string) {
  // Numeric fields only + explicit timeZone → deterministic across server (Node)
  // and browser (Safari) so the SSR'd list doesn't cause a hydration mismatch.
  return new Date(dt).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon',
  })
}

function athleteLabel(a: { name: string; shirt_number: number | null } | null | undefined): string {
  if (!a) return 'Atleta'
  return `${a.shirt_number != null ? `#${a.shirt_number} ` : ''}${a.name}`
}

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; record: TeamMedicationRecord }
  | null

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
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [grouped, setGrouped] = useState(false)
  const [modal, setModal] = useState<ModalState>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((r) => {
      if (q && !r.medication_name.toLowerCase().includes(q) && !(r.athletes?.name ?? '').toLowerCase().includes(q)) return false
      const day = r.administered_at.slice(0, 10)
      if (dateFrom && day < dateFrom) return false
      if (dateTo && day > dateTo) return false
      return true
    })
  }, [items, query, dateFrom, dateTo])

  const groups = useMemo(() => {
    if (!grouped) return null
    const map = new Map<string, { athlete: TeamMedicationRecord['athletes']; rows: TeamMedicationRecord[] }>()
    for (const r of filtered) {
      const key = r.athlete_id
      if (!map.has(key)) map.set(key, { athlete: r.athletes, rows: [] })
      map.get(key)!.rows.push(r)
    }
    return [...map.values()].sort((a, b) => (a.athlete?.name ?? '').localeCompare(b.athlete?.name ?? ''))
  }, [filtered, grouped])

  function handleSaved(record: TeamMedicationRecord, mode: 'create' | 'edit') {
    setItems((prev) => mode === 'create'
      ? [record, ...prev]
      : prev.map((r) => (r.id === record.id ? record : r)))
    setModal(null)
    router.refresh() // keep the athlete clinical file in sync on next navigation
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setDeleteError(null)
    try {
      await deleteMedicationAdministration(id)
      setItems((prev) => prev.filter((r) => r.id !== id))
      setConfirmDeleteId(null)
      router.refresh()
    } catch (e) {
      setDeleteError((e as Error).message)
    } finally {
      setDeletingId(null)
    }
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
            onClick={() => setModal({ mode: 'create' })}
            disabled={athletes.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-40"
            style={{ background: 'var(--aura-green)', color: '#000' }}
          >
            <Plus size={13} /> Registar Administração
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-end gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--aura-text3)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar por atleta ou medicamento…"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-xs border focus:outline-none"
            style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] block" style={{ color: 'var(--aura-text3)' }}>De</label>
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)}
            className="px-2 py-2 rounded-lg text-xs border focus:outline-none"
            style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] block" style={{ color: 'var(--aura-text3)' }}>Até</label>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)}
            className="px-2 py-2 rounded-lg text-xs border focus:outline-none"
            style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }} />
        </div>
        {(dateFrom || dateTo || query) && (
          <button type="button" onClick={() => { setQuery(''); setDateFrom(''); setDateTo('') }}
            className="px-2 py-2 rounded-lg text-xs border" style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text3)' }}>
            Limpar
          </button>
        )}
        <button type="button" onClick={() => setGrouped((g) => !g)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border"
          style={{ borderColor: 'var(--aura-border)', color: grouped ? 'var(--aura-green)' : 'var(--aura-text2)', background: grouped ? 'rgba(0,229,160,0.08)' : 'transparent' }}>
          {grouped ? <List size={13} /> : <Users size={13} />} {grouped ? 'Lista' : 'Agrupar por atleta'}
        </button>
      </div>

      {deleteError && <p role="alert" className="text-xs" style={{ color: 'var(--aura-danger)' }}>{deleteError}</p>}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
          <Pill size={28} className="mx-auto mb-3" style={{ color: 'var(--aura-text3)' }} />
          <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
            {items.length === 0 ? 'Sem administrações registadas' : 'Sem resultados para os filtros'}
          </p>
        </div>
      ) : grouped && groups ? (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.athlete?.id ?? 'x'}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold" style={{ color: 'var(--aura-text)' }}>{athleteLabel(g.athlete)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--aura-bg4)', color: 'var(--aura-text3)' }}>{g.rows.length}</span>
              </div>
              <div className="space-y-2">
                {g.rows.map((r) => (
                  <Row key={r.id} r={r} canWrite={canWrite} showAthlete={false}
                    onEdit={() => setModal({ mode: 'edit', record: r })}
                    confirmDeleteId={confirmDeleteId} setConfirmDeleteId={setConfirmDeleteId}
                    deletingId={deletingId} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Row key={r.id} r={r} canWrite={canWrite} showAthlete
              onEdit={() => setModal({ mode: 'edit', record: r })}
              confirmDeleteId={confirmDeleteId} setConfirmDeleteId={setConfirmDeleteId}
              deletingId={deletingId} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {modal && (
        <MedicationModal
          athletes={athletes}
          editing={modal.mode === 'edit' ? modal.record : null}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function Row({
  r, canWrite, showAthlete, onEdit, confirmDeleteId, setConfirmDeleteId, deletingId, onDelete,
}: {
  r: TeamMedicationRecord
  canWrite: boolean
  showAthlete: boolean
  onEdit: () => void
  confirmDeleteId: string | null
  setConfirmDeleteId: (id: string | null) => void
  deletingId: string | null
  onDelete: (id: string) => void
}) {
  const confirming = confirmDeleteId === r.id
  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg2)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: 'var(--aura-text)' }}>{r.medication_name}</span>
            {r.route && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={{ background: 'var(--aura-bg4)', color: 'var(--aura-text3)' }}>
                {ROUTE_LABEL[r.route] ?? r.route}
              </span>
            )}
            {r.dose && <span className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>{r.dose}</span>}
          </div>
          {showAthlete && (
            <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: 'var(--aura-text2)' }}>
              <span className="font-medium" style={{ color: 'var(--aura-text)' }}>{athleteLabel(r.athletes)}</span>
              {r.athletes?.position && <span style={{ color: 'var(--aura-text3)' }}>· {r.athletes.position}</span>}
            </div>
          )}
          {r.notes && <p className="mt-1 text-[10px] italic" style={{ color: 'var(--aura-text3)' }}>{r.notes}</p>}
        </div>
        <div className="flex items-start gap-2 shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end text-[10px]" style={{ color: 'var(--aura-text3)' }}>
              <Clock size={9} /> {formatDateTime(r.administered_at)}
            </div>
            {r.administered_by_name && <div className="text-[10px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>{r.administered_by_name}</div>}
          </div>
          {canWrite && !confirming && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={onEdit} className="p-1 rounded hover:bg-white/10" title="Editar">
                <Pencil size={12} style={{ color: 'var(--aura-text3)' }} />
              </button>
              <button type="button" onClick={() => setConfirmDeleteId(r.id)} className="p-1 rounded hover:bg-white/10" title="Apagar">
                <Trash2 size={12} style={{ color: 'var(--aura-danger)' }} />
              </button>
            </div>
          )}
          {canWrite && confirming && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => onDelete(r.id)} disabled={deletingId === r.id}
                className="text-[10px] font-bold px-2 py-1 rounded" style={{ background: 'var(--aura-danger)', color: '#fff' }}>
                {deletingId === r.id ? '…' : 'Apagar'}
              </button>
              <button type="button" onClick={() => setConfirmDeleteId(null)}
                className="text-[10px] px-2 py-1 rounded border" style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text3)' }}>
                Não
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MedicationModal({
  athletes,
  editing,
  onClose,
  onSaved,
}: {
  athletes: MedicationAthlete[]
  editing: TeamMedicationRecord | null
  onClose: () => void
  onSaved: (record: TeamMedicationRecord, mode: 'create' | 'edit') => void
}) {
  const isEdit = editing != null
  const [athleteId,      setAthleteId]      = useState(editing?.athlete_id ?? athletes[0]?.id ?? '')
  const [medName,        setMedName]        = useState(editing?.medication_name ?? '')
  const [dose,           setDose]           = useState(editing?.dose ?? '')
  const [route,          setRoute]          = useState(editing?.route ?? 'oral')
  const [notes,          setNotes]          = useState(editing?.notes ?? '')
  const [administeredAt, setAdministeredAt] = useState(editing ? isoToLocalInput(editing.administered_at) : localDateTimeValue())
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  async function handleSave() {
    if (!medName.trim()) { setError('Nome do medicamento obrigatório'); return }
    setSaving(true)
    setError(null)
    try {
      if (isEdit && editing) {
        await updateMedicationAdministration({
          id:             editing.id,
          medicationName: medName.trim(),
          dose:           dose.trim() || null,
          route,
          notes:          notes.trim() || null,
          administeredAt: new Date(administeredAt).toISOString(),
        })
        onSaved({ ...editing, medication_name: medName.trim(), dose: dose.trim() || null, route, notes: notes.trim() || null, administered_at: new Date(administeredAt).toISOString() }, 'edit')
        return
      }
      const athlete = athletes.find((a) => a.id === athleteId)
      if (!athlete) { setError('Seleciona um atleta'); return }
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
      }, 'create')
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
            {isEdit ? 'Editar Administração' : 'Registar Administração'}
          </h3>
          <button type="button" onClick={onClose}><X size={14} style={{ color: 'var(--aura-text3)' }} /></button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Atleta</label>
            <select value={athleteId} onChange={(e) => setAthleteId(e.target.value)} disabled={isEdit}
              className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none disabled:opacity-60"
              style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}>
              {isEdit ? (
                <option value={editing!.athlete_id}>{athleteLabel(editing!.athletes)}</option>
              ) : (
                athletes.map((a) => (
                  <option key={a.id} value={a.id}>{athleteLabel(a)}</option>
                ))
              )}
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
