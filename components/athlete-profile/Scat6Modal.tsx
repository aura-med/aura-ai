'use client'

import { useState, useMemo } from 'react'
import { X, Loader2, Brain, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SCAT6_SYMPTOMS, SCAT6_SYMPTOM_LABELS } from '@/types/athlete-profile'
import type { Scat6Assessment, Scat6Symptom } from '@/types/athlete-profile'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

const STEPS = ['Informação', 'Sintomas', 'Cognitivo', 'Equilíbrio', 'Revisão'] as const
type Step = 0 | 1 | 2 | 3 | 4

// ─────────────────────────────────────────────────────────────────────────────
// Symptom stepper  0 – 6
// ─────────────────────────────────────────────────────────────────────────────

function SymptomRow({
  symptom, value, onChange,
}: {
  symptom: Scat6Symptom
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0"
      style={{ borderColor: 'var(--sophi-border)' }}>
      <p className="text-xs flex-1" style={{ color: value > 0 ? 'var(--sophi-text)' : 'var(--sophi-text3)' }}>
        {SCAT6_SYMPTOM_LABELS[symptom]}
      </p>
      <div className="flex items-center gap-1 shrink-0">
        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="w-6 h-6 rounded text-[10px] font-mono font-bold transition-colors"
            style={{
              background: value === n
                ? n === 0 ? 'var(--sophi-green)' : n <= 2 ? 'var(--sophi-warn)' : 'var(--sophi-danger)'
                : 'var(--sophi-bg3)',
              color: value === n ? '#000' : 'var(--sophi-text3)',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Score input row
// ─────────────────────────────────────────────────────────────────────────────

function ScoreInput({
  label, value, max, onChange, hint,
}: {
  label: string
  value: number | null
  max: number
  onChange: (v: number | null) => void
  hint?: string
}) {
  const inputClass = "w-20 rounded-lg border px-3 py-1.5 text-sm text-right font-mono outline-none focus:ring-1 focus:ring-[var(--sophi-green)]"
  const inputStyle = { background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)', color: 'var(--sophi-text)' }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-medium" style={{ color: 'var(--sophi-text)' }}>{label}</p>
        {hint && <p className="text-[10px] mt-0.5" style={{ color: 'var(--sophi-text3)' }}>{hint}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={max}
          value={value ?? ''}
          onChange={(e) => {
            const n = parseInt(e.target.value)
            onChange(isNaN(n) ? null : Math.min(max, Math.max(0, n)))
          }}
          className={inputClass}
          style={inputStyle}
          placeholder="—"
        />
        <span className="text-xs" style={{ color: 'var(--sophi-text3)' }}>/ {max}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  athleteId:   string
  existing?:   Scat6Assessment | null   // pass to edit; null/undefined = new baseline
  onClose:     () => void
  onSaved:     (a: Scat6Assessment) => void
}

const EMPTY_SYMPTOMS = Object.fromEntries(
  SCAT6_SYMPTOMS.map((s) => [s, 0])
) as Record<Scat6Symptom, number>

export function Scat6Modal({ athleteId, existing, onClose, onSaved }: Props) {
  const isEdit = !!existing

  // ── Step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(0)

  // ── Step 0 — info ─────────────────────────────────────────────────────────
  const currentSeason = (() => {
    const y = new Date().getFullYear()
    const m = new Date().getMonth()
    return m >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`
  })()

  const [season,        setSeason]        = useState(existing?.season       ?? currentSeason)
  const [incidentDate,  setIncidentDate]  = useState(existing?.incident_date ?? todayISO())
  const [isBaseline,    setIsBaseline]    = useState(existing?.is_baseline   ?? true)
  const [clinician,     setClinician]     = useState(existing?.clinician_name ?? '')
  const [context,       setContext]       = useState(existing?.context       ?? '')
  const [mechanism,     setMechanism]     = useState(existing?.mechanism     ?? '')
  const [loc,           setLoc]           = useState(existing?.loss_of_consciousness ?? false)
  const [locDuration,   setLocDuration]   = useState<number | null>(existing?.loc_duration_seconds ?? null)
  const [pta,           setPta]           = useState(existing?.post_traumatic_amnesia ?? false)
  const [ptaDuration,   setPtaDuration]   = useState<number | null>(existing?.pta_duration_minutes ?? null)

  // ── Step 1 — symptoms ─────────────────────────────────────────────────────
  const [symptoms, setSymptoms] = useState<Record<Scat6Symptom, number>>(
    existing?.symptoms ?? EMPTY_SYMPTOMS
  )

  function setSymptom(s: Scat6Symptom, v: number) {
    setSymptoms((prev) => ({ ...prev, [s]: v }))
  }

  const totalSymptomSeverity = useMemo(
    () => Object.values(symptoms).reduce((a, b) => a + b, 0),
    [symptoms]
  )
  const symptomCount = useMemo(
    () => Object.values(symptoms).filter((v) => v > 0).length,
    [symptoms]
  )

  // ── Step 2 — cognitive ────────────────────────────────────────────────────
  const [orientation,    setOrientation]    = useState<number | null>(existing?.orientation_score        ?? null)
  const [immediateMemory, setImmediateMemory] = useState<number | null>(existing?.immediate_memory_best ?? null)
  const [digitsBackward, setDigitsBackward] = useState<number | null>(existing?.digits_backward_score   ?? null)
  const [delayedRecall,  setDelayedRecall]  = useState<number | null>(existing?.delayed_recall           ?? null)

  // ── Step 3 — balance ──────────────────────────────────────────────────────
  const [balanceErrors, setBalanceErrors] = useState<number>(existing?.balance_total_errors ?? 0)

  // ── Computed total ────────────────────────────────────────────────────────
  const totalScat6Score = useMemo(() => {
    let score = totalSymptomSeverity
    if (orientation     !== null) score += orientation
    if (immediateMemory !== null) score += immediateMemory
    if (digitsBackward  !== null) score += digitsBackward
    if (delayedRecall   !== null) score += delayedRecall
    score += (30 - balanceErrors) // mBESS: fewer errors = better
    return score
  }, [totalSymptomSeverity, orientation, immediateMemory, digitsBackward, delayedRecall, balanceErrors])

  // ── Save ──────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const payload = {
        athlete_id:               athleteId,
        season,
        is_baseline:              isBaseline,
        incident_date:            isBaseline ? null : incidentDate || null,
        context:                  context  || null,
        mechanism:                mechanism || null,
        loss_of_consciousness:    loc,
        loc_duration_seconds:     loc ? locDuration : null,
        post_traumatic_amnesia:   pta,
        pta_duration_minutes:     pta ? ptaDuration : null,
        symptoms,
        total_symptom_severity:   totalSymptomSeverity,
        immediate_memory_best:    immediateMemory,
        delayed_recall:           delayedRecall,
        orientation_score:        orientation,
        digits_backward_score:    digitsBackward,
        balance_total_errors:     balanceErrors,
        total_scat6_score:        totalScat6Score,
        clinician_name:           clinician || null,
        rtp_current_stage:        isEdit ? (existing?.rtp_current_stage ?? 0) : 0,
        rtp_stages_completed:     isEdit ? (existing?.rtp_stages_completed ?? {}) : {},
      }

      let row: Scat6Assessment | null = null

      if (isEdit && existing) {
        const { data, error: err } = await supabase
          .from('scat6_assessments')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single()
        if (err) throw err
        row = data as Scat6Assessment
      } else {
        const { data, error: err } = await supabase
          .from('scat6_assessments')
          .insert(payload)
          .select()
          .single()
        if (err) throw err
        row = data as Scat6Assessment
      }

      onSaved(row!)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--sophi-green)]"
  const inputStyle = { background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)', color: 'var(--sophi-text)' }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col max-h-[90vh]"
        style={{ background: 'var(--sophi-bg)', borderColor: 'var(--sophi-border)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--sophi-border)' }}>
          <Brain size={16} style={{ color: 'var(--sophi-green)' }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: 'var(--sophi-text)' }}>
              {isEdit ? 'Editar SCAT-6' : isBaseline ? 'Nova Avaliação SCAT-6 Baseline' : 'Nova Avaliação SCAT-6'}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {STEPS.map((label, i) => (
                <div key={label} className="flex items-center gap-1">
                  <div
                    className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold transition-colors"
                    style={{
                      background: i < step ? 'var(--sophi-green)' : i === step ? 'var(--sophi-green-bg)' : 'var(--sophi-bg3)',
                      color:      i < step ? '#000' : i === step ? 'var(--sophi-green)' : 'var(--sophi-text3)',
                    }}
                  >
                    {i < step ? <Check size={9} /> : i + 1}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-4 h-px" style={{ background: i < step ? 'var(--sophi-green)' : 'var(--sophi-border)' }} />
                  )}
                </div>
              ))}
              <p className="ml-2 text-[10px]" style={{ color: 'var(--sophi-text3)' }}>{STEPS[step]}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
            <X size={15} style={{ color: 'var(--sophi-text3)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Step 0: Info ─────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBaseline}
                    onChange={(e) => setIsBaseline(e.target.checked)}
                    className="w-4 h-4 accent-[var(--sophi-green)] rounded"
                  />
                  <span className="text-sm font-medium" style={{ color: 'var(--sophi-text)' }}>Esta é uma avaliação baseline</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
                    Época *
                  </label>
                  <input
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    placeholder="2024/2025"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                {!isBaseline && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
                      Data do Incidente
                    </label>
                    <input
                      type="date"
                      value={incidentDate}
                      onChange={(e) => setIncidentDate(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
                    Clínico
                  </label>
                  <input
                    value={clinician}
                    onChange={(e) => setClinician(e.target.value)}
                    placeholder="Nome do clínico"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>

              {!isBaseline && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
                      Contexto
                    </label>
                    <input value={context} onChange={(e) => setContext(e.target.value)} placeholder="Ex: treino, jogo, queda…" className={inputClass} style={inputStyle} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
                      Mecanismo
                    </label>
                    <input value={mechanism} onChange={(e) => setMechanism(e.target.value)} placeholder="Ex: cabeçada, queda, colisão…" className={inputClass} style={inputStyle} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={loc} onChange={(e) => setLoc(e.target.checked)} className="w-4 h-4 accent-[var(--sophi-green)]" />
                        <span className="text-sm" style={{ color: 'var(--sophi-text)' }}>Perda de consciência</span>
                      </label>
                      {loc && (
                        <input
                          type="number"
                          value={locDuration ?? ''}
                          onChange={(e) => setLocDuration(parseInt(e.target.value) || null)}
                          placeholder="Segundos"
                          className={inputClass}
                          style={inputStyle}
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={pta} onChange={(e) => setPta(e.target.checked)} className="w-4 h-4 accent-[var(--sophi-green)]" />
                        <span className="text-sm" style={{ color: 'var(--sophi-text)' }}>Amnésia pós-traumática</span>
                      </label>
                      {pta && (
                        <input
                          type="number"
                          value={ptaDuration ?? ''}
                          onChange={(e) => setPtaDuration(parseInt(e.target.value) || null)}
                          placeholder="Minutos"
                          className={inputClass}
                          style={inputStyle}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Step 1: Symptoms ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--sophi-text3)' }}>
                  Classifica cada sintoma de <strong>0</strong> (ausente) a <strong>6</strong> (grave).
                </p>
                <div className="flex gap-3 text-xs font-mono font-bold">
                  <span style={{ color: 'var(--sophi-text3)' }}>{symptomCount} sintomas</span>
                  <span style={{ color: totalSymptomSeverity > 0 ? 'var(--sophi-danger)' : 'var(--sophi-green)' }}>
                    {totalSymptomSeverity} / 132
                  </span>
                </div>
              </div>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--sophi-border)' }}>
                <div className="px-3 py-1 flex justify-end gap-1 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                    <span key={n} className="w-6 text-center text-[10px] font-mono font-bold" style={{ color: 'var(--sophi-text3)' }}>{n}</span>
                  ))}
                </div>
                <div className="px-3 divide-y divide-[var(--sophi-border)]">
                  {SCAT6_SYMPTOMS.map((s) => (
                    <SymptomRow key={s} symptom={s} value={symptoms[s]} onChange={(v) => setSymptom(s, v)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Cognitive ────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: 'var(--sophi-text3)' }}>
                Regista os resultados dos testes cognitivos. Deixa em branco se não foram realizados.
              </p>
              <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: 'var(--sophi-border)' }}>
                <ScoreInput
                  label="Orientação"
                  hint="Dia, mês, ano, dia da semana, hora"
                  value={orientation}
                  max={5}
                  onChange={setOrientation}
                />
                <ScoreInput
                  label="Memória Imediata (melhor de 3)"
                  hint="3 ensaios × 5 palavras (máx. 15)"
                  value={immediateMemory}
                  max={15}
                  onChange={setImmediateMemory}
                />
                <ScoreInput
                  label="Dígitos Invertidos"
                  hint="Maior sequência completada"
                  value={digitsBackward}
                  max={4}
                  onChange={setDigitsBackward}
                />
                <ScoreInput
                  label="Memória Deferida"
                  hint="5 palavras após 15 min (máx. 10)"
                  value={delayedRecall}
                  max={10}
                  onChange={setDelayedRecall}
                />
              </div>
            </div>
          )}

          {/* ── Step 3: Balance (mBESS) ──────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: 'var(--sophi-text3)' }}>
                mBESS — Modified Balance Error Scoring System. Regista o total de erros (máx. 30).
                Menos erros = melhor equilíbrio.
              </p>
              <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: 'var(--sophi-border)' }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--sophi-text)' }}>Total de Erros mBESS</p>
                    <p className="text-[10px]" style={{ color: 'var(--sophi-text3)' }}>3 posições × 10 erros máx. cada</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setBalanceErrors(Math.max(0, balanceErrors - 1))}
                      className="w-8 h-8 rounded-full text-lg font-bold flex items-center justify-center hover:opacity-70"
                      style={{ background: 'var(--sophi-bg3)', color: 'var(--sophi-text)' }}
                    >
                      −
                    </button>
                    <span className="text-2xl font-bold font-mono w-10 text-center" style={{ color: 'var(--sophi-text)' }}>
                      {balanceErrors}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBalanceErrors(Math.min(30, balanceErrors + 1))}
                      className="w-8 h-8 rounded-full text-lg font-bold flex items-center justify-center hover:opacity-70"
                      style={{ background: 'var(--sophi-bg3)', color: 'var(--sophi-text)' }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--sophi-bg3)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(balanceErrors / 30) * 100}%`,
                      background: balanceErrors === 0 ? 'var(--sophi-green)' : balanceErrors <= 10 ? 'var(--sophi-warn)' : 'var(--sophi-danger)',
                    }}
                  />
                </div>
                <p className="text-[10px] text-center" style={{ color: 'var(--sophi-text3)' }}>
                  {balanceErrors} erros — {30 - balanceErrors} pontos mBESS
                </p>
              </div>
            </div>
          )}

          {/* ── Step 4: Review ───────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
                Resumo da Avaliação
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Época',             value: season },
                  { label: 'Tipo',              value: isBaseline ? 'Baseline' : 'Incidente' },
                  { label: 'Clínico',           value: clinician || '—' },
                  { label: 'Sintomas activos',  value: `${symptomCount} sintomas` },
                  { label: 'Severidade total',  value: `${totalSymptomSeverity} / 132` },
                  { label: 'Orientação',        value: orientation !== null ? `${orientation} / 5` : '—' },
                  { label: 'Memória imediata',  value: immediateMemory !== null ? `${immediateMemory} / 15` : '—' },
                  { label: 'Dígitos invertidos', value: digitsBackward !== null ? `${digitsBackward} / 4` : '—' },
                  { label: 'Memória deferida',  value: delayedRecall !== null ? `${delayedRecall} / 10` : '—' },
                  { label: 'Erros equilíbrio',  value: `${balanceErrors} / 30` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg p-3" style={{ background: 'var(--sophi-bg3)' }}>
                    <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--sophi-text3)' }}>{label}</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--sophi-text)' }}>{value}</p>
                  </div>
                ))}
              </div>
              <div
                className="rounded-xl p-4 flex items-center justify-between"
                style={{ background: 'var(--sophi-green-bg)', border: '1px solid var(--sophi-green)' }}
              >
                <p className="text-sm font-bold" style={{ color: 'var(--sophi-green)' }}>Score SCAT-6 Total</p>
                <p className="text-2xl font-bold font-mono" style={{ color: 'var(--sophi-green)' }}>{totalScat6Score}</p>
              </div>
              {error && (
                <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}>
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t shrink-0" style={{ borderColor: 'var(--sophi-border)' }}>
          <button
            type="button"
            onClick={() => step > 0 ? setStep((s) => (s - 1) as Step) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border hover:bg-white/5"
            style={{ borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text2)' }}
          >
            <ChevronLeft size={12} />
            {step === 0 ? 'Cancelar' : 'Anterior'}
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as Step)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold"
              style={{ background: 'var(--sophi-green)', color: '#000' }}
            >
              Próximo
              <ChevronRight size={12} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
              style={{ background: 'var(--sophi-green)', color: '#000' }}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {saving ? 'A guardar…' : 'Guardar SCAT-6'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
