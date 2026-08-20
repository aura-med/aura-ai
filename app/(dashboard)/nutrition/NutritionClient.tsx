'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Apple, Plus, Loader2, X, Scale, Search, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isOwner } from '@/lib/roles'
import { SKINFOLD_FIELDS, PERIMETER_FIELDS } from '@/types/athlete-profile'
import type { UserRole } from '@/types'
import type { NutritionAthlete, TeamDailyWeight, TeamNutritionAssessment } from './page'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function todayStr() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function athleteLabel(a: { name: string; shirt_number: number | null } | null | undefined): string {
  if (!a) return 'Atleta'
  return `${a.shirt_number != null ? `#${a.shirt_number} ` : ''}${a.name}`
}

function skinfoldSum(a: TeamNutritionAssessment): number | null {
  const values = SKINFOLD_FIELDS.map((f) => a[f.key as keyof TeamNutritionAssessment] as number | null)
  if (values.some((v) => v == null)) return null
  return (values as number[]).reduce((acc, v) => acc + v, 0)
}

const inputCls = 'w-full px-3 py-2 rounded-lg text-xs border focus:outline-none'
const inputStyle = { background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }

// ── Summary grid ─────────────────────────────────────────────────────────────

type SkinfoldStatus = 'above' | 'within' | 'unknown'

function SummaryGrid({ athletes, assessments }: { athletes: NutritionAthlete[]; assessments: TeamNutritionAssessment[] }) {
  const cards = useMemo(() => {
    return athletes.map((ath) => {
      const latest = assessments.find((a) => a.athlete_id === ath.id) // already date-desc ordered
      const sum = latest ? skinfoldSum(latest) : null
      let status: SkinfoldStatus = 'unknown'
      if (sum != null && ath.skinfold_limit_mm != null) {
        status = sum > ath.skinfold_limit_mm ? 'above' : 'within'
      }
      return { athlete: ath, sum, latestDate: latest?.assessment_date ?? null, status }
    }).sort((a, b) => {
      const rank: Record<SkinfoldStatus, number> = { above: 0, within: 1, unknown: 2 }
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
      return (a.athlete.shirt_number ?? 999) - (b.athlete.shirt_number ?? 999)
    })
  }, [athletes, assessments])

  if (cards.length === 0) return null

  const STATUS_CFG: Record<SkinfoldStatus, { label: string; color: string; bg: string }> = {
    above:   { label: 'Acima do limite', color: 'var(--aura-danger)', bg: 'var(--aura-danger-bg)' },
    within:  { label: 'Dentro do limite', color: 'var(--aura-green)',  bg: 'var(--aura-green-bg)'  },
    unknown: { label: 'Sem avaliação',    color: 'var(--aura-text3)',  bg: 'var(--aura-bg3)'        },
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
        <AlertTriangle size={13} style={{ color: 'var(--aura-green)' }} />
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text2)' }}>
          Soma de Pregas vs. Limite — Resumo da Equipa
        </p>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
        {cards.map(({ athlete, sum, latestDate, status }) => {
          const cfg = STATUS_CFG[status]
          return (
            <div
              key={athlete.id}
              className="rounded-lg border p-3 space-y-1.5"
              style={{ borderColor: cfg.color, background: cfg.bg }}
            >
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--aura-text)' }}>{athleteLabel(athlete)}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold font-mono" style={{ color: cfg.color }}>{sum ?? '—'}</span>
                {athlete.skinfold_limit_mm != null && (
                  <span className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>/ {athlete.skinfold_limit_mm}mm</span>
                )}
              </div>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</p>
              {latestDate && <p className="text-[9px]" style={{ color: 'var(--aura-text3)' }}>{formatDate(latestDate)}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Daily weight modal (team-wide, with athlete selector) ──────────────────────

function DailyWeightModal({
  athletes, onClose, onSaved,
}: { athletes: NutritionAthlete[]; onClose: () => void; onSaved: (w: TeamDailyWeight) => void }) {
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '')
  const [date,   setDate]   = useState(todayStr)
  const [weight, setWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSave() {
    const athlete = athletes.find((a) => a.id === athleteId)
    if (!athlete) { setError('Seleciona um atleta'); return }
    const kg = Number(weight)
    if (!weight || Number.isNaN(kg) || kg <= 0) { setError('Peso inválido'); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: upsertError } = await supabase
        .from('athlete_daily_weight')
        .upsert({ athlete_id: athlete.id, measurement_date: date, weight_kg: kg }, { onConflict: 'athlete_id,measurement_date' })
        .select('id, athlete_id, measurement_date, weight_kg, recorded_by_name')
        .single()
      if (upsertError || !data) { setError('Não foi possível guardar. Sem permissão ou erro de ligação.'); return }
      onSaved({ ...data, athletes: { id: athlete.id, name: athlete.name, shirt_number: athlete.shirt_number, photo_url: athlete.photo_url, position: athlete.position } })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs rounded-2xl border shadow-2xl p-5 space-y-4" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>Registar Peso</h3>
          <button type="button" onClick={onClose}><X size={14} style={{ color: 'var(--aura-text3)' }} /></button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Atleta</label>
            <select value={athleteId} onChange={(e) => setAthleteId(e.target.value)} className={inputCls} style={inputStyle}>
              {athletes.map((a) => <option key={a.id} value={a.id}>{athleteLabel(a)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Peso (kg)</label>
            <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="ex: 78.4" className={inputCls} style={inputStyle} />
          </div>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--aura-danger)' }}>{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm border hover:bg-[var(--aura-bg3)]" style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text2)' }}>Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1" style={{ background: 'var(--aura-green)', color: '#000' }}>
            {saving && <Loader2 size={12} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Assessment modal (team-wide, with athlete selector) ────────────────────────

function AssessmentModal({
  athletes, onClose, onSaved,
}: { athletes: NutritionAthlete[]; onClose: () => void; onSaved: (a: TeamNutritionAssessment) => void }) {
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '')
  const [date,   setDate]   = useState(todayStr)
  const [values, setValues] = useState<Record<string, string>>({})
  const [urine,  setUrine]  = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSave() {
    const athlete = athletes.find((a) => a.id === athleteId)
    if (!athlete) { setError('Seleciona um atleta'); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const payload: Record<string, unknown> = { athlete_id: athlete.id, assessment_date: date }
      for (const f of [...SKINFOLD_FIELDS, ...PERIMETER_FIELDS]) {
        const v = values[f.key]
        payload[f.key] = v === undefined || v === '' ? null : Number(v)
      }
      payload.urine_specific_gravity = urine === '' ? null : Number(urine)

      const { data, error: insertError } = await supabase
        .from('nutrition_assessments')
        .insert(payload)
        .select(`id, athlete_id, assessment_date, urine_specific_gravity, ${SKINFOLD_FIELDS.map((f) => f.key).join(', ')}`)
        .single()
      if (insertError || !data) { setError('Não foi possível guardar. Sem permissão ou erro de ligação.'); return }
      onSaved({ ...(data as unknown as TeamNutritionAssessment), athletes: { id: athlete.id, name: athlete.name, shirt_number: athlete.shirt_number, photo_url: athlete.photo_url, position: athlete.position } })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl p-5 space-y-4" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>Nova Avaliação Nutricional</h3>
          <button type="button" onClick={onClose}><X size={14} style={{ color: 'var(--aura-text3)' }} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Atleta</label>
            <select value={athleteId} onChange={(e) => setAthleteId(e.target.value)} className={inputCls} style={inputStyle}>
              {athletes.map((a) => <option key={a.id} value={a.id}>{athleteLabel(a)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--aura-text2)' }}>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--aura-text3)' }}>Pregas Cutâneas (mm)</p>
          <div className="grid grid-cols-2 gap-2.5">
            {SKINFOLD_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-[10px]" style={{ color: 'var(--aura-text2)' }}>{f.label}</label>
                <input type="number" step="0.1" value={values[f.key] ?? ''} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))} className={inputCls} style={inputStyle} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--aura-text3)' }}>Perímetros (cm)</p>
          <div className="grid grid-cols-2 gap-2.5">
            {PERIMETER_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-[10px]" style={{ color: 'var(--aura-text2)' }}>{f.label}</label>
                <input type="number" step="0.1" value={values[f.key] ?? ''} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))} className={inputCls} style={inputStyle} />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px]" style={{ color: 'var(--aura-text2)' }}>Densidade específica da urina</label>
          <input type="number" step="0.001" value={urine} onChange={(e) => setUrine(e.target.value)} placeholder="ex: 1.018" className={inputCls} style={inputStyle} />
        </div>

        {error && <p className="text-xs" style={{ color: 'var(--aura-danger)' }}>{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm border hover:bg-[var(--aura-bg3)]" style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text2)' }}>Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1" style={{ background: 'var(--aura-green)', color: '#000' }}>
            {saving && <Loader2 size={12} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function NutritionClient({
  role, athletes, weights, assessments,
}: {
  role: string | null
  athletes: NutritionAthlete[]
  weights: TeamDailyWeight[]
  assessments: TeamNutritionAssessment[]
}) {
  const router = useRouter()
  const canWeight     = isOwner(role as UserRole) || ['doctor', 'physio', 'masseur', 'nutritionist'].includes(role ?? '')
  const canAssessment = isOwner(role as UserRole) || ['doctor', 'nutritionist'].includes(role ?? '')

  const [weightItems,     setWeightItems]     = useState(weights)
  const [assessmentItems, setAssessmentItems] = useState(assessments)
  const [query, setQuery] = useState('')
  const [showWeightModal,     setShowWeightModal]     = useState(false)
  const [showAssessmentModal, setShowAssessmentModal] = useState(false)

  const q = query.trim().toLowerCase()
  const filteredWeights = q ? weightItems.filter((w) => (w.athletes?.name ?? '').toLowerCase().includes(q)) : weightItems
  const filteredAssessments = q ? assessmentItems.filter((a) => (a.athletes?.name ?? '').toLowerCase().includes(q)) : assessmentItems

  function handleWeightSaved(w: TeamDailyWeight) {
    setWeightItems((prev) => [w, ...prev.filter((x) => !(x.athlete_id === w.athlete_id && x.measurement_date === w.measurement_date))])
    setShowWeightModal(false)
    router.refresh() // keep the athlete clinical file's Nutrição tab in sync
  }

  function handleAssessmentSaved(a: TeamNutritionAssessment) {
    setAssessmentItems((prev) => [a, ...prev])
    setShowAssessmentModal(false)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Apple size={18} style={{ color: 'var(--aura-green)' }} />
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
              Nutrição
            </h1>
            <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>
              Peso, avaliações antropométricas e hidratação da equipa
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canWeight && (
            <button type="button" onClick={() => setShowWeightModal(true)} disabled={athletes.length === 0}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-40 border"
              style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }}>
              <Scale size={13} /> Registar Peso
            </button>
          )}
          {canAssessment && (
            <button type="button" onClick={() => setShowAssessmentModal(true)} disabled={athletes.length === 0}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-40"
              style={{ background: 'var(--aura-green)', color: '#000' }}>
              <Plus size={13} /> Nova Avaliação
            </button>
          )}
        </div>
      </div>

      <SummaryGrid athletes={athletes} assessments={assessmentItems} />

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--aura-text3)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Procurar por atleta…"
          className="w-full pl-8 pr-3 py-2 rounded-lg text-xs border focus:outline-none"
          style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}
        />
      </div>

      {/* Daily weights */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
          <Scale size={13} style={{ color: 'var(--aura-green)' }} />
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text2)' }}>
            Pesagens Recentes{filteredWeights.length ? ` (${filteredWeights.length})` : ''}
          </p>
        </div>
        <div className="p-4">
          {filteredWeights.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--aura-text3)' }}>Sem pesagens registadas</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredWeights.slice(0, 100).map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
                  <span className="font-medium" style={{ color: 'var(--aura-text)' }}>{athleteLabel(w.athletes)}</span>
                  <div className="flex items-center gap-3" style={{ color: 'var(--aura-text3)' }}>
                    <span className="font-mono font-bold" style={{ color: 'var(--aura-text)' }}>{w.weight_kg} kg</span>
                    <span>{formatDate(w.measurement_date)}</span>
                    {w.recorded_by_name && <span>{w.recorded_by_name}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Assessments */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
          <Apple size={13} style={{ color: 'var(--aura-green)' }} />
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text2)' }}>
            Avaliações Recentes{filteredAssessments.length ? ` (${filteredAssessments.length})` : ''}
          </p>
        </div>
        <div className="p-4">
          {filteredAssessments.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--aura-text3)' }}>Sem avaliações registadas</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredAssessments.slice(0, 100).map((a) => {
                const sum = skinfoldSum(a)
                const athlete = athletes.find((x) => x.id === a.athlete_id)
                const over = sum != null && athlete?.skinfold_limit_mm != null && sum > athlete.skinfold_limit_mm
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg3)' }}>
                    <span className="font-medium" style={{ color: 'var(--aura-text)' }}>{athleteLabel(a.athletes)}</span>
                    <div className="flex items-center gap-3" style={{ color: 'var(--aura-text3)' }}>
                      <span className="font-mono font-bold" style={{ color: sum == null ? 'var(--aura-text3)' : over ? 'var(--aura-danger)' : 'var(--aura-green)' }}>
                        {sum != null ? `${sum}mm` : '—'}
                      </span>
                      {a.urine_specific_gravity != null && <span>DEU {a.urine_specific_gravity}</span>}
                      <span>{formatDate(a.assessment_date)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showWeightModal && (
        <DailyWeightModal athletes={athletes} onClose={() => setShowWeightModal(false)} onSaved={handleWeightSaved} />
      )}
      {showAssessmentModal && (
        <AssessmentModal athletes={athletes} onClose={() => setShowAssessmentModal(false)} onSaved={handleAssessmentSaved} />
      )}
    </div>
  )
}
