'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createDiagnosis, updateDiagnosis } from '@/lib/actions/clinical'
import { LoadManagementFields } from '@/components/shared/LoadManagementFields'
import {
  DiagnosisCoreFields,
  initialDiagnosisCoreValue,
  diagnosisCoreValueToCharacterization,
  type DiagnosisCoreValue,
} from '@/components/athlete-profile/DiagnosisCoreFields'
import type { ActiveOccurrence } from '@/types/athlete-profile'
import type { AthleteAvailabilityStatus } from '@/types'

// 'rtp' deliberately excluded (B7, user-confirmed): RTP is now reached only
// through a rehab plan's RTP-type phase (advance_rehab_plan_phase, 096),
// never picked directly on a diagnosis.
const STATUS_OPTIONS = [
  { value: 'available',        label: '🟢 Disponível',      color: 'var(--sophi-green)',  bg: 'var(--sophi-green-bg)'  },
  { value: 'evaluation',       label: '🟡 Em Avaliação',    color: 'var(--sophi-warn)',   bg: 'var(--sophi-warn-bg)'   },
  { value: 'load_management',  label: '🟠 Gestão de Carga', color: 'var(--sophi-orange)', bg: 'var(--sophi-orange-bg)' },
  { value: 'unavailable',      label: '🔴 Indisponível',    color: 'var(--sophi-danger)', bg: 'var(--sophi-danger-bg)' },
]

export interface ExistingDiagnosis {
  id: string
  osiics_code: string | null
  osiics_description: string | null
  diagnosis_type: string | null
  custom_description: string | null
  availability_status: string | null
  load_management_restrictions?: string[]
  load_management_notes?: string | null
  occurrence_id: string | null
  diagnosis_date?: string | null
  context?: string | null
  match_minute?: number | null
  mechanism?: string | null
  contact_type?: string | null
  player_action?: string | null
  foul_involved?: boolean | null
  body_region?: string | null
  body_side?: string | null
  tissue_type?: string | null
  is_recurrence?: boolean | null
  related_diagnosis_id?: string | null
  claim_filed?: boolean | null
}

interface DiagnosisModalProps {
  athleteId: string
  occurrences: ActiveOccurrence[]
  existing?: ExistingDiagnosis | null
  onClose: () => void
  onSaved: () => void
}

export function DiagnosisModal({ athleteId, occurrences, existing, onClose, onSaved }: DiagnosisModalProps) {
  const isEdit = !!existing
  const [core, setCore] = useState<DiagnosisCoreValue>(() => initialDiagnosisCoreValue(existing))
  function patchCore(patch: Partial<DiagnosisCoreValue>) {
    setCore((c) => ({ ...c, ...patch }))
  }
  const [status,          setStatus]          = useState(existing?.availability_status ?? 'evaluation')
  const [restrictions,    setRestrictions]    = useState<string[]>(existing?.load_management_restrictions ?? [])
  const [notes,           setNotes]           = useState(existing?.load_management_notes ?? '')
  // Pre-select when there's exactly one candidate (e.g. opened from a specific
  // occurrence row) so the link isn't silently dropped by an unclicked dropdown.
  const [occurrenceId,    setOccurrenceId]    = useState(existing?.occurrence_id ?? (occurrences.length === 1 ? occurrences[0].id : ''))
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  async function handleSave() {
    if (!core.osiicsCode && !core.customDesc.trim()) {
      setError('Seleciona um diagnóstico OSIICS ou escreve uma descrição')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const characterization = diagnosisCoreValueToCharacterization(core)
      if (isEdit && existing) {
        await updateDiagnosis({
          diagnosisId:        existing.id,
          osiicsCode:         core.osiicsCode,
          osiicsDescription:  core.osiicsDescription,
          diagnosisType:      core.diagnosisType,
          customDescription:  core.customDesc.trim() || null,
          availabilityStatus: status as AthleteAvailabilityStatus,
          loadManagementRestrictions: restrictions,
          loadManagementNotes: notes.trim() || null,
          occurrenceId:       occurrenceId || null,
          ...characterization,
        })
        onSaved()
      } else {
        await createDiagnosis({
          athleteId,
          osiicsCode:         core.osiicsCode,
          osiicsDescription:  core.osiicsDescription,
          diagnosisType:      core.diagnosisType,
          customDescription:  core.customDesc.trim() || null,
          availabilityStatus: status as AthleteAvailabilityStatus,
          loadManagementRestrictions: restrictions,
          loadManagementNotes: notes.trim() || null,
          occurrenceId:       occurrenceId || null,
          ...characterization,
        })
        onSaved()
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4"
        style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold" style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-display)' }}>
            {isEdit ? 'Editar Diagnóstico' : 'Novo Diagnóstico'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--sophi-bg4)]">
            <X size={16} style={{ color: 'var(--sophi-text3)' }} />
          </button>
        </div>

        <DiagnosisCoreFields athleteId={athleteId} value={core} onChange={patchCore} />

        {/* Availability status */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
            Estado de disponibilidade
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors text-left"
                style={{
                  background:  status === s.value ? s.bg             : 'var(--sophi-bg3)',
                  color:       status === s.value ? s.color          : 'var(--sophi-text3)',
                  borderColor: status === s.value ? s.color          : 'var(--sophi-border)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {status === 'load_management' && (
          <LoadManagementFields
            restrictions={restrictions}
            onRestrictionsChange={setRestrictions}
            notes={notes}
            onNotesChange={setNotes}
          />
        )}

        {/* Link to occurrence */}
        {occurrences.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
              Ligar a ocorrência (opcional)
            </label>
            <select
              value={occurrenceId}
              onChange={(e) => setOccurrenceId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
              style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
            >
              <option value="">— Nenhuma —</option>
              {occurrences.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.occurrence_date} · {(o.title ?? o.subjective ?? o.occurrence_type ?? '—').slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p className="text-xs" style={{ color: 'var(--sophi-danger)' }}>{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm border transition-colors hover:bg-[var(--sophi-bg3)]"
            style={{ borderColor: 'var(--sophi-border)', color: 'var(--sophi-text2)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: 'var(--sophi-primary)', color: 'var(--sophi-on-primary)' }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
