'use client'

// Shared diagnosis-entry UI — type toggle, OSIICS search, custom description,
// diagnosis date, and the FIFA/UEFA injury-characterization section. Extracted
// out of DiagnosisModal so the reassessment flow (OccurrenceRow's "Indisponível"
// path, migration 098) can collect the same fields inline, atomically, instead
// of duplicating ~250 lines of markup.

import { useState, useMemo, useEffect } from 'react'
import { Search, X, ChevronDown, ChevronRight } from 'lucide-react'
import { searchOsiics, OSIICS_FOOTBALL } from '@/lib/data/osiics'
import { getAthletePastInjuryDiagnoses } from '@/lib/actions/clinical'
import type { PastInjuryDiagnosis } from '@/lib/actions/clinical'
import type { OsiicsEntry } from '@/lib/data/osiics'
import { todayStr } from '@/lib/utils/microcycle'

export const CONTEXT_OPTIONS = [
  { value: 'training', label: 'Treino' },
  { value: 'match', label: 'Jogo' },
  { value: 'outside_activity', label: 'Fora da atividade desportiva' },
]
export const MECHANISM_OPTIONS = [
  { value: 'traumatic', label: 'Traumática (início súbito)' },
  { value: 'overuse', label: 'Sobrecarga (início gradual)' },
]
export const CONTACT_TYPE_OPTIONS = [
  { value: 'direct_contact', label: 'Contacto direto' },
  { value: 'indirect_contact', label: 'Contacto indireto' },
  { value: 'non_contact', label: 'Sem contacto' },
]
export const PLAYER_ACTION_OPTIONS = [
  { value: 'sprint', label: 'Sprint / corrida' },
  { value: 'deceleration', label: 'Desaceleração' },
  { value: 'jump_landing', label: 'Salto / aterragem' },
  { value: 'shoot_pass', label: 'Remate / passe' },
  { value: 'tackle', label: 'Carrinho (tackle)' },
  { value: 'change_of_direction', label: 'Mudança de direção' },
  { value: 'other', label: 'Outro' },
]
export const BODY_REGION_OPTIONS = [
  { value: 'head_face', label: 'Cabeça / face' },
  { value: 'neck', label: 'Pescoço' },
  { value: 'trunk_spine', label: 'Tronco / coluna' },
  { value: 'shoulder_arm', label: 'Ombro / braço' },
  { value: 'hip_groin', label: 'Anca / virilha' },
  { value: 'thigh', label: 'Coxa' },
  { value: 'knee', label: 'Joelho' },
  { value: 'lower_leg', label: 'Perna' },
  { value: 'ankle', label: 'Tornozelo' },
  { value: 'foot', label: 'Pé' },
]
export const BODY_SIDE_OPTIONS = [
  { value: 'left', label: 'Esquerdo' },
  { value: 'right', label: 'Direito' },
  { value: 'bilateral', label: 'Bilateral' },
]
export const TISSUE_TYPE_OPTIONS = [
  { value: 'muscle_tendon', label: 'Muscular / tendinoso' },
  { value: 'ligament', label: 'Ligamentar' },
  { value: 'bone', label: 'Ósseo' },
  { value: 'joint_cartilage', label: 'Articular / cartilagem' },
  { value: 'nerve', label: 'Nervoso' },
  { value: 'skin', label: 'Cutâneo' },
]

export interface DiagnosisCoreValue {
  diagnosisType: 'injury' | 'disease'
  osiicsCode: string | null
  osiicsDescription: string | null
  customDesc: string
  diagnosisDate: string
  context: '' | 'training' | 'match' | 'outside_activity'
  matchMinute: string
  mechanism: '' | 'traumatic' | 'overuse'
  contactType: '' | 'direct_contact' | 'indirect_contact' | 'non_contact'
  playerAction: '' | 'sprint' | 'deceleration' | 'jump_landing' | 'shoot_pass' | 'tackle' | 'change_of_direction' | 'other'
  foulInvolved: boolean | null
  bodyRegion: '' | 'head_face' | 'neck' | 'trunk_spine' | 'shoulder_arm' | 'hip_groin' | 'thigh' | 'knee' | 'lower_leg' | 'ankle' | 'foot'
  bodySide: '' | 'left' | 'right' | 'bilateral'
  tissueType: '' | 'muscle_tendon' | 'ligament' | 'bone' | 'joint_cartilage' | 'nerve' | 'skin'
  isRecurrence: boolean
  relatedDiagnosisId: string
  claimFiled: boolean | null
}

interface ExistingCoreFields {
  diagnosis_type?: string | null
  osiics_code?: string | null
  osiics_description?: string | null
  custom_description?: string | null
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

export function initialDiagnosisCoreValue(existing?: ExistingCoreFields | null): DiagnosisCoreValue {
  return {
    diagnosisType: existing?.diagnosis_type === 'disease' ? 'disease' : 'injury',
    osiicsCode: existing?.osiics_code ?? null,
    osiicsDescription: existing?.osiics_description ?? null,
    customDesc: existing?.custom_description ?? '',
    diagnosisDate: existing?.diagnosis_date ?? todayStr(),
    context: (existing?.context as DiagnosisCoreValue['context']) ?? '',
    matchMinute: existing?.match_minute != null ? String(existing.match_minute) : '',
    mechanism: (existing?.mechanism as DiagnosisCoreValue['mechanism']) ?? '',
    contactType: (existing?.contact_type as DiagnosisCoreValue['contactType']) ?? '',
    playerAction: (existing?.player_action as DiagnosisCoreValue['playerAction']) ?? '',
    foulInvolved: existing?.foul_involved ?? null,
    bodyRegion: (existing?.body_region as DiagnosisCoreValue['bodyRegion']) ?? '',
    bodySide: (existing?.body_side as DiagnosisCoreValue['bodySide']) ?? '',
    tissueType: (existing?.tissue_type as DiagnosisCoreValue['tissueType']) ?? '',
    isRecurrence: existing?.is_recurrence ?? false,
    relatedDiagnosisId: existing?.related_diagnosis_id ?? '',
    claimFiled: existing?.claim_filed ?? null,
  }
}

// Characterization only travels for injuries — a disease diagnosis has none
// of this to say, and sending it would just be noise.
export function diagnosisCoreValueToCharacterization(v: DiagnosisCoreValue) {
  if (v.diagnosisType !== 'injury') return { diagnosisDate: v.diagnosisDate }
  return {
    diagnosisDate: v.diagnosisDate,
    context: v.context || null,
    matchMinute: v.context === 'match' && v.matchMinute ? Number(v.matchMinute) : null,
    mechanism: v.mechanism || null,
    contactType: v.mechanism === 'traumatic' ? (v.contactType || null) : null,
    playerAction: v.playerAction || null,
    foulInvolved: v.foulInvolved,
    bodyRegion: v.bodyRegion || null,
    bodySide: v.bodySide || null,
    tissueType: v.tissueType || null,
    isRecurrence: v.isRecurrence,
    relatedDiagnosisId: v.isRecurrence ? (v.relatedDiagnosisId || null) : null,
    claimFiled: v.claimFiled,
  }
}

interface DiagnosisCoreFieldsProps {
  athleteId: string
  value: DiagnosisCoreValue
  onChange: (patch: Partial<DiagnosisCoreValue>) => void
}

export function DiagnosisCoreFields({ athleteId, value, onChange }: DiagnosisCoreFieldsProps) {
  const [osiicsQuery, setOsiicsQuery] = useState('')
  const [charExpanded, setCharExpanded] = useState(!!(value.context || value.mechanism || value.bodyRegion))
  const [pastInjuries, setPastInjuries] = useState<PastInjuryDiagnosis[]>([])

  // The static OSIICS table may not contain a code saved before it changed —
  // fall back to a synthetic entry so the saved code/description still shows.
  const selectedOsiics: OsiicsEntry | null = value.osiicsCode
    ? OSIICS_FOOTBALL.find((e) => e.code === value.osiicsCode) ?? {
        code: value.osiicsCode,
        description: value.osiicsDescription ?? '',
        bodyPart: '',
        category: value.diagnosisType === 'disease' ? 'disease' : 'injury',
      }
    : null
  const osiicsResults = useMemo(() => osiicsQuery.length < 2 ? [] : searchOsiics(osiicsQuery), [osiicsQuery])

  useEffect(() => {
    if (!value.isRecurrence || pastInjuries.length > 0) return
    getAthletePastInjuryDiagnoses(athleteId).then(setPastInjuries).catch(() => {})
  }, [value.isRecurrence, athleteId, pastInjuries.length])

  return (
    <>
      {/* Type selector */}
      <div className="flex gap-2">
        {(['injury', 'disease'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ diagnosisType: t })}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{
              background: value.diagnosisType === t ? 'var(--sophi-accent)' : 'var(--sophi-bg3)',
              color:      value.diagnosisType === t ? 'var(--sophi-on-accent)' : 'var(--sophi-text2)',
              borderColor: value.diagnosisType === t ? 'var(--sophi-accent)' : 'var(--sophi-border)',
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
            <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--sophi-accent)' }}>
              {selectedOsiics.code}
            </span>
            <span className="flex-1 text-xs" style={{ color: 'var(--sophi-text)' }}>
              {selectedOsiics.description}
            </span>
            <button
              type="button"
              onClick={() => { onChange({ osiicsCode: null, osiicsDescription: null }); setOsiicsQuery('') }}
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
                      setOsiicsQuery('')
                      // The OSIICS entry's own category is authoritative — align
                      // diagnosisType to it so a disease code isn't saved as an
                      // injury (or vice versa), which would corrupt reporting.
                      onChange({
                        osiicsCode: r.code,
                        osiicsDescription: r.description,
                        diagnosisType: r.category === 'injury' || r.category === 'disease' ? r.category : value.diagnosisType,
                      })
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
          value={value.customDesc}
          onChange={(e) => onChange({ customDesc: e.target.value })}
          placeholder="Descrição livre do diagnóstico"
          className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
          style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
        />
      </div>

      {/* Diagnosis date — the clinical date, distinct from the immutable
          authorship timestamp (diagnosed_at), so a diagnosis can be
          logged for a day other than today (historical backfill). */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
          Data do diagnóstico
        </label>
        <input
          type="date"
          value={value.diagnosisDate}
          onChange={(e) => onChange({ diagnosisDate: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
          style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
        />
      </div>

      {/* Injury characterization — FIFA/UEFA consensus, phase 1 */}
      {value.diagnosisType === 'injury' && (
        <div className="rounded-lg border" style={{ borderColor: 'var(--sophi-border)' }}>
          <button
            type="button"
            onClick={() => setCharExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium"
            style={{ color: 'var(--sophi-text2)' }}
          >
            <span>Caracterização da Lesão (opcional)</span>
            {charExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {charExpanded && (
            <div className="px-3 pb-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Contexto</label>
                  <select
                    value={value.context}
                    onChange={(e) => onChange({ context: e.target.value as DiagnosisCoreValue['context'] })}
                    className="w-full px-2 py-1.5 rounded-md text-xs border"
                    style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                  >
                    <option value="">—</option>
                    {CONTEXT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {value.context === 'match' && (
                  <div className="space-y-1">
                    <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Minuto da lesão</label>
                    <input
                      type="number"
                      min={0}
                      max={130}
                      value={value.matchMinute}
                      onChange={(e) => onChange({ matchMinute: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-md text-xs border"
                      style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Mecanismo</label>
                  <select
                    value={value.mechanism}
                    onChange={(e) => onChange({ mechanism: e.target.value as DiagnosisCoreValue['mechanism'] })}
                    className="w-full px-2 py-1.5 rounded-md text-xs border"
                    style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                  >
                    <option value="">—</option>
                    {MECHANISM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {value.mechanism === 'traumatic' && (
                  <div className="space-y-1">
                    <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Tipo de contacto</label>
                    <select
                      value={value.contactType}
                      onChange={(e) => onChange({ contactType: e.target.value as DiagnosisCoreValue['contactType'] })}
                      className="w-full px-2 py-1.5 rounded-md text-xs border"
                      style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                    >
                      <option value="">—</option>
                      {CONTACT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Ação no momento</label>
                  <select
                    value={value.playerAction}
                    onChange={(e) => onChange({ playerAction: e.target.value as DiagnosisCoreValue['playerAction'] })}
                    className="w-full px-2 py-1.5 rounded-md text-xs border"
                    style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                  >
                    <option value="">—</option>
                    {PLAYER_ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {value.context === 'match' && (
                  <div className="space-y-1">
                    <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Falta assinalada?</label>
                    <select
                      value={value.foulInvolved === null ? '' : value.foulInvolved ? 'yes' : 'no'}
                      onChange={(e) => onChange({ foulInvolved: e.target.value === '' ? null : e.target.value === 'yes' })}
                      className="w-full px-2 py-1.5 rounded-md text-xs border"
                      style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                    >
                      <option value="">—</option>
                      <option value="yes">Sim</option>
                      <option value="no">Não</option>
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Região anatómica</label>
                  <select
                    value={value.bodyRegion}
                    onChange={(e) => onChange({ bodyRegion: e.target.value as DiagnosisCoreValue['bodyRegion'] })}
                    className="w-full px-2 py-1.5 rounded-md text-xs border"
                    style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                  >
                    <option value="">—</option>
                    {BODY_REGION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Lado</label>
                  <select
                    value={value.bodySide}
                    onChange={(e) => onChange({ bodySide: e.target.value as DiagnosisCoreValue['bodySide'] })}
                    className="w-full px-2 py-1.5 rounded-md text-xs border"
                    style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                  >
                    <option value="">—</option>
                    {BODY_SIDE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Tecido afetado</label>
                  <select
                    value={value.tissueType}
                    onChange={(e) => onChange({ tissueType: e.target.value as DiagnosisCoreValue['tissueType'] })}
                    className="w-full px-2 py-1.5 rounded-md text-xs border"
                    style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                  >
                    <option value="">—</option>
                    {TISSUE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Participação de sinistro?</label>
                  <select
                    value={value.claimFiled === null ? '' : value.claimFiled ? 'yes' : 'no'}
                    onChange={(e) => onChange({ claimFiled: e.target.value === '' ? null : e.target.value === 'yes' })}
                    className="w-full px-2 py-1.5 rounded-md text-xs border"
                    style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                  >
                    <option value="">—</option>
                    <option value="yes">Sim</option>
                    <option value="no">Não</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--sophi-text2)' }}>
                <input type="checkbox" checked={value.isRecurrence} onChange={(e) => onChange({ isRecurrence: e.target.checked })} />
                É recorrência de uma lesão anterior
              </label>
              {value.isRecurrence && (
                <select
                  value={value.relatedDiagnosisId}
                  onChange={(e) => onChange({ relatedDiagnosisId: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-md text-xs border"
                  style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                >
                  <option value="">— Diagnóstico anterior —</option>
                  {pastInjuries.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.diagnosis_date} · {(p.osiics_description ?? p.custom_description ?? '—').slice(0, 40)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
