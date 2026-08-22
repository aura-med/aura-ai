'use client'

import { useState, useEffect, useMemo } from 'react'
import { Apple, Plus, Loader2, Edit2, Scale, Pill, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OWNER_ROLE } from '@/lib/roles'
import {
  SKINFOLD_FIELDS, PERIMETER_FIELDS,
} from '@/types/athlete-profile'
import type {
  AthleteProfileData, AthleteDailyWeight, NutritionAssessment, AthleteSupplement,
} from '@/types/athlete-profile'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}

function skinfoldSum(a: NutritionAssessment): number | null {
  const values = SKINFOLD_FIELDS.map((f) => a[f.key as keyof NutritionAssessment] as number | null)
  if (values.some((v) => v == null)) return null
  return (values as number[]).reduce((acc: number, v) => acc + v, 0)
}

function urineColor(sg: number | null): { label: string; color: string; bg: string } | null {
  if (sg == null) return null
  if (sg <= 1.020) return { label: 'Verde',   color: '#16a34a', bg: 'rgba(22,163,74,0.14)' }
  if (sg <= 1.025) return { label: 'Amarelo', color: '#eab308', bg: 'rgba(234,179,8,0.14)' }
  if (sg <= 1.030) return { label: 'Laranja', color: '#f97316', bg: 'rgba(249,115,22,0.14)' }
  return { label: 'Vermelho', color: '#dc2626', bg: 'rgba(220,38,38,0.14)' }
}

function todayStr() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const inputCls = 'w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none'
const inputStyle = { background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }

// ── Skinfold sum chart ───────────────────────────────────────────────────────

function SkinfoldChart({ assessments, limit }: { assessments: NutritionAssessment[]; limit: number | null }) {
  const points = useMemo(() => {
    return assessments
      .map((a) => ({ date: a.assessment_date, sum: skinfoldSum(a) }))
      .filter((p): p is { date: string; sum: number } => p.sum != null)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [assessments])

  if (points.length === 0) return null

  const width = 360
  const height = 110
  const chartTop = 8
  const chartHeight = 70
  const maxVal = Math.max(limit ?? 0, ...points.map((p) => p.sum)) * 1.1 || 1
  const step = points.length > 1 ? width / (points.length - 1) : width
  const xy = points.map((p, i) => ({
    ...p,
    x: i * step,
    y: chartTop + chartHeight - (p.sum / maxVal) * chartHeight,
  }))
  const linePath = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const limitY = limit != null ? chartTop + chartHeight - (limit / maxVal) * chartHeight : null

  return (
    <div className="h-[120px]">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução da soma das pregas cutâneas" className="h-full w-full overflow-visible">
        {[0, 1, 2].map((l) => {
          const y = chartTop + (chartHeight / 2) * l
          return <line key={l} x1="0" x2={width} y1={y} y2={y} stroke="var(--sophi-border)" strokeDasharray="3 3" />
        })}
        {limitY != null && (
          <>
            <line x1="0" x2={width} y1={limitY} y2={limitY} stroke="var(--sophi-danger)" strokeWidth="1.5" strokeDasharray="4 3" />
            <text x={width - 2} y={limitY - 3} textAnchor="end" fontSize="9" fill="var(--sophi-danger)">limite {limit}mm</text>
          </>
        )}
        <path d={linePath} fill="none" stroke="var(--sophi-green)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {xy.map((p) => (
          <g key={p.date}>
            <circle cx={p.x} cy={p.y} r={3} fill="var(--sophi-green)" />
            <text x={p.x} y="100" textAnchor="middle" fontSize="9" fill="var(--sophi-text3)">{formatDate(p.date)}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── Daily weight modal ───────────────────────────────────────────────────────

function DailyWeightModal({
  athleteId, onClose, onSaved,
}: { athleteId: string; onClose: () => void; onSaved: (w: AthleteDailyWeight) => void }) {
  const [date,   setDate]   = useState(todayStr)
  const [weight, setWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSave() {
    const kg = Number(weight)
    if (!weight || Number.isNaN(kg) || kg <= 0) { setError('Peso inválido'); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: upsertError } = await supabase
        .from('athlete_daily_weight')
        .upsert({ athlete_id: athleteId, measurement_date: date, weight_kg: kg }, { onConflict: 'athlete_id,measurement_date' })
        .select('*')
        .single()
      if (upsertError || !data) { setError('Não foi possível guardar. Sem permissão ou erro de ligação.'); return }
      onSaved(data as AthleteDailyWeight)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs rounded-2xl border shadow-2xl p-5 space-y-4" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}>Registar Peso</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Peso (kg)</label>
            <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="ex: 78.4" className={inputCls} style={inputStyle} />
          </div>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--sophi-danger)' }}>{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm border hover:bg-[var(--sophi-bg3)]" style={{ borderColor: 'var(--sophi-border)', color: 'var(--sophi-text2)' }}>Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1" style={{ background: 'var(--sophi-green)', color: '#000' }}>
            {saving && <Loader2 size={12} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Nutrition assessment modal ───────────────────────────────────────────────

function AssessmentModal({
  athleteId, onClose, onSaved,
}: { athleteId: string; onClose: () => void; onSaved: (a: NutritionAssessment) => void }) {
  const [date,   setDate]   = useState(todayStr)
  const [values, setValues] = useState<Record<string, string>>({})
  const [urine,  setUrine]  = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const payload: Record<string, unknown> = { athlete_id: athleteId, assessment_date: date }
      for (const f of [...SKINFOLD_FIELDS, ...PERIMETER_FIELDS]) {
        const v = values[f.key]
        payload[f.key] = v === undefined || v === '' ? null : Number(v)
      }
      payload.urine_specific_gravity = urine === '' ? null : Number(urine)

      const { data, error: insertError } = await supabase
        .from('nutrition_assessments')
        .insert(payload)
        .select('*')
        .single()
      if (insertError || !data) { setError('Não foi possível guardar. Sem permissão ou erro de ligação.'); return }
      onSaved(data as NutritionAssessment)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl p-5 space-y-4" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}>Nova Avaliação Nutricional</h3>

        <div className="space-y-1.5">
          <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} style={inputStyle} />
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--sophi-text3)' }}>Pregas Cutâneas (mm)</p>
          <div className="grid grid-cols-2 gap-2.5">
            {SKINFOLD_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-[10px]" style={{ color: 'var(--sophi-text2)' }}>{f.label}</label>
                <input
                  type="number" step="0.1"
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                  className={inputCls} style={inputStyle}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--sophi-text3)' }}>Perímetros (cm)</p>
          <div className="grid grid-cols-2 gap-2.5">
            {PERIMETER_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-[10px]" style={{ color: 'var(--sophi-text2)' }}>{f.label}</label>
                <input
                  type="number" step="0.1"
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                  className={inputCls} style={inputStyle}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px]" style={{ color: 'var(--sophi-text2)' }}>Densidade específica da urina</label>
          <input type="number" step="0.001" value={urine} onChange={(e) => setUrine(e.target.value)} placeholder="ex: 1.018" className={inputCls} style={inputStyle} />
        </div>

        {error && <p className="text-xs" style={{ color: 'var(--sophi-danger)' }}>{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm border hover:bg-[var(--sophi-bg3)]" style={{ borderColor: 'var(--sophi-border)', color: 'var(--sophi-text2)' }}>Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1" style={{ background: 'var(--sophi-green)', color: '#000' }}>
            {saving && <Loader2 size={12} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Supplement modal ──────────────────────────────────────────────────────────

function SupplementModal({
  athleteId, onClose, onSaved,
}: { athleteId: string; onClose: () => void; onSaved: (s: AthleteSupplement) => void }) {
  const [name,       setName]       = useState('')
  const [dosage,     setDosage]     = useState('')
  const [frequency,  setFrequency]  = useState('')
  const [startDate,  setStartDate]  = useState(todayStr)
  const [endDate,    setEndDate]    = useState('')
  const [notes,      setNotes]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('Nome do suplemento obrigatório'); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: insertError } = await supabase
        .from('athlete_supplements')
        .insert({
          athlete_id: athleteId,
          name: name.trim(),
          dosage: dosage.trim() || null,
          frequency: frequency.trim() || null,
          start_date: startDate,
          end_date: endDate || null,
          notes: notes.trim() || null,
        })
        .select('*')
        .single()
      if (insertError || !data) { setError('Não foi possível guardar. Sem permissão ou erro de ligação.'); return }
      onSaved(data as AthleteSupplement)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm rounded-2xl border shadow-2xl p-5 space-y-4" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}>Novo Suplemento</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Creatina" className={inputCls} style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Dose</label>
              <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="ex: 5g" className={inputCls} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Frequência</label>
              <input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="ex: 1x/dia" className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Início</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Fim (opcional)</label>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--sophi-text2)' }}>Notas (opcional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais" className={inputCls} style={inputStyle} />
          </div>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--sophi-danger)' }}>{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm border hover:bg-[var(--sophi-bg3)]" style={{ borderColor: 'var(--sophi-border)', color: 'var(--sophi-text2)' }}>Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1" style={{ background: 'var(--sophi-green)', color: '#000' }}>
            {saving && <Loader2 size={12} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function NutritionTab({ profile }: { profile: AthleteProfileData }) {
  const router = useRouter()
  const canWeight     = profile.viewerRole === OWNER_ROLE || ['doctor', 'physio', 'masseur', 'nutritionist'].includes(profile.viewerRole)
  const canAssessment = profile.viewerRole === OWNER_ROLE || ['doctor', 'nutritionist'].includes(profile.viewerRole)

  const [weights,     setWeights]     = useState<AthleteDailyWeight[]>([])
  const [assessments, setAssessments] = useState<NutritionAssessment[]>([])
  const [supplements, setSupplements] = useState<AthleteSupplement[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showWeightModal,     setShowWeightModal]     = useState(false)
  const [showAssessmentModal, setShowAssessmentModal] = useState(false)
  const [showSupplementModal, setShowSupplementModal] = useState(false)
  const [deletingSupplementId, setDeletingSupplementId] = useState<string | null>(null)
  const [limitDraft,   setLimitDraft]   = useState(profile.medicalHistory?.skinfold_limit_mm?.toString() ?? '')
  const [editingLimit, setEditingLimit] = useState(false)
  const [savingLimit,  setSavingLimit]  = useState(false)
  const [limit,        setLimit]        = useState(profile.medicalHistory?.skinfold_limit_mm ?? null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const [{ data: w }, { data: a }, { data: s }] = await Promise.all([
          supabase.from('athlete_daily_weight').select('*').eq('athlete_id', profile.id).order('measurement_date', { ascending: false }).limit(15),
          supabase.from('nutrition_assessments').select('*').eq('athlete_id', profile.id).order('assessment_date', { ascending: false }).limit(10),
          supabase.from('athlete_supplements').select('*').eq('athlete_id', profile.id).order('start_date', { ascending: false }),
        ])
        if (!cancelled) {
          setWeights((w ?? []) as AthleteDailyWeight[])
          setAssessments((a ?? []) as NutritionAssessment[])
          setSupplements((s ?? []) as AthleteSupplement[])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [profile.id])

  const weightByDate = useMemo(() => {
    const m: Record<string, number> = {}
    for (const w of weights) m[w.measurement_date] = w.weight_kg
    return m
  }, [weights])

  async function saveLimit() {
    setSavingLimit(true)
    try {
      const supabase = createClient()
      const val = limitDraft === '' ? null : Number(limitDraft)
      const { error } = profile.medicalHistory?.id
        ? await supabase.from('athletes_medical_history').update({ skinfold_limit_mm: val }).eq('id', profile.medicalHistory.id)
        : await supabase.from('athletes_medical_history').upsert({ athlete_id: profile.id, skinfold_limit_mm: val }, { onConflict: 'athlete_id' })
      if (!error) {
        setLimit(val)
        setEditingLimit(false)
        router.refresh()
      }
    } finally {
      setSavingLimit(false)
    }
  }

  const height = profile.medicalHistory?.height_cm

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--sophi-text3)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Peso diário */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
          <Scale size={13} style={{ color: 'var(--sophi-green)' }} />
          <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text2)' }}>
            Peso Diário{height ? ` · Altura ${height} cm` : ''}
          </p>
          {canWeight && (
            <button type="button" onClick={() => setShowWeightModal(true)} className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-[var(--sophi-green-bg)]" style={{ color: 'var(--sophi-green)' }}>
              <Plus size={10} /> Registar
            </button>
          )}
        </div>
        <div className="p-4">
          {weights.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--sophi-text3)' }}>Sem pesagens registadas</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {weights.map((w) => (
                  <div key={w.id} className="rounded-lg px-3 py-2 text-center min-w-[72px]" style={{ background: 'var(--sophi-bg3)' }}>
                    <p className="text-sm font-bold font-mono" style={{ color: 'var(--sophi-text)' }}>{w.weight_kg}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: 'var(--sophi-text3)' }}>{formatDate(w.measurement_date)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Limite de soma de pregas */}
      <div className="rounded-xl border p-3 flex items-center gap-3" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text3)' }}>
          Limite de referência (soma de 8 pregas)
        </p>
        {editingLimit ? (
          <div className="flex items-center gap-2">
            <input type="number" step="0.1" value={limitDraft} onChange={(e) => setLimitDraft(e.target.value)} className="w-20 px-2 py-1 rounded-lg text-xs border" style={inputStyle} />
            <span className="text-xs" style={{ color: 'var(--sophi-text3)' }}>mm</span>
            <button type="button" onClick={saveLimit} disabled={savingLimit} className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: 'var(--sophi-green)', color: '#000' }}>
              {savingLimit ? <Loader2 size={10} className="animate-spin" /> : 'OK'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono" style={{ color: 'var(--sophi-text)' }}>{limit != null ? `${limit} mm` : '—'}</span>
            {canAssessment && (
              <button type="button" onClick={() => { setLimitDraft(limit?.toString() ?? ''); setEditingLimit(true) }} className="p-1 rounded hover:bg-white/10">
                <Edit2 size={11} style={{ color: 'var(--sophi-text3)' }} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Evolução */}
      {assessments.length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--sophi-text3)' }}>
            Evolução — Soma das 8 Pregas
          </p>
          <SkinfoldChart assessments={assessments} limit={limit} />
        </div>
      )}

      {/* Avaliações — tabela lado a lado por data */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
          <Apple size={13} style={{ color: 'var(--sophi-green)' }} />
          <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text2)' }}>
            Avaliações Antropométricas
          </p>
          {canAssessment && (
            <button type="button" onClick={() => setShowAssessmentModal(true)} className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-[var(--sophi-green-bg)]" style={{ color: 'var(--sophi-green)' }}>
              <Plus size={10} /> Nova avaliação
            </button>
          )}
        </div>
        <div className="p-4">
          {assessments.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--sophi-text3)' }}>Sem avaliações registadas</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse min-w-max">
                <thead>
                  <tr>
                    <th className="text-left py-1.5 pr-4 sticky left-0" style={{ color: 'var(--sophi-text3)', background: 'var(--sophi-bg2)' }}>Data</th>
                    {assessments.map((a) => (
                      <th key={a.id} className="text-center px-3 py-1.5 font-semibold" style={{ color: 'var(--sophi-text)' }}>{formatDate(a.assessment_date)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1 pr-4 sticky left-0" style={{ color: 'var(--sophi-text3)', background: 'var(--sophi-bg2)' }}>Peso (kg)</td>
                    {assessments.map((a) => (
                      <td key={a.id} className="text-center px-3 py-1" style={{ color: 'var(--sophi-text2)' }}>
                        {weightByDate[a.assessment_date] ?? '—'}
                      </td>
                    ))}
                  </tr>
                  {height != null && (
                    <tr>
                      <td className="py-1 pr-4 sticky left-0" style={{ color: 'var(--sophi-text3)', background: 'var(--sophi-bg2)' }}>Altura (cm)</td>
                      {assessments.map((a) => (
                        <td key={a.id} className="text-center px-3 py-1" style={{ color: 'var(--sophi-text2)' }}>{height}</td>
                      ))}
                    </tr>
                  )}
                  {SKINFOLD_FIELDS.map((f) => (
                    <tr key={f.key}>
                      <td className="py-1 pr-4 sticky left-0" style={{ color: 'var(--sophi-text3)', background: 'var(--sophi-bg2)' }}>{f.label} (mm)</td>
                      {assessments.map((a) => (
                        <td key={a.id} className="text-center px-3 py-1" style={{ color: 'var(--sophi-text2)' }}>
                          {(a[f.key as keyof NutritionAssessment] as number | null) ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="py-1.5 pr-4 sticky left-0 font-semibold" style={{ color: 'var(--sophi-text)', background: 'var(--sophi-bg2)' }}>Soma pregas (mm)</td>
                    {assessments.map((a) => {
                      const sum = skinfoldSum(a)
                      const over = sum != null && limit != null && sum > limit
                      return (
                        <td key={a.id} className="text-center px-3 py-1.5 font-bold font-mono" style={{ color: sum == null ? 'var(--sophi-text3)' : over ? 'var(--sophi-danger)' : 'var(--sophi-green)' }}>
                          {sum ?? '—'}
                        </td>
                      )
                    })}
                  </tr>
                  {PERIMETER_FIELDS.map((f) => (
                    <tr key={f.key}>
                      <td className="py-1 pr-4 sticky left-0" style={{ color: 'var(--sophi-text3)', background: 'var(--sophi-bg2)' }}>{f.label} (cm)</td>
                      {assessments.map((a) => (
                        <td key={a.id} className="text-center px-3 py-1" style={{ color: 'var(--sophi-text2)' }}>
                          {(a[f.key as keyof NutritionAssessment] as number | null) ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="py-1.5 pr-4 sticky left-0" style={{ color: 'var(--sophi-text3)', background: 'var(--sophi-bg2)' }}>Densidade urinária</td>
                    {assessments.map((a) => {
                      const cfg = urineColor(a.urine_specific_gravity)
                      return (
                        <td key={a.id} className="text-center px-3 py-1.5">
                          {a.urine_specific_gravity == null ? (
                            <span style={{ color: 'var(--sophi-text3)' }}>—</span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: cfg?.bg, color: cfg?.color }}>
                              {a.urine_specific_gravity}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Suplementos */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
          <Pill size={13} style={{ color: 'var(--sophi-green)' }} />
          <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text2)' }}>
            Suplementos{supplements.length ? ` (${supplements.length})` : ''}
          </p>
          {canAssessment && (
            <button type="button" onClick={() => setShowSupplementModal(true)} className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-[var(--sophi-green-bg)]" style={{ color: 'var(--sophi-green)' }}>
              <Plus size={10} /> Novo
            </button>
          )}
        </div>
        <div className="p-4">
          {supplements.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--sophi-text3)' }}>Sem suplementos registados</p>
          ) : (
            <div className="space-y-2">
              {supplements.map((s) => {
                const active = !s.end_date || s.end_date >= todayStr()
                return (
                  <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold" style={{ color: 'var(--sophi-text)' }}>{s.name}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: active ? 'var(--sophi-green-bg)' : 'var(--sophi-bg4)', color: active ? 'var(--sophi-green)' : 'var(--sophi-text3)' }}>
                          {active ? 'Ativo' : 'Terminado'}
                        </span>
                        {s.dosage && <span className="text-[10px]" style={{ color: 'var(--sophi-text3)' }}>{s.dosage}</span>}
                        {s.frequency && <span className="text-[10px]" style={{ color: 'var(--sophi-text3)' }}>· {s.frequency}</span>}
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--sophi-text3)' }}>
                        {formatDate(s.start_date)}{s.end_date ? ` – ${formatDate(s.end_date)}` : ''}
                        {s.recorded_by_name ? ` · ${s.recorded_by_name}` : ''}
                      </p>
                      {s.notes && <p className="text-[10px] italic mt-0.5" style={{ color: 'var(--sophi-text3)' }}>{s.notes}</p>}
                    </div>
                    {canAssessment && (
                      <button
                        type="button"
                        disabled={deletingSupplementId === s.id}
                        onClick={async () => {
                          setDeletingSupplementId(s.id)
                          const supabase = createClient()
                          const { error } = await supabase.from('athlete_supplements').delete().eq('id', s.id)
                          if (!error) setSupplements((prev) => prev.filter((x) => x.id !== s.id))
                          setDeletingSupplementId(null)
                        }}
                        className="p-1 rounded hover:bg-white/10 shrink-0"
                        title="Remover"
                      >
                        {deletingSupplementId === s.id ? <Loader2 size={11} className="animate-spin" style={{ color: 'var(--sophi-text3)' }} /> : <Trash2 size={11} style={{ color: 'var(--sophi-danger)' }} />}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showWeightModal && (
        <DailyWeightModal
          athleteId={profile.id}
          onClose={() => setShowWeightModal(false)}
          onSaved={(w) => {
            setWeights((prev) => [w, ...prev.filter((x) => x.measurement_date !== w.measurement_date)].sort((a, b) => b.measurement_date.localeCompare(a.measurement_date)))
            setShowWeightModal(false)
          }}
        />
      )}
      {showAssessmentModal && (
        <AssessmentModal
          athleteId={profile.id}
          onClose={() => setShowAssessmentModal(false)}
          onSaved={(a) => {
            setAssessments((prev) => [a, ...prev].sort((x, y) => y.assessment_date.localeCompare(x.assessment_date)))
            setShowAssessmentModal(false)
          }}
        />
      )}
      {showSupplementModal && (
        <SupplementModal
          athleteId={profile.id}
          onClose={() => setShowSupplementModal(false)}
          onSaved={(s) => {
            setSupplements((prev) => [s, ...prev].sort((x, y) => y.start_date.localeCompare(x.start_date)))
            setShowSupplementModal(false)
          }}
        />
      )}
    </div>
  )
}
