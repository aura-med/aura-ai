'use client'

import { useState } from 'react'
import { X, Check, Loader2, Activity, Trash2 } from 'lucide-react'
import type { RehabSession } from '@/types/athlete-profile'

// ─────────────────────────────────────────────────────────────────────────────

const SESSION_TYPES: { value: RehabSession['session_type']; label: string }[] = [
  { value: 'physio', label: 'Fisioterapia' },
  { value: 'gym',    label: 'Ginásio / Força' },
  { value: 'pool',   label: 'Piscina' },
  { value: 'field',  label: 'Campo' },
  { value: 'other',  label: 'Outro' },
]

interface Props {
  athleteId: string
  existing?: RehabSession | null
  onClose:   () => void
  onSaved:   (s: RehabSession) => void
  onDeleted?: (id: string) => void
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function RehabSessionModal({ athleteId, existing, onClose, onSaved, onDeleted }: Props) {
  const isEdit = !!existing

  const [sessionDate,  setSessionDate]  = useState(existing?.session_date   ?? todayISO())
  const [sessionType,  setSessionType]  = useState<RehabSession['session_type']>(existing?.session_type ?? 'physio')
  const [duration,     setDuration]     = useState(existing?.duration_minutes?.toString() ?? '')
  const [description,  setDescription]  = useState(existing?.description    ?? '')
  const [clinician,    setClinician]    = useState(existing?.clinician_name  ?? '')
  const [notes,        setNotes]        = useState(existing?.notes           ?? '')

  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--aura-green)]"
  const inputStyle = { background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }

  async function handleSave() {
    if (!sessionDate) { setError('Data da sessão obrigatória.'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        session_date:     sessionDate,
        session_type:     sessionType,
        duration_minutes: duration ? Number(duration) : null,
        description:      description.trim() || null,
        clinician_name:   clinician.trim()   || null,
        notes:            notes.trim()       || null,
      }

      let res: Response
      if (isEdit && existing) {
        res = await fetch(`/api/athletes/${athleteId}/rehab-sessions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: existing.id, ...payload }),
        })
      } else {
        res = await fetch(`/api/athletes/${athleteId}/rehab-sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Erro ao guardar')
      }
      onSaved(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/athletes/${athleteId}/rehab-sessions?sessionId=${existing.id}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status !== 204) throw new Error('Erro ao eliminar')
      onDeleted?.(existing.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col max-h-[90vh]"
        style={{ background: 'var(--aura-bg)', borderColor: 'var(--aura-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--aura-border)' }}>
          <div className="flex items-center gap-2">
            <Activity size={14} style={{ color: 'var(--aura-green)' }} />
            <p className="text-sm font-bold" style={{ color: 'var(--aura-text)' }}>
              {isEdit ? 'Editar Sessão' : 'Nova Sessão de Reabilitação'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
            <X size={14} style={{ color: 'var(--aura-text3)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Date + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Data *
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Duração (min)
              </label>
              <input
                type="number"
                min={5}
                max={300}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Ex: 60"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Session type */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
              Tipo de Sessão
            </label>
            <div className="flex flex-wrap gap-2">
              {SESSION_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setSessionType(t.value)}
                  className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                  style={{
                    borderColor: sessionType === t.value ? 'var(--aura-green)' : 'var(--aura-border)',
                    background:  sessionType === t.value ? 'var(--aura-green-bg)' : 'var(--aura-bg2)',
                    color:       sessionType === t.value ? 'var(--aura-green)' : 'var(--aura-text3)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
              Descrição / Exercícios
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreve os exercícios ou protocolo…"
              rows={3}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Clinician + notes */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
              Fisioterapeuta / Clínico
            </label>
            <input
              value={clinician}
              onChange={(e) => setClinician(e.target.value)}
              placeholder="Nome do profissional"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais…"
              rows={2}
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
                Eliminar
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
              {saving ? 'A guardar…' : isEdit ? 'Guardar' : 'Criar Sessão'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
