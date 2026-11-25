'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, X, Loader2, Activity, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { createDiagnosis, updateDiagnosis, getSuggestedProtocol, startRehabProtocol, getAthletePastInjuryDiagnoses } from '@/lib/actions/clinical'
import type { SuggestedProtocol, PastInjuryDiagnosis } from '@/lib/actions/clinical'
import { searchOsiics, OSIICS_FOOTBALL } from '@/lib/data/osiics'
import { LoadManagementFields } from '@/components/shared/LoadManagementFields'
import type { OsiicsEntry } from '@/lib/data/osiics'
import type { ActiveOccurrence } from '@/types/athlete-profile'
import type { AthleteAvailabilityStatus } from '@/types'

const STATUS_OPTIONS = [
  { value: 'available',        label: '🟢 Disponível',      color: 'var(--sophi-green)',  bg: 'var(--sophi-green-bg)'  },
  { value: 'evaluation',       label: '🟡 Em Avaliação',    color: 'var(--sophi-warn)',   bg: 'var(--sophi-warn-bg)'   },
  { value: 'load_management',  label: '🟠 Gestão de Carga', color: 'var(--sophi-orange)', bg: 'var(--sophi-orange-bg)' },
  { value: 'unavailable',      label: '🔴 Indisponível',    color: 'var(--sophi-danger)', bg: 'var(--sophi-danger-bg)' },
  { value: 'rtp',              label: '🟣 Em RTP',           color: 'var(--sophi-purple)', bg: 'rgba(180,141,252,0.12)' },
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

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

const CONTEXT_OPTIONS = [
  { value: 'training', label: 'Treino' },
  { value: 'match', label: 'Jogo' },
  { value: 'outside_activity', label: 'Fora da atividade desportiva' },
]
const MECHANISM_OPTIONS = [
  { value: 'traumatic', label: 'Traumática (início súbito)' },
  { value: 'overuse', label: 'Sobrecarga (início gradual)' },
]
const CONTACT_TYPE_OPTIONS = [
  { value: 'direct_contact', label: 'Contacto direto' },
  { value: 'indirect_contact', label: 'Contacto indireto' },
  { value: 'non_contact', label: 'Sem contacto' },
]
const PLAYER_ACTION_OPTIONS = [
  { value: 'sprint', label: 'Sprint / corrida' },
  { value: 'deceleration', label: 'Desaceleração' },
  { value: 'jump_landing', label: 'Salto / aterragem' },
  { value: 'shoot_pass', label: 'Remate / passe' },
  { value: 'tackle', label: 'Carrinho (tackle)' },
  { value: 'change_of_direction', label: 'Mudança de direção' },
  { value: 'other', label: 'Outro' },
]
const BODY_REGION_OPTIONS = [
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
const BODY_SIDE_OPTIONS = [
  { value: 'left', label: 'Esquerdo' },
  { value: 'right', label: 'Direito' },
  { value: 'bilateral', label: 'Bilateral' },
]
const TISSUE_TYPE_OPTIONS = [
  { value: 'muscle_tendon', label: 'Muscular / tendinoso' },
  { value: 'ligament', label: 'Ligamentar' },
  { value: 'bone', label: 'Ósseo' },
  { value: 'joint_cartilage', label: 'Articular / cartilagem' },
  { value: 'nerve', label: 'Nervoso' },
  { value: 'skin', label: 'Cutâneo' },
]

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
  const [restrictions,    setRestrictions]    = useState<string[]>(existing?.load_management_restrictions ?? [])
  const [notes,           setNotes]           = useState(existing?.load_management_notes ?? '')
  // Pre-select when there's exactly one candidate (e.g. opened from a specific
  // occurrence row) so the link isn't silently dropped by an unclicked dropdown.
  const [occurrenceId,    setOccurrenceId]    = useState(existing?.occurrence_id ?? (occurrences.length === 1 ? occurrences[0].id : ''))
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [suggestion,      setSuggestion]      = useState<SuggestedProtocol | null | 'loading'>(null)
  const [startingRehab,   setStartingRehab]   = useState(false)

  // Injury characterization (FIFA/UEFA consensus, phase 1) — only meaningful
  // for diagnosisType === 'injury'. All optional.
  const [diagnosisDate,   setDiagnosisDate]   = useState(existing?.diagnosis_date ?? todayStr())
  const [charExpanded,    setCharExpanded]    = useState(!!(existing?.context || existing?.mechanism || existing?.body_region))
  const [context,         setContext]         = useState<'' | 'training' | 'match' | 'outside_activity'>((existing?.context as 'training' | 'match' | 'outside_activity') ?? '')
  const [matchMinute,     setMatchMinute]     = useState(existing?.match_minute != null ? String(existing.match_minute) : '')
  const [mechanism,       setMechanism]       = useState<'' | 'traumatic' | 'overuse'>((existing?.mechanism as 'traumatic' | 'overuse') ?? '')
  const [contactType,     setContactType]     = useState<'' | 'direct_contact' | 'indirect_contact' | 'non_contact'>((existing?.contact_type as 'direct_contact' | 'indirect_contact' | 'non_contact') ?? '')
  const [playerAction,    setPlayerAction]    = useState<'' | 'sprint' | 'deceleration' | 'jump_landing' | 'shoot_pass' | 'tackle' | 'change_of_direction' | 'other'>((existing?.player_action as 'sprint' | 'deceleration' | 'jump_landing' | 'shoot_pass' | 'tackle' | 'change_of_direction' | 'other') ?? '')
  const [foulInvolved,    setFoulInvolved]    = useState<boolean | null>(existing?.foul_involved ?? null)
  const [bodyRegion,      setBodyRegion]      = useState<'' | 'head_face' | 'neck' | 'trunk_spine' | 'shoulder_arm' | 'hip_groin' | 'thigh' | 'knee' | 'lower_leg' | 'ankle' | 'foot'>((existing?.body_region as 'head_face' | 'neck' | 'trunk_spine' | 'shoulder_arm' | 'hip_groin' | 'thigh' | 'knee' | 'lower_leg' | 'ankle' | 'foot') ?? '')
  const [bodySide,        setBodySide]        = useState<'' | 'left' | 'right' | 'bilateral'>((existing?.body_side as 'left' | 'right' | 'bilateral') ?? '')
  const [tissueType,      setTissueType]      = useState<'' | 'muscle_tendon' | 'ligament' | 'bone' | 'joint_cartilage' | 'nerve' | 'skin'>((existing?.tissue_type as 'muscle_tendon' | 'ligament' | 'bone' | 'joint_cartilage' | 'nerve' | 'skin') ?? '')
  const [isRecurrence,    setIsRecurrence]    = useState(existing?.is_recurrence ?? false)
  const [relatedDiagnosisId, setRelatedDiagnosisId] = useState(existing?.related_diagnosis_id ?? '')
  const [claimFiled,      setClaimFiled]      = useState(existing?.claim_filed ?? null)
  const [pastInjuries,    setPastInjuries]    = useState<PastInjuryDiagnosis[]>([])

  useEffect(() => {
    if (!isRecurrence || pastInjuries.length > 0) return
    getAthletePastInjuryDiagnoses(athleteId).then(setPastInjuries).catch(() => {})
  }, [isRecurrence, athleteId, pastInjuries.length])

  async function handleSave() {
    if (!selectedOsiics && !customDesc.trim()) {
      setError('Seleciona um diagnóstico OSIICS ou escreve uma descrição')
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Characterization only travels for injuries — a disease diagnosis
      // has none of this to say, and sending it would just be noise.
      const characterization = diagnosisType === 'injury' ? {
        diagnosisDate,
        context: context || null,
        matchMinute: context === 'match' && matchMinute ? Number(matchMinute) : null,
        mechanism: mechanism || null,
        contactType: mechanism === 'traumatic' ? (contactType || null) : null,
        playerAction: playerAction || null,
        foulInvolved,
        bodyRegion: bodyRegion || null,
        bodySide: bodySide || null,
        tissueType: tissueType || null,
        isRecurrence,
        relatedDiagnosisId: isRecurrence ? (relatedDiagnosisId || null) : null,
        claimFiled,
      } : { diagnosisDate }
      if (isEdit && existing) {
        await updateDiagnosis({
          diagnosisId:        existing.id,
          osiicsCode:         selectedOsiics?.code ?? null,
          osiicsDescription:  selectedOsiics?.description ?? null,
          diagnosisType,
          customDescription:  customDesc.trim() || null,
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
          osiicsCode:         selectedOsiics?.code ?? null,
          osiicsDescription:  selectedOsiics?.description ?? null,
          diagnosisType,
          customDescription:  customDesc.trim() || null,
          availabilityStatus: status as AthleteAvailabilityStatus,
          loadManagementRestrictions: restrictions,
          loadManagementNotes: notes.trim() || null,
          occurrenceId:       occurrenceId || null,
          ...characterization,
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
          <h3 className="font-semibold" style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-display)' }}>
            {isEdit ? 'Editar Diagnóstico' : 'Novo Diagnóstico'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--sophi-bg4)]">
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
                background: diagnosisType === t ? 'var(--sophi-accent)' : 'var(--sophi-bg3)',
                color:      diagnosisType === t ? 'var(--sophi-on-accent)' : 'var(--sophi-text2)',
                borderColor: diagnosisType === t ? 'var(--sophi-accent)' : 'var(--sophi-border)',
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

        {/* Diagnosis date — the clinical date, distinct from the immutable
            authorship timestamp (diagnosed_at), so a diagnosis can be
            logged for a day other than today (historical backfill). */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
            Data do diagnóstico
          </label>
          <input
            type="date"
            value={diagnosisDate}
            onChange={(e) => setDiagnosisDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
            style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
          />
        </div>

        {/* Injury characterization — FIFA/UEFA consensus, phase 1 */}
        {diagnosisType === 'injury' && (
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
                      value={context}
                      onChange={(e) => setContext(e.target.value as typeof context)}
                      className="w-full px-2 py-1.5 rounded-md text-xs border"
                      style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                    >
                      <option value="">—</option>
                      {CONTEXT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  {context === 'match' && (
                    <div className="space-y-1">
                      <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Minuto da lesão</label>
                      <input
                        type="number"
                        min={0}
                        max={130}
                        value={matchMinute}
                        onChange={(e) => setMatchMinute(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md text-xs border"
                        style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Mecanismo</label>
                    <select
                      value={mechanism}
                      onChange={(e) => setMechanism(e.target.value as typeof mechanism)}
                      className="w-full px-2 py-1.5 rounded-md text-xs border"
                      style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                    >
                      <option value="">—</option>
                      {MECHANISM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  {mechanism === 'traumatic' && (
                    <div className="space-y-1">
                      <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Tipo de contacto</label>
                      <select
                        value={contactType}
                        onChange={(e) => setContactType(e.target.value as typeof contactType)}
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
                      value={playerAction}
                      onChange={(e) => setPlayerAction(e.target.value as typeof playerAction)}
                      className="w-full px-2 py-1.5 rounded-md text-xs border"
                      style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                    >
                      <option value="">—</option>
                      {PLAYER_ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  {context === 'match' && (
                    <div className="space-y-1">
                      <label className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>Falta assinalada?</label>
                      <select
                        value={foulInvolved === null ? '' : foulInvolved ? 'yes' : 'no'}
                        onChange={(e) => setFoulInvolved(e.target.value === '' ? null : e.target.value === 'yes')}
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
                      value={bodyRegion}
                      onChange={(e) => setBodyRegion(e.target.value as typeof bodyRegion)}
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
                      value={bodySide}
                      onChange={(e) => setBodySide(e.target.value as typeof bodySide)}
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
                      value={tissueType}
                      onChange={(e) => setTissueType(e.target.value as typeof tissueType)}
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
                      value={claimFiled === null ? '' : claimFiled ? 'yes' : 'no'}
                      onChange={(e) => setClaimFiled(e.target.value === '' ? null : e.target.value === 'yes')}
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
                  <input type="checkbox" checked={isRecurrence} onChange={(e) => setIsRecurrence(e.target.checked)} />
                  É recorrência de uma lesão anterior
                </label>
                {isRecurrence && (
                  <select
                    value={relatedDiagnosisId}
                    onChange={(e) => setRelatedDiagnosisId(e.target.value)}
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

        {/* Protocol suggestion step */}
        {suggestion && suggestion !== 'loading' && (
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{ background: 'var(--sophi-green-bg)', borderColor: 'var(--sophi-green)' }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} style={{ color: 'var(--sophi-green)' }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--sophi-accent)' }}>
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
                style={{ background: 'var(--sophi-primary)', color: 'var(--sophi-on-primary)' }}
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
              style={{ background: 'var(--sophi-primary)', color: 'var(--sophi-on-primary)' }}
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
