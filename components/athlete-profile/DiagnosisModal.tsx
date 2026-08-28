'use client'

import { useState, useMemo } from 'react'
import { Search, X, Loader2, Activity, CheckCircle2 } from 'lucide-react'
import { createDiagnosis, updateDiagnosis, getSuggestedProtocol, startRehabProtocol } from '@/lib/actions/clinical'
import type { SuggestedProtocol } from '@/lib/actions/clinical'
import { searchOsiics, OSIICS_FOOTBALL } from '@/lib/data/osiics'
import type { OsiicsEntry } from '@/lib/data/osiics'
import type { ActiveOccurrence } from '@/types/athlete-profile'

const STATUS_OPTIONS = [
  { value: 'available',   label: '🟢 Disponível',   color: 'var(--sophi-green)',   bg: 'var(--sophi-green-bg)'           },
  { value: 'evaluation',  label: '🟡 Em Avaliação', color: 'var(--sophi-warn)',    bg: 'var(--sophi-warn-bg)'            },
  { value: 'unavailable', label: '🔴 Indisponível', color: 'var(--sophi-danger)',  bg: 'var(--sophi-danger-bg)'          },
  { value: 'rtp',         label: '🟣 Em RTP',        color: 'var(--sophi-purple)', bg: 'rgba(180,141,252,0.12)'         },
]

export interface ExistingDiagnosis {
  id: string
  osiics_code: string | null
  osiics_description: string | null
  diagnosis_type: string | null
  custom_description: string | null
  availability_status: string | null
  occurrence_id: string | null
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
  const [osiicsQuery,     setOsiicsQuery]     = useState('')
  const [selectedOsiics,  setSelectedOsiics]  = useState<OsiicsEntry | null>(() => {
    if (!existing?.osiics_code) return null
    // The static OSIICS table may not contain a code saved before it changed —
    // fall back to a synthetic entry so the saved code/description still shows.
    return OSIICS_FOOTBALL.find((e) => e.code === existing.osiics_code) ?? {
      code: existing.osiics_code,
      description: existing.osiics_description ?? '',
      bodyPart: '',
      category: existing.diagnosis_type === 'disease' ? 'disease' : 'injury',
    }
  })
  const osiicsResults = useMemo(() => osiicsQuery.length < 2 ? [] : searchOsiics(osiicsQuery), [osiicsQuery])
  const [diagnosisType,   setDiagnosisType]   = useState<'injury' | 'disease'>(existing?.diagnosis_type === 'disease' ? 'disease' : 'injury')
  const [customDesc,      setCustomDesc]      = useState(existing?.custom_description ?? '')
  const [status,          setStatus]          = useState(existing?.availability_status ?? 'evaluation')
  // Pre-select when there's exactly one candidate (e.g. opened from a specific
  // occurrence row) so the link isn't silently dropped by an unclicked dropdown.
  const [occurrenceId,    setOccurrenceId]    = useState(existing?.occurrence_id ?? (occurrences.length === 1 ? occurrences[0].id : ''))
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [suggestion,      setSuggestion]      = useState<SuggestedProtocol | null | 'loading'>(null)
  const [startingRehab,   setStartingRehab]   = useState(false)

  async function handleSave() {
    if (!selectedOsiics && !customDesc.trim()) {
      setError('Seleciona um diagnóstico OSIICS ou escreve uma descrição')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (isEdit && existing) {
        await updateDiagnosis({
          diagnosisId:        existing.id,
          osiicsCode:         selectedOsiics?.code ?? null,
          osiicsDescription:  selectedOsiics?.description ?? null,
          diagnosisType,
          customDescription:  customDesc.trim() || null,
          availabilityStatus: status as 'available' | 'evaluation' | 'unavailable' | 'rtp',
          occurrenceId:       occurrenceId || null,
        })
        onSaved()
      } else {
        await createDiagnosis({
          athleteId,
          osiicsCode:         selectedOsiics?.code ?? null,
          osiicsDescription:  selectedOsiics?.description ?? null,
          diagnosisType,
          customDescription:  customDesc.trim() || null,
          availabilityStatus: status as 'available' | 'evaluation' | 'unavailable' | 'rtp',
          occurrenceId:       occurrenceId || null,
        })
        // After creation, check for a suggested protocol (injury only)
        if (selectedOsiics?.protocolKey && diagnosisType === 'injury') {
          setSuggestion('loading')
          const proto = await getSuggestedProtocol(selectedOsiics.protocolKey)
          setSuggestion(proto)
          if (!proto) onSaved() // no protocol found — close normally
        } else {
          onSaved()
        }
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleStartRehab() {
    if (!suggestion || suggestion === 'loading') return
    setStartingRehab(true)
    try {
      await startRehabProtocol(athleteId, suggestion.id, occurrenceId || null)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
      setStartingRehab(false)
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
          <h3 className="font-semibold" style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}>
            {isEdit ? 'Editar Diagnóstico' : 'Novo Diagnóstico'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X size={16} style={{ color: 'var(--sophi-text3)' }} />
          </button>
        </div>

        {/* Type selector */}
        <div className="flex gap-2">
          {(['injury', 'disease'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDiagnosisType(t)}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              style={{
                background: diagnosisType === t ? 'var(--sophi-green)' : 'var(--sophi-bg3)',
                color:      diagnosisType === t ? '#000'               : 'var(--sophi-text2)',
                borderColor: diagnosisType === t ? 'var(--sophi-green)' : 'var(--sophi-border)',
              }}
            >
              {t === 'injury' ? 'Lesão' : 'Doença'}
            </button>
          ))}
        </div>

        {/* OSIICS search */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
            Pesquisa OSIICS
          </label>
          {selectedOsiics ? (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border"
              style={{ background: 'var(--sophi-green-bg)', borderColor: 'var(--sophi-green)' }}
            >
              <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--sophi-green)' }}>
                {selectedOsiics.code}
              </span>
              <span className="flex-1 text-xs" style={{ color: 'var(--sophi-text)' }}>
                {selectedOsiics.description}
              </span>
              <button
                type="button"
                onClick={() => { setSelectedOsiics(null); setOsiicsQuery('') }}
              >
                <X size={12} style={{ color: 'var(--sophi-text3)' }} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--sophi-text3)' }} />
              <input
                value={osiicsQuery}
                onChange={(e) => setOsiicsQuery(e.target.value)}
                placeholder="isquiotibial, tornozelo, lombar…"
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs border focus:outline-none"
                style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
              />
              {osiicsResults.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border shadow-lg overflow-auto max-h-48"
                  style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}
                >
                  {osiicsResults.slice(0, 8).map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--sophi-bg3)] flex items-center gap-2"
                      onClick={() => {
                        setSelectedOsiics(r)
                        setOsiicsQuery('')
                        // The OSIICS entry's own category is authoritative — align
                        // diagnosisType to it so a disease code isn't saved as an
                        // injury (or vice versa), which would corrupt reporting.
                        if (r.category === 'injury' || r.category === 'disease') setDiagnosisType(r.category)
                      }}
                    >
                      <span className="font-mono text-[10px] shrink-0" style={{ color: 'var(--sophi-text3)' }}>
                        {r.code}
                      </span>
                      <span style={{ color: 'var(--sophi-text)' }}>{r.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Custom description */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
            Descrição personalizada (opcional)
          </label>
          <input
            value={customDesc}
            onChange={(e) => setCustomDesc(e.target.value)}
            placeholder="Descrição livre do diagnóstico"
            className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
            style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
          />
        </div>

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

        {/* Protocol suggestion step */}
        {suggestion && suggestion !== 'loading' && (
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{ background: 'var(--sophi-green-bg)', borderColor: 'var(--sophi-green)' }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} style={{ color: 'var(--sophi-green)' }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--sophi-green)' }}>
                Diagnóstico guardado · Protocolo disponível
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div
                className="w-1 self-stretch rounded-full"
                style={{ background: suggestion.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--sophi-text)' }}>
                  {suggestion.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--sophi-text2)' }}>
                  {suggestion.total_days} dias
                  {suggestion.return_days_min && suggestion.return_days_max
                    ? ` · RTP estimado ${suggestion.return_days_min}–${suggestion.return_days_max}d`
                    : ''}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSaved()}
                className="flex-1 px-3 py-2 rounded-lg text-xs border hover:bg-[var(--sophi-bg3)]"
                style={{ borderColor: 'var(--sophi-border)', color: 'var(--sophi-text2)' }}
              >
                Ignorar
              </button>
              <button
                type="button"
                onClick={handleStartRehab}
                disabled={startingRehab}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                style={{ background: 'var(--sophi-green)', color: '#000' }}
              >
                {startingRehab
                  ? <><Loader2 size={11} className="animate-spin" /> A iniciar…</>
                  : <><Activity size={11} /> Iniciar Protocolo</>
                }
              </button>
            </div>
          </div>
        )}

        {suggestion === 'loading' && (
          <div className="flex items-center gap-2 py-2" style={{ color: 'var(--sophi-text3)' }}>
            <Loader2 size={13} className="animate-spin" />
            <span className="text-xs">A procurar protocolo sugerido…</span>
          </div>
        )}

        {!suggestion && (
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
              style={{ background: 'var(--sophi-green)', color: '#000' }}
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
