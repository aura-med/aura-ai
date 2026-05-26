'use client'

import { useState } from 'react'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MedicalHistory, MedicationRecord, SurgicalRecord } from '@/types/athlete-profile'

interface Props {
  athleteId: string
  existing: MedicalHistory | null
  onClose: () => void
  onSaved: (h: MedicalHistory) => void
}

function Field({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--aura-green)]"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }}
    />
  )
}

export function MedicalHistoryModal({ athleteId, existing, onClose, onSaved }: Props) {
  const [height,       setHeight]       = useState(existing?.height_cm?.toString()   ?? '')
  const [weight,       setWeight]       = useState(existing?.weight_kg?.toString()   ?? '')
  const [bloodType,    setBloodType]    = useState(existing?.blood_type              ?? '')
  const [allergies,    setAllergies]    = useState(existing?.allergies               ?? '')
  const [intolerances, setIntolerances] = useState(existing?.intolerances            ?? '')
  const [notes,        setNotes]        = useState(existing?.notes                   ?? '')

  const [medications, setMedications] = useState<MedicationRecord[]>(
    existing?.medications ?? [],
  )
  const [surgeries, setSurgeries] = useState<SurgicalRecord[]>(
    existing?.surgical_history ?? [],
  )

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // ── Medication helpers ────────────────────────────────────────────────────

  function addMed() {
    setMedications((prev) => [...prev, { name: '', dosage: '', frequency: '' }])
  }

  function updateMed(i: number, field: keyof MedicationRecord, val: string) {
    setMedications((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  }

  function removeMed(i: number) {
    setMedications((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Surgical helpers ──────────────────────────────────────────────────────

  function addSurgery() {
    setSurgeries((prev) => [...prev, { procedure: '', date: '' }])
  }

  function updateSurgery(i: number, field: keyof SurgicalRecord, val: string) {
    setSurgeries((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
  }

  function removeSurgery(i: number) {
    setSurgeries((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const payload = {
        athlete_id:       athleteId,
        height_cm:        height       ? parseFloat(height)  : null,
        weight_kg:        weight       ? parseFloat(weight)  : null,
        blood_type:       bloodType    || null,
        allergies:        allergies    || null,
        intolerances:     intolerances || null,
        notes:            notes        || null,
        medications:      medications.filter((m) => m.name.trim()),
        surgical_history: surgeries.filter((s) => s.procedure.trim()),
      }

      const { data, error: dbErr } = await supabase
        .from('athletes_medical_history')
        .upsert(payload, { onConflict: 'athlete_id' })
        .select()
        .single()

      if (dbErr) throw new Error(dbErr.message)
      onSaved(data as MedicalHistory)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--aura-green)]"
  const inputStyle = { background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col max-h-[90vh]"
        style={{ background: 'var(--aura-bg)', borderColor: 'var(--aura-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--aura-border)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--aura-text)' }}>
            Dados Clínicos
          </p>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-white/10">
            <X size={15} style={{ color: 'var(--aura-text3)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Biometrics */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--aura-text3)' }}>
              Biometria
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Altura (cm)">
                <Input value={height} onChange={setHeight} placeholder="180" type="number" />
              </Field>
              <Field label="Peso (kg)">
                <Input value={weight} onChange={setWeight} placeholder="75.5" type="number" />
              </Field>
              <Field label="Grupo Sanguíneo">
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">—</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Intolerâncias">
                <Input value={intolerances} onChange={setIntolerances} placeholder="Lactose…" />
              </Field>
            </div>
          </div>

          {/* Allergies */}
          <Field label="Alergias">
            <Input value={allergies} onChange={setAllergies} placeholder="Penicilina, pólen…" />
          </Field>

          {/* Medications */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Medicação
              </p>
              <button type="button" onClick={addMed} className="flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--aura-green)' }}>
                <Plus size={10} /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {medications.map((m, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-4">
                    <input
                      value={m.name} onChange={(e) => updateMed(i, 'name', e.target.value)}
                      placeholder="Nome"
                      className={inputClass} style={inputStyle}
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      value={m.dosage} onChange={(e) => updateMed(i, 'dosage', e.target.value)}
                      placeholder="Dose"
                      className={inputClass} style={inputStyle}
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      value={m.frequency} onChange={(e) => updateMed(i, 'frequency', e.target.value)}
                      placeholder="Frequência"
                      className={inputClass} style={inputStyle}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <input
                      type="date" value={m.start_date ?? ''} onChange={(e) => updateMed(i, 'start_date', e.target.value)}
                      className={`${inputClass} col-span-1`} style={inputStyle}
                    />
                    <button type="button" onClick={() => removeMed(i)} className="p-1 rounded hover:bg-white/10 shrink-0">
                      <Trash2 size={12} style={{ color: 'var(--aura-danger)' }} />
                    </button>
                  </div>
                </div>
              ))}
              {medications.length === 0 && (
                <p className="text-xs text-center py-2" style={{ color: 'var(--aura-text3)' }}>Sem medicação</p>
              )}
            </div>
          </div>

          {/* Surgical history */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
                Histórico Cirúrgico
              </p>
              <button type="button" onClick={addSurgery} className="flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--aura-green)' }}>
                <Plus size={10} /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {surgeries.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <input
                      value={s.procedure} onChange={(e) => updateSurgery(i, 'procedure', e.target.value)}
                      placeholder="Procedimento"
                      className={inputClass} style={inputStyle}
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="date" value={s.date ?? ''} onChange={(e) => updateSurgery(i, 'date', e.target.value)}
                      className={inputClass} style={inputStyle}
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      value={s.hospital ?? ''} onChange={(e) => updateSurgery(i, 'hospital', e.target.value)}
                      placeholder="Hospital"
                      className={inputClass} style={inputStyle}
                    />
                  </div>
                  <div className="col-span-1 flex items-center">
                    <button type="button" onClick={() => removeSurgery(i)} className="p-1 rounded hover:bg-white/10">
                      <Trash2 size={12} style={{ color: 'var(--aura-danger)' }} />
                    </button>
                  </div>
                </div>
              ))}
              {surgeries.length === 0 && (
                <p className="text-xs text-center py-2" style={{ color: 'var(--aura-text3)' }}>Sem cirurgias</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <Field label="Notas Clínicas">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais…"
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-[var(--aura-green)]"
              style={inputStyle}
            />
          </Field>

          {error && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--aura-danger-bg)', color: 'var(--aura-danger)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t shrink-0" style={{ borderColor: 'var(--aura-border)' }}>
          <button
            type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium border hover:bg-white/5"
            style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text2)' }}
          >
            Cancelar
          </button>
          <button
            type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold"
            style={{ background: 'var(--aura-green)', color: '#000' }}
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
