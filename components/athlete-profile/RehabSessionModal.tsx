'use client'

import { useState } from 'react'
import { X, Check, Loader2, Activity, Trash2, Plus } from 'lucide-react'
import type { RehabSession, RehabSessionExercise, ActiveOccurrence } from '@/types/athlete-profile'

// ─────────────────────────────────────────────────────────────────────────────

const SESSION_TYPES: { value: RehabSession['session_type']; label: string }[] = [
  { value: 'physio',  label: 'Fisioterapia' },
  { value: 'gym',     label: 'Ginásio / Força' },
  { value: 'massage', label: 'Massagem' },
  { value: 'field',   label: 'Campo' },
  { value: 'other',   label: 'Outro' },
]

interface Props {
  athleteId: string
  existing?: RehabSession | null
  occurrences?: ActiveOccurrence[]
  onClose:   () => void
  onSaved:   (s: RehabSession) => void
  onDeleted?: (id: string) => void
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function emptyExercise(): RehabSessionExercise {
  return { name: '', sets: null, reps: null, load: null }
}

export function RehabSessionModal({ athleteId, existing, occurrences, onClose, onSaved, onDeleted }: Props) {
  const isEdit = !!existing

  const [sessionDate,  setSessionDate]  = useState(existing?.session_date   ?? todayISO())
  const [sessionType,  setSessionType]  = useState<RehabSession['session_type']>(existing?.session_type ?? 'physio')
  const [duration,     setDuration]     = useState(existing?.duration_minutes?.toString() ?? '')
  const [description,  setDescription]  = useState(existing?.description    ?? '')
  const [clinician,    setClinician]    = useState(existing?.clinician_name  ?? '')
  const [notes,        setNotes]        = useState(existing?.notes           ?? '')
  const [occurrenceId, setOccurrenceId] = useState(existing?.occurrence_id   ?? '')
  const [pse,          setPse]          = useState(existing?.pse != null ? String(existing.pse) : '')
  const [exercises,    setExercises]    = useState<RehabSessionExercise[]>(
    existing?.exercises?.length ? existing.exercises : []
  )

  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--sophi-green)]"
  const inputStyle = { background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)', color: 'var(--sophi-text)' }

  function updateExercise(index: number, patch: Partial<RehabSessionExercise>) {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)))
  }

  function removeExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index))
  }

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
        occurrence_id:    occurrenceId || null,
        pse:              pse !== '' ? Number(pse) : null,
        exercises:        exercises.filter((ex) => ex.name.trim().length > 0),
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
        style={{ background: 'var(--sophi-bg)', borderColor: 'var(--sophi-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--sophi-border)' }}>
          <div className="flex items-center gap-2">
            <Activity size={14} style={{ color: 'var(--sophi-green)' }} />
            <p className="text-sm font-bold" style={{ color: 'var(--sophi-text)' }}>
              {isEdit ? 'Editar Sessão' : 'Nova Sessão de Reabilitação'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
            <X size={14} style={{ color: 'var(--sophi-text3)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Date + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
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
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
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
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
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
                    borderColor: sessionType === t.value ? 'var(--sophi-green)' : 'var(--sophi-border)',
                    background:  sessionType === t.value ? 'var(--sophi-green-bg)' : 'var(--sophi-bg2)',
                    color:       sessionType === t.value ? 'var(--sophi-green)' : 'var(--sophi-text3)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Occurrence / diagnosis association */}
          {occurrences && occurrences.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
                Ocorrência / Diagnóstico associado
              </label>
              <select
                value={occurrenceId}
                onChange={(e) => setOccurrenceId(e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Nenhuma</option>
                {occurrences.map((occ) => (
                  <option key={occ.id} value={occ.id}>
                    {(occ.title || occ.occurrence_type || 'Ocorrência')} — {occ.occurrence_date}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
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

          {/* Exercises */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
                Exercícios
              </label>
              <button
                type="button"
                onClick={() => setExercises((prev) => [...prev, emptyExercise()])}
                className="flex items-center gap-1 text-[11px] font-medium hover:opacity-80"
                style={{ color: 'var(--sophi-green)' }}
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>
            {exercises.length > 0 && (
              <div className="space-y-2">
                {exercises.map((ex, i) => (
                  <div key={i} className="grid grid-cols-[1fr_60px_70px_80px_auto] gap-1.5 items-center">
                    <input
                      value={ex.name}
                      onChange={(e) => updateExercise(i, { name: e.target.value })}
                      placeholder="Exercício"
                      className={inputClass}
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      min={0}
                      value={ex.sets ?? ''}
                      onChange={(e) => updateExercise(i, { sets: e.target.value ? Number(e.target.value) : null })}
                      placeholder="Séries"
                      className={inputClass}
                      style={inputStyle}
                    />
                    <input
                      value={ex.reps ?? ''}
                      onChange={(e) => updateExercise(i, { reps: e.target.value || null })}
                      placeholder="Reps"
                      className={inputClass}
                      style={inputStyle}
                    />
                    <input
                      value={ex.load ?? ''}
                      onChange={(e) => updateExercise(i, { load: e.target.value || null })}
                      placeholder="Carga"
                      className={inputClass}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => removeExercise(i)}
                      className="rounded-lg p-1.5 hover:bg-[var(--sophi-danger-bg)]"
                      style={{ color: 'var(--sophi-text3)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PSE */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
              PSE (0-10)
            </label>
            <input
              type="number"
              min={0}
              max={10}
              value={pse}
              onChange={(e) => setPse(e.target.value)}
              placeholder="Perceção de esforço da sessão"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Clinician + notes */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
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
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
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
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t shrink-0" style={{ borderColor: 'var(--sophi-border)' }}>
          <div>
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-[var(--sophi-danger-bg)]"
                style={{ color: 'var(--sophi-danger)' }}
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
              style={{ borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text2)' }}
            >
              Cancelar
            </button>
            <button
              type="button" onClick={handleSave}
              disabled={saving || deleting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
              style={{ background: 'var(--sophi-green)', color: '#000' }}
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
