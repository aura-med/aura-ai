'use client'

import { useState } from 'react'
import { X, Check, Loader2, Wrench, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { OrthoticRecord, MedicalHistory } from '@/types/athlete-profile'

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  athleteId:    string
  medHistory:   MedicalHistory | null
  editing:      OrthoticRecord | null
  editingIndex: number | null
  onClose:      () => void
  onSaved:      (updated: MedicalHistory) => void
}

export function OrthoticModal({ athleteId, medHistory, editing, editingIndex, onClose, onSaved }: Props) {
  const isEdit = editingIndex !== null && editing !== null

  const [name,          setName]          = useState(editing?.name           ?? '')
  const [bodyPart,      setBodyPart]      = useState(editing?.body_part      ?? '')
  const [prescribedDate, setPrescribedDate] = useState(editing?.prescribed_date ?? '')
  const [prescriber,    setPrescriber]    = useState(editing?.prescriber     ?? '')
  const [notes,         setNotes]         = useState(editing?.notes          ?? '')

  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--aura-green)]"
  const inputStyle = { background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }

  async function handleSave() {
    if (!name.trim())     { setError('Nome da ortótese obrigatório.'); return }
    if (!bodyPart.trim()) { setError('Segmento corporal obrigatório.'); return }

    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const current: OrthoticRecord[] = medHistory?.orthotics ?? []
      const entry: OrthoticRecord = {
        name:           name.trim(),
        body_part:      bodyPart.trim(),
        prescribed_date: prescribedDate || undefined,
        prescriber:     prescriber.trim() || undefined,
        notes:          notes.trim()     || undefined,
      }

      const updated = isEdit
        ? current.map((o, i) => i === editingIndex ? entry : o)
        : [...current, entry]

      const payload = { athlete_id: athleteId, orthotics: updated }
      const { data, error: err } = await supabase
        .from('athletes_medical_history')
        .upsert(payload, { onConflict: 'athlete_id' })
        .select()
        .single()
      if (err) throw err
      onSaved(data as MedicalHistory)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (editingIndex === null) return
    setDeleting(true)
    setError(null)
    try {
      const supabase = createClient()
      const updated = (medHistory?.orthotics ?? []).filter((_, i) => i !== editingIndex)
      const payload = { athlete_id: athleteId, orthotics: updated }
      const { data, error: err } = await supabase
        .from('athletes_medical_history')
        .upsert(payload, { onConflict: 'athlete_id' })
        .select()
        .single()
      if (err) throw err
      onSaved(data as MedicalHistory)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl flex flex-col max-h-[90vh]"
        style={{ background: 'var(--aura-bg)', borderColor: 'var(--aura-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--aura-border)' }}>
          <div className="flex items-center gap-2">
            <Wrench size={14} style={{ color: 'var(--aura-green)' }} />
            <p className="text-sm font-bold" style={{ color: 'var(--aura-text)' }}>
              {isEdit ? 'Editar Ortótese' : 'Nova Ortótese / Auxiliar'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
            <X size={14} style={{ color: 'var(--aura-text3)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
              Nome *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Joelheira, Palmilha ortopédica…"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
              Segmento Corporal *
            </label>
            <input
              value={bodyPart}
              onChange={(e) => setBodyPart(e.target.value)}
              placeholder="Ex: Joelho direito, Tornozelo esquerdo…"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Data de Prescrição
              </label>
              <input
                type="date"
                value={prescribedDate}
                onChange={(e) => setPrescribedDate(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Prescrito por
              </label>
              <input
                value={prescriber}
                onChange={(e) => setPrescriber(e.target.value)}
                placeholder="Dr. Nome"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Indicações de uso, observações…"
              rows={3}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {error && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--aura-danger-bg)', color: 'var(--aura-danger)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t shrink-0" style={{ borderColor: 'var(--aura-border)' }}>
          <div>
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-[var(--aura-danger-bg)]"
                style={{ color: 'var(--aura-danger)' }}
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Remover
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium border hover:bg-white/5"
              style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text2)' }}
            >
              Cancelar
            </button>
            <button
              type="button" onClick={handleSave}
              disabled={saving || deleting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
              style={{ background: 'var(--aura-green)', color: '#000' }}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {saving ? 'A guardar…' : isEdit ? 'Guardar' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
