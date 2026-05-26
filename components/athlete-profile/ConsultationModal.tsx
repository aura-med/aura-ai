'use client'

import { useState } from 'react'
import { X, Loader2, Trash2 } from 'lucide-react'
import type { MedicalConsultation } from '@/types/athlete-profile'

interface Props {
  athleteId: string
  consultation?: MedicalConsultation | null
  onClose: () => void
  onSaved: (c: MedicalConsultation) => void
  onDeleted?: (id: string) => void
}

const SOAP_FIELDS = [
  { key: 'subjective',  label: 'S — Subjetivo',  placeholder: 'Queixas e sintomas referidos pelo atleta…' },
  { key: 'objective',   label: 'O — Objetivo',   placeholder: 'Achados clínicos observáveis e mensuráveis…' },
  { key: 'assessment',  label: 'A — Avaliação',  placeholder: 'Diagnóstico e interpretação clínica…' },
  { key: 'plan',        label: 'P — Plano',      placeholder: 'Tratamento, referências e próximos passos…' },
] as const

type SoapKey = typeof SOAP_FIELDS[number]['key']

export function ConsultationModal({ athleteId, consultation, onClose, onSaved, onDeleted }: Props) {
  const isEdit = !!consultation

  const today = new Date().toISOString().slice(0, 10)

  const [date, setDate]           = useState(consultation?.consultation_date ?? today)
  const [time, setTime]           = useState(consultation?.consultation_time ?? '')
  const [clinician, setClinician] = useState(consultation?.clinician_name ?? '')
  const [soap, setSoap]           = useState<Record<SoapKey, string>>({
    subjective:  consultation?.subjective  ?? '',
    objective:   consultation?.objective   ?? '',
    assessment:  consultation?.assessment  ?? '',
    plan:        consultation?.plan        ?? '',
  })
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleSave() {
    if (!date) { setError('A data é obrigatória.'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        consultation_date: date,
        consultation_time: time || null,
        clinician_name:    clinician || null,
        ...soap,
      }

      const url = isEdit
        ? `/api/athletes/${athleteId}/consultations/${consultation!.id}`
        : `/api/athletes/${athleteId}/consultations`

      const res = await fetch(url, {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Erro ao guardar consulta')
      }

      const saved: MedicalConsultation = await res.json()
      onSaved(saved)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!consultation) return
    if (!confirmDel) { setConfirmDel(true); return }
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/athletes/${athleteId}/consultations/${consultation.id}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error('Erro ao apagar')
      onDeleted?.(consultation.id)
    } catch (e) {
      setError((e as Error).message)
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col max-h-[90vh]"
        style={{ background: 'var(--aura-bg)', borderColor: 'var(--aura-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--aura-border)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--aura-text)' }}>
            {isEdit ? 'Editar Consulta' : 'Nova Consulta SOAP'}
          </p>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-white/10 transition-colors">
            <X size={15} style={{ color: 'var(--aura-text3)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Date / time / clinician */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Data *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--aura-green)]"
                style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }}
              />
            </div>
            <div className="col-span-1 space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Hora
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--aura-green)]"
                style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }}
              />
            </div>
            <div className="col-span-1 space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Clínico
              </label>
              <input
                type="text"
                value={clinician}
                onChange={(e) => setClinician(e.target.value)}
                placeholder="Nome do clínico"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--aura-green)]"
                style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }}
              />
            </div>
          </div>

          {/* SOAP fields */}
          {SOAP_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                {label}
              </label>
              <textarea
                rows={3}
                value={soap[key]}
                onChange={(e) => setSoap((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-[var(--aura-green)]"
                style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }}
              />
            </div>
          ))}

          {error && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--aura-danger-bg)', color: 'var(--aura-danger)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t shrink-0" style={{ borderColor: 'var(--aura-border)' }}>
          {/* Delete */}
          {isEdit && onDeleted && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: confirmDel ? 'var(--aura-danger)' : 'var(--aura-danger-bg)',
                color: confirmDel ? '#fff' : 'var(--aura-danger)',
              }}
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {confirmDel ? 'Confirmar' : 'Apagar'}
            </button>
          )}
          {!isEdit && <div />}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium border transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text2)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
              style={{ background: 'var(--aura-green)', color: '#000' }}
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              {isEdit ? 'Guardar' : 'Criar Consulta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
