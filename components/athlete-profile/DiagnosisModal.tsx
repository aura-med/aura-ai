'use client'

import { useState, useMemo } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { searchOsiics } from '@/lib/data/osiics'
import type { OsiicsEntry } from '@/lib/data/osiics'
import type { ActiveOccurrence } from '@/types/athlete-profile'

const STATUS_OPTIONS = [
  { value: 'available',   label: '🟢 Disponível',   color: 'var(--aura-green)',   bg: 'var(--aura-green-bg)'           },
  { value: 'evaluation',  label: '🟡 Em Avaliação', color: 'var(--aura-warn)',    bg: 'var(--aura-warn-bg)'            },
  { value: 'unavailable', label: '🔴 Indisponível', color: 'var(--aura-danger)',  bg: 'var(--aura-danger-bg)'          },
  { value: 'rtp',         label: '🟣 Em RTP',        color: 'var(--aura-purple)', bg: 'rgba(180,141,252,0.12)'         },
]

interface DiagnosisModalProps {
  athleteId: string
  occurrences: ActiveOccurrence[]
  onClose: () => void
  onSaved: () => void
}

export function DiagnosisModal({ athleteId, occurrences, onClose, onSaved }: DiagnosisModalProps) {
  const [osiicsQuery,     setOsiicsQuery]     = useState('')
  const [selectedOsiics,  setSelectedOsiics]  = useState<OsiicsEntry | null>(null)
  const osiicsResults = useMemo(() => osiicsQuery.length < 2 ? [] : searchOsiics(osiicsQuery), [osiicsQuery])
  const [diagnosisType,   setDiagnosisType]   = useState<'injury' | 'disease'>('injury')
  const [customDesc,      setCustomDesc]      = useState('')
  const [status,          setStatus]          = useState('evaluation')
  const [occurrenceId,    setOccurrenceId]    = useState('')
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  async function handleSave() {
    if (!selectedOsiics && !customDesc.trim()) {
      setError('Seleciona um diagnóstico OSIICS ou escreve uma descrição')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { data: prof } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user?.id ?? '')
        .single()

      const { error: insertErr } = await supabase.from('diagnoses').insert({
        athlete_id:          athleteId,
        org_id:              prof?.org_id ?? null,
        osiics_code:         selectedOsiics?.code ?? null,
        osiics_description:  selectedOsiics?.description ?? null,
        diagnosis_type:      diagnosisType,
        custom_description:  customDesc.trim() || null,
        availability_status: status,
        diagnosed_by:        user?.id ?? null,
        occurrence_id:       occurrenceId || null,
      })
      if (insertErr) throw insertErr

      // Recompute from all active issues (includes the new diagnosis just inserted)
      // so adding a less-restrictive diagnosis never downgrades a more-restricted athlete.
      const SEVERITY: Record<string, number> = { available: 0, evaluation: 1, rtp: 2, unavailable: 3 }
      const [{ data: occ }, { data: diag }, { data: ath }] = await Promise.all([
        supabase.from('occurrences').select('availability_status').eq('athlete_id', athleteId).eq('is_resolved', false),
        supabase.from('diagnoses').select('availability_status').eq('athlete_id', athleteId).eq('is_resolved', false),
        supabase.from('athletes').select('status').eq('id', athleteId).single(),
      ])
      const statuses = [...(occ ?? []), ...(diag ?? [])]
        .map((r) => r.availability_status as string | null)
        .filter((s): s is string => s != null && s in SEVERITY)
      // Legacy rehab flag keeps the athlete in RTP as a floor.
      if (ath?.status === 'rehab') statuses.push('rtp')
      const nextStatus = statuses.length === 0 ? status
        : statuses.reduce((worst, s) => SEVERITY[s] > SEVERITY[worst] ? s : worst)
      await supabase.rpc('update_athlete_availability', { p_athlete_id: athleteId, p_status: nextStatus })

      onSaved()
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
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
            Novo Diagnóstico
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X size={16} style={{ color: 'var(--aura-text3)' }} />
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
                background: diagnosisType === t ? 'var(--aura-green)' : 'var(--aura-bg3)',
                color:      diagnosisType === t ? '#000'               : 'var(--aura-text2)',
                borderColor: diagnosisType === t ? 'var(--aura-green)' : 'var(--aura-border)',
              }}
            >
              {t === 'injury' ? 'Lesão' : 'Doença'}
            </button>
          ))}
        </div>

        {/* OSIICS search */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
            Pesquisa OSIICS
          </label>
          {selectedOsiics ? (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border"
              style={{ background: 'var(--aura-green-bg)', borderColor: 'var(--aura-green)' }}
            >
              <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--aura-green)' }}>
                {selectedOsiics.code}
              </span>
              <span className="flex-1 text-xs" style={{ color: 'var(--aura-text)' }}>
                {selectedOsiics.description}
              </span>
              <button
                type="button"
                onClick={() => { setSelectedOsiics(null); setOsiicsQuery('') }}
              >
                <X size={12} style={{ color: 'var(--aura-text3)' }} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--aura-text3)' }} />
              <input
                value={osiicsQuery}
                onChange={(e) => setOsiicsQuery(e.target.value)}
                placeholder="isquiotibial, tornozelo, lombar…"
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs border focus:outline-none"
                style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}
              />
              {osiicsResults.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border shadow-lg overflow-auto max-h-48"
                  style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
                >
                  {osiicsResults.slice(0, 8).map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--aura-bg3)] flex items-center gap-2"
                      onClick={() => { setSelectedOsiics(r); setOsiicsQuery('') }}
                    >
                      <span className="font-mono text-[10px] shrink-0" style={{ color: 'var(--aura-text3)' }}>
                        {r.code}
                      </span>
                      <span style={{ color: 'var(--aura-text)' }}>{r.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Custom description */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
            Descrição personalizada (opcional)
          </label>
          <input
            value={customDesc}
            onChange={(e) => setCustomDesc(e.target.value)}
            placeholder="Descrição livre do diagnóstico"
            className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
            style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}
          />
        </div>

        {/* Availability status */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
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
                  background:  status === s.value ? s.bg             : 'var(--aura-bg3)',
                  color:       status === s.value ? s.color          : 'var(--aura-text3)',
                  borderColor: status === s.value ? s.color          : 'var(--aura-border)',
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
            <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
              Ligar a ocorrência (opcional)
            </label>
            <select
              value={occurrenceId}
              onChange={(e) => setOccurrenceId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
              style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}
            >
              <option value="">— Nenhuma —</option>
              {occurrences.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.occurrence_date} · {(o.subjective ?? o.occurrence_type ?? '—').slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p className="text-xs" style={{ color: 'var(--aura-danger)' }}>{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm border transition-colors hover:bg-[var(--aura-bg3)]"
            style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text2)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: 'var(--aura-green)', color: '#000' }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
