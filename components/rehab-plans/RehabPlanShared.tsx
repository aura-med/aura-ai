'use client'

// Shared rehab-plan calendar UI — reused both inside the athlete's clinical
// file (Tratamentos tab, one athlete fixed) and on the squad-wide /rehab page
// (many athletes, with an athlete picker on create), mirroring how
// components/occurrences/OccurrenceRow.tsx is shared between /occurrences and
// the athlete profile's Overview tab. Keeping one implementation means an
// entry edited from either place behaves identically.
import { useState, useEffect, useCallback } from 'react'
import {
  Plus, X, Check, Pencil, Trash2, Loader2, ChevronRight, ChevronDown,
  CalendarClock, ArrowRightLeft, Sun, Sunset, Flag, Download,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { addDays, todayStr, calculateMDStatus, formatDisplayDate } from '@/lib/utils/microcycle'
import {
  createRehabPlan, updateRehabPlan, closeRehabPlan,
  upsertRehabPlanPhase, deleteRehabPlanPhase,
  upsertRehabPlanDay, deleteRehabPlanDay, moveRehabPlanDay,
} from '@/lib/actions/rehab-plan'
import { REHAB_DAY_OCCUPIED_ERROR } from '@/lib/actions/rehab-plan-errors'
import { exportRehabPlanPDF } from '@/lib/utils/pdf-export'
import type { RehabPlan, RehabPlanPhase, RehabPlanDay, RehabPlanPeriod } from '@/types/athlete-profile'

// ── Helpers ───────────────────────────────────────────────────────────────────

export const PERIODS: { value: RehabPlanPeriod; label: string; icon: React.ElementType }[] = [
  { value: 'morning',   label: 'Manhã', icon: Sun    },
  { value: 'afternoon', label: 'Tarde', icon: Sunset },
]

const WEEKDAY_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

function mondayOf(dateStr: string): string {
  const dow = new Date(dateStr + 'T12:00:00').getDay() // 0=Sun..6=Sat
  const offsetFromMonday = (dow + 6) % 7
  return addDays(dateStr, -offsetFromMonday)
}

function diffDays(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86_400_000)
}

function dayKey(date: string, period: RehabPlanPeriod) {
  return `${date}__${period}`
}

export function formatShort(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

const inputClass = 'w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-[var(--sophi-green)]'
const inputStyle = { background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)', color: 'var(--sophi-text)' }
const labelClass = 'text-[10px] font-semibold uppercase tracking-wider block mb-1'

// Lightweight occurrence shape for the "ligar a ocorrência" picker — only
// what the dropdown reads, so callers (in particular the squad-wide /rehab
// page, which fetches this for every athlete at once) don't need the much
// heavier ActiveOccurrence shape (occurrence_records, diagnoses, ...).
export interface RehabPlanOccurrenceOption {
  id: string
  athlete_id: string
  title: string | null
  occurrence_type: string | null
  occurrence_date: string
}

export interface RehabPlanAthleteOption {
  id: string
  name: string
  shirt_number: number | null
}

// Plain data fetchers (no hooks, no setState) — called from inside effects
// with an explicit cancelled-guard at the call site, so the effect body does
// real async work rather than a bare pass-through to a state-setting callback.
export async function fetchPlanDetail(planId: string) {
  const supabase = createClient()
  const [{ data: phaseRows }, { data: dayRows }] = await Promise.all([
    supabase.from('rehab_plan_phases').select('*').eq('plan_id', planId).order('phase_number', { ascending: true }),
    supabase.from('rehab_plan_days').select('*').eq('plan_id', planId).order('entry_date', { ascending: true }),
  ])
  return {
    phases: (phaseRows ?? []) as RehabPlanPhase[],
    days: (dayRows ?? []) as RehabPlanDay[],
  }
}

export async function fetchRehabPlans(athleteId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('rehab_plans')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('start_date', { ascending: false })
  return (data ?? []) as RehabPlan[]
}

// ── Plan create/edit modal ──────────────────────────────────────────────────

export function PlanModal({
  athleteId, athletes, existing, occurrences, onClose, onSaved,
}: {
  // Fixed athlete (embedded-in-profile context) — omit when using `athletes`.
  athleteId?: string
  // Athlete picker (squad-wide /rehab page context) — omit when `athleteId` is fixed.
  athletes?: RehabPlanAthleteOption[]
  existing: RehabPlan | null
  occurrences: RehabPlanOccurrenceOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!existing
  const [selectedAthleteId, setSelectedAthleteId] = useState(
    existing?.athlete_id ?? athleteId ?? athletes?.[0]?.id ?? '',
  )
  const [title, setTitle] = useState(existing?.title ?? '')
  const [startDate, setStartDate] = useState(existing?.start_date ?? todayStr())
  const [expectedEndDate, setExpectedEndDate] = useState(existing?.expected_end_date ?? '')
  const [occurrenceId, setOccurrenceId] = useState(existing?.occurrence_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const relevantOccurrences = occurrences.filter((o) => o.athlete_id === selectedAthleteId)

  async function handleSave() {
    if (!selectedAthleteId) { setError('Seleciona um atleta'); return }
    if (!title.trim()) { setError('Título obrigatório'); return }
    setSaving(true)
    setError(null)
    try {
      if (isEdit && existing) {
        await updateRehabPlan({
          planId: existing.id,
          title: title.trim(),
          startDate,
          expectedEndDate: expectedEndDate || null,
          occurrenceId: occurrenceId || null,
        })
      } else {
        await createRehabPlan({
          athleteId: selectedAthleteId,
          title: title.trim(),
          startDate,
          expectedEndDate: expectedEndDate || null,
          occurrenceId: occurrenceId || null,
        })
      }
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}>
            {isEdit ? 'Editar Plano de Reabilitação' : 'Novo Plano de Reabilitação'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X size={16} style={{ color: 'var(--sophi-text3)' }} />
          </button>
        </div>

        {!isEdit && athletes && (
          <div>
            <label className={labelClass} style={{ color: 'var(--sophi-text3)' }}>Atleta</label>
            <select value={selectedAthleteId} onChange={(e) => { setSelectedAthleteId(e.target.value); setOccurrenceId('') }} className={inputClass} style={inputStyle}>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>{a.shirt_number != null ? `${a.shirt_number}. ` : ''}{a.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass} style={{ color: 'var(--sophi-text3)' }}>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex: Lesão isquiotibial direito"
            className={inputClass} style={inputStyle} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={{ color: 'var(--sophi-text3)' }}>Início</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--sophi-text3)' }}>Fim previsto (opcional)</label>
            <input type="date" value={expectedEndDate} onChange={(e) => setExpectedEndDate(e.target.value)} className={inputClass} style={inputStyle} />
          </div>
        </div>

        {relevantOccurrences.length > 0 && (
          <div>
            <label className={labelClass} style={{ color: 'var(--sophi-text3)' }}>Ligar a ocorrência (opcional)</label>
            <select value={occurrenceId} onChange={(e) => setOccurrenceId(e.target.value)} className={inputClass} style={inputStyle}>
              <option value="">— Nenhuma —</option>
              {relevantOccurrences.map((o) => (
                <option key={o.id} value={o.id}>{(o.title || o.occurrence_type || 'Ocorrência')} — {o.occurrence_date}</option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm border hover:bg-[var(--sophi-bg3)]" style={{ borderColor: 'var(--sophi-border)', color: 'var(--sophi-text2)' }}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2" style={{ background: 'var(--sophi-green)', color: '#000' }}>
            {saving && <Loader2 size={13} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Phase create/edit modal ──────────────────────────────────────────────────

function PhaseModal({
  planId, existing, onClose, onSaved,
}: {
  planId: string
  existing: RehabPlanPhase | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!existing
  const [name, setName] = useState(existing?.name ?? '')
  const [criteria, setCriteria] = useState(existing?.criteria ?? '')
  const [startDate, setStartDate] = useState(existing?.start_date ?? todayStr())
  const [testDate, setTestDate] = useState(existing?.test_date ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('Nome do critério obrigatório'); return }
    setSaving(true)
    setError(null)
    try {
      await upsertRehabPlanPhase({
        phaseId: existing?.id,
        planId,
        name: name.trim(),
        criteria: criteria.trim() || null,
        startDate,
        testDate: testDate || null,
      })
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}>
            {isEdit ? 'Editar Critério de Progressão' : 'Novo Critério de Progressão'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X size={16} style={{ color: 'var(--sophi-text3)' }} />
          </button>
        </div>

        <div>
          <label className={labelClass} style={{ color: 'var(--sophi-text3)' }}>Nome da fase</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Fase 2 — Exercícios Excêntricos"
            className={inputClass} style={inputStyle} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={{ color: 'var(--sophi-text3)' }}>Data de início da fase</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--sophi-text3)' }}>Dia para testar critérios (opcional)</label>
            <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className={inputClass} style={inputStyle} />
          </div>
        </div>

        <div>
          <label className={labelClass} style={{ color: 'var(--sophi-text3)' }}>Critérios de progressão</label>
          <textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} rows={4}
            placeholder="ex: assimetria muscular <20%; sem dor à palpação; testes de força/hop dentro dos limiares"
            className={inputClass} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {error && <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm border hover:bg-[var(--sophi-bg3)]" style={{ borderColor: 'var(--sophi-border)', color: 'var(--sophi-text2)' }}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2" style={{ background: 'var(--sophi-green)', color: '#000' }}>
            {saving && <Loader2 size={13} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Day entry modal (edit content + move) ────────────────────────────────────

function DayEntryModal({
  planId, date, period, existing, phases, onClose, onSaved,
}: {
  planId: string
  date: string
  period: RehabPlanPeriod
  existing: RehabPlanDay | null
  phases: RehabPlanPhase[]
  onClose: () => void
  onSaved: () => void
}) {
  const [content, setContent] = useState(existing?.content ?? '')
  const [isRestDay, setIsRestDay] = useState(existing?.is_rest_day ?? false)
  const [phaseId, setPhaseId] = useState(existing?.phase_id ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showMove, setShowMove] = useState(false)
  const [moveDate, setMoveDate] = useState(date)
  const [movePeriod, setMovePeriod] = useState<RehabPlanPeriod>(period)
  const [moveConfirm, setMoveConfirm] = useState(false)
  const [moving, setMoving] = useState(false)

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? period

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await upsertRehabPlanDay({
        planId,
        entryDate: date,
        period,
        content: content.trim() || null,
        isRestDay,
        phaseId: phaseId || null,
      })
      onSaved()
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
      await deleteRehabPlanDay(existing.id, planId)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleMove(overwrite: boolean) {
    setMoving(true)
    setError(null)
    try {
      await moveRehabPlanDay({
        planId, fromDate: date, fromPeriod: period, toDate: moveDate, toPeriod: movePeriod, overwrite,
      })
      onSaved()
    } catch (e) {
      const msg = (e as Error).message
      if (!overwrite && msg === REHAB_DAY_OCCUPIED_ERROR) {
        setMoveConfirm(true)
      } else {
        setError(msg)
      }
    } finally {
      setMoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--sophi-border)' }}>
          <div className="flex items-center gap-2">
            <CalendarClock size={14} style={{ color: 'var(--sophi-green)' }} />
            <p className="text-sm font-bold" style={{ color: 'var(--sophi-text)' }}>
              {formatDisplayDate(date)} · {periodLabel}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
            <X size={14} style={{ color: 'var(--sophi-text3)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--sophi-text2)' }}>
            <input type="checkbox" checked={isRestDay} onChange={(e) => setIsRestDay(e.target.checked)} />
            Folga (dia de descanso)
          </label>

          <div>
            <label className={labelClass} style={{ color: 'var(--sophi-text3)' }}>Plano / notas</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5}
              placeholder="Exercícios, carga prescrita, avaliação, dor, resultados de testes..."
              className={inputClass} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {phases.length > 0 && (
            <div>
              <label className={labelClass} style={{ color: 'var(--sophi-text3)' }}>Fase</label>
              <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} className={inputClass} style={inputStyle}>
                <option value="">— Sem fase associada —</option>
                {phases.map((ph) => (
                  <option key={ph.id} value={ph.id}>Fase {ph.phase_number} — {ph.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}>{error}</p>}

          {existing && (
            <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
              <button type="button" onClick={() => setShowMove((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
                <ArrowRightLeft size={12} />
                Mover esta sessão para outro dia
                {showMove ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {showMove && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={moveDate} onChange={(e) => { setMoveDate(e.target.value); setMoveConfirm(false) }}
                      className={inputClass} style={inputStyle} />
                    <select value={movePeriod} onChange={(e) => { setMovePeriod(e.target.value as RehabPlanPeriod); setMoveConfirm(false) }}
                      className={inputClass} style={inputStyle}>
                      {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  {moveConfirm ? (
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] flex-1" style={{ color: 'var(--sophi-warn)' }}>
                        O destino já tem conteúdo — substituir?
                      </p>
                      <button type="button" onClick={() => setMoveConfirm(false)} disabled={moving}
                        className="text-[11px] px-2 py-1 rounded" style={{ color: 'var(--sophi-text3)' }}>
                        Cancelar
                      </button>
                      <button type="button" onClick={() => handleMove(true)} disabled={moving}
                        className="text-[11px] font-bold px-2 py-1 rounded" style={{ background: 'var(--sophi-warn-bg)', color: 'var(--sophi-warn)' }}>
                        {moving ? <Loader2 size={11} className="animate-spin" /> : 'Substituir'}
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => handleMove(false)} disabled={moving || (moveDate === date && movePeriod === period)}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-40" style={{ background: 'var(--sophi-green)', color: '#000' }}>
                      {moving ? <Loader2 size={11} className="animate-spin" /> : 'Mover'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t shrink-0" style={{ borderColor: 'var(--sophi-border)' }}>
          <div>
            {existing && (
              <button type="button" onClick={handleDelete} disabled={deleting || saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-[var(--sophi-danger-bg)]" style={{ color: 'var(--sophi-danger)' }}>
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Limpar
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium border hover:bg-white/5" style={{ borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text2)' }}>
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving || deleting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50" style={{ background: 'var(--sophi-green)', color: '#000' }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Week block ────────────────────────────────────────────────────────────────

function WeekBlock({
  weekIndex, mondayStart, rangeStart, rangeEnd, days, matchDays, phases, canEdit, onCellClick,
}: {
  weekIndex: number
  mondayStart: string
  rangeStart: string
  rangeEnd: string
  days: Map<string, RehabPlanDay>
  matchDays: string[]
  phases: RehabPlanPhase[]
  canEdit: boolean
  onCellClick: (date: string, period: RehabPlanPeriod) => void
}) {
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(mondayStart, i))
  const today = todayStr()

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--sophi-border)' }}>
      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'var(--sophi-bg3)', color: 'var(--sophi-text3)' }}>
        Semana {weekIndex + 1} · {formatShort(weekDates[0])} – {formatShort(weekDates[6])}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {weekDates.map((date, i) => {
          // Days outside the plan's actual range (before its start, or past
          // wherever it's been extended to) render as blank, non-interactive
          // filler — so the grid still lines up by weekday, but the plan
          // isn't forced to start/end on a Monday/Sunday.
          if (date < rangeStart || date > rangeEnd) {
            return (
              <div key={date} className="border-l first:border-l-0 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg)', opacity: 0.4 }} />
            )
          }
          const md = calculateMDStatus(date, matchDays)
          const isToday = date === today
          const testPhase = phases.find((ph) => ph.test_date === date)
          return (
            <div key={date} className="border-l first:border-l-0 border-b" style={{ borderColor: 'var(--sophi-border)' }}>
              <div className="px-2 py-1.5 text-center" style={{ background: isToday ? 'var(--sophi-green-bg)' : 'var(--sophi-bg3)' }}>
                <p className="text-[10px] font-semibold" style={{ color: isToday ? 'var(--sophi-green)' : 'var(--sophi-text2)' }}>{WEEKDAY_LABELS[i]}</p>
                <p className="text-[9px] font-mono" style={{ color: 'var(--sophi-text3)' }}>{md.label} · {formatShort(date)}</p>
                {testPhase && (
                  <p className="text-[8px] font-bold mt-0.5 px-1 py-0.5 rounded" style={{ background: 'var(--sophi-purple)', color: '#fff' }} title={testPhase.name}>
                    Teste F{testPhase.phase_number}
                  </p>
                )}
              </div>
              {PERIODS.map((p) => {
                const entry = days.get(dayKey(date, p.value))
                const phase = entry?.phase_id ? phases.find((ph) => ph.id === entry.phase_id) : null
                const Icon = p.icon
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => canEdit && onCellClick(date, p.value)}
                    disabled={!canEdit}
                    className="w-full text-left px-2 py-2 border-t align-top disabled:cursor-default"
                    style={{
                      borderColor: 'var(--sophi-border)',
                      minHeight: 76,
                      cursor: canEdit ? 'pointer' : 'default',
                      background: entry?.is_rest_day ? 'var(--sophi-bg3)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <Icon size={9} style={{ color: 'var(--sophi-text3)' }} />
                      <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>{p.label}</span>
                      {phase && (
                        <span className="text-[8px] font-bold px-1 rounded" style={{ background: 'var(--sophi-purple)', color: '#fff' }} title={phase.name}>
                          F{phase.phase_number}
                        </span>
                      )}
                    </div>
                    {entry?.is_rest_day && (
                      <span className="text-[9px] font-semibold" style={{ color: 'var(--sophi-text3)' }}>Folga</span>
                    )}
                    {entry?.content && (
                      <p className="text-[10px] leading-snug line-clamp-3" style={{ color: 'var(--sophi-text2)' }}>{entry.content}</p>
                    )}
                    {!entry && canEdit && (
                      <span className="text-[9px]" style={{ color: 'var(--sophi-text3)' }}>+ planear</span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Plan detail (calendar + phases) ──────────────────────────────────────────

export function PlanDetail({
  plan, athletes, athleteName, occurrences, canEdit, onPlanChanged,
}: {
  plan: RehabPlan
  athletes?: RehabPlanAthleteOption[]
  athleteName: string
  occurrences: RehabPlanOccurrenceOption[]
  canEdit: boolean
  onPlanChanged: () => void
}) {
  const [phases, setPhases] = useState<RehabPlanPhase[]>([])
  const [days, setDays] = useState<RehabPlanDay[]>([])
  const [loading, setLoading] = useState(true)
  const [detailVersion, setDetailVersion] = useState(0)
  const [extraDays, setExtraDays] = useState(0)

  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showPhaseModal, setShowPhaseModal] = useState(false)
  const [editingPhase, setEditingPhase] = useState<RehabPlanPhase | null>(null)
  const [dayTarget, setDayTarget] = useState<{ date: string; period: RehabPlanPeriod } | null>(null)
  const [matchDays, setMatchDays] = useState<string[]>([])
  const [closing, setClosing] = useState<'complete' | 'archive' | null>(null)
  const [confirmDeletePhaseId, setConfirmDeletePhaseId] = useState<string | null>(null)
  const [deletingPhase, setDeletingPhase] = useState(false)

  const loadDetail = useCallback(() => setDetailVersion((v) => v + 1), [])

  async function handleDeletePhase(phaseId: string) {
    setDeletingPhase(true)
    try {
      await deleteRehabPlanPhase(phaseId, plan.id)
      setConfirmDeletePhaseId(null)
      loadDetail()
    } finally {
      setDeletingPhase(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const { phases: phaseRows, days: dayRows } = await fetchPlanDetail(plan.id)
        if (!cancelled) { setPhases(phaseRows); setDays(dayRows) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [plan.id, detailVersion])

  // Match days for MD-label calculation, scoped to the athlete's squad.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const supabase = createClient()
      const { data: athlete } = await supabase.from('athletes').select('squad_id').eq('id', plan.athlete_id).maybeSingle()
      let q = supabase.from('calendar_events').select('event_date').eq('is_match_day', true)
      if (athlete?.squad_id) q = q.eq('squad_id', athlete.squad_id)
      const { data } = await q
      if (!cancelled) setMatchDays((data ?? []).map((e: { event_date: string }) => e.event_date))
    }
    load()
    return () => { cancelled = true }
  }, [plan.athlete_id])

  // The visible range always starts at the earliest of the plan's
  // start_date, its earliest planned day, and any phase's criteria test
  // date — editing start_date later than existing content (via PlanModal),
  // or picking a test date before the plan start (the date input and
  // database both allow it), must never hide days that already have
  // content. Test dates otherwise only ever extend defaultDayCount's END
  // below, so a pre-start one would fall outside WeekBlock's rendered range
  // and never appear in the calendar or PDF.
  const earliestEntryDate = days.length ? days.reduce((a, d) => (d.entry_date < a ? d.entry_date : a), days[0].entry_date) : null
  const earliestTestDate = phases.reduce<string | null>((a, ph) => (ph.test_date && (!a || ph.test_date < a) ? ph.test_date : a), null)
  const rangeStart = [earliestEntryDate, earliestTestDate, plan.start_date]
    .filter((d): d is string => !!d)
    .reduce((a, b) => (b < a ? b : a))
  const startMonday = mondayOf(rangeStart)

  // Default visible range covers rangeStart through whichever is later: the
  // plan's expected end, its last planned day, a phase's test day, or (if
  // still active) today — so an in-progress plan always shows through the
  // current day. Measured in days, not whole weeks, so the plan isn't forced
  // to start/end on a Monday/Sunday — "+ Adicionar dia"/"- Remover dia" layer
  // extraDays on top, and can only trim back down to this default (never
  // hiding a day that already has real content).
  const defaultDayCount = loading ? 1 : (() => {
    const candidates = [
      plan.expected_end_date,
      ...days.map((d) => d.entry_date),
      ...phases.map((ph) => ph.test_date),
      plan.is_active ? todayStr() : rangeStart,
    ].filter((d): d is string => !!d)
    const last = candidates.reduce((a, b) => (b > a ? b : a), rangeStart)
    return Math.max(1, diffDays(rangeStart, last) + 1)
  })()
  const dayCount = Math.max(1, defaultDayCount + extraDays)
  const rangeEnd = addDays(rangeStart, dayCount - 1)
  const weekCount = Math.ceil((diffDays(startMonday, rangeEnd) + 1) / 7)

  const dayMap = new Map(days.map((d) => [dayKey(d.entry_date, d.period), d]))

  async function handleClose(completed: boolean) {
    setClosing(completed ? 'complete' : 'archive')
    try {
      await closeRehabPlan(plan.id, completed)
      onPlanChanged()
    } finally {
      setClosing(null)
    }
  }

  function handleExportPDF() {
    exportRehabPlanPDF(plan, phases, days, { rangeStart, rangeEnd }, { athleteName, currentDate: todayStr() })
  }

  return (
    <div className="space-y-4">
      {/* Plan header */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold" style={{ color: 'var(--sophi-text)' }}>{plan.title}</h3>
              {plan.is_active ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--sophi-green-bg)', color: 'var(--sophi-green)' }}>Ativo</span>
              ) : (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--sophi-bg4)', color: 'var(--sophi-text3)' }}>
                  {plan.is_completed ? 'Concluído' : 'Arquivado'}
                </span>
              )}
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--sophi-text3)' }}>
              Início {formatShort(plan.start_date)}
              {plan.expected_end_date ? ` · Fim previsto ${formatShort(plan.expected_end_date)}` : ''}
              {plan.closed_at ? ` · Encerrado ${formatShort(plan.closed_at.slice(0, 10))}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={handleExportPDF} disabled={loading}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent" style={{ color: 'var(--sophi-text2)' }}>
              <Download size={10} /> Exportar PDF
            </button>
            {canEdit && (
              <>
                <button type="button" onClick={() => setShowPlanModal(true)}
                  className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-white/5" style={{ color: 'var(--sophi-text2)' }}>
                  <Pencil size={10} /> Editar
                </button>
                {plan.is_active && (
                  <>
                    <button type="button" onClick={() => handleClose(true)} disabled={closing !== null}
                      className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-[var(--sophi-green-bg)]" style={{ color: 'var(--sophi-green)' }}>
                      {closing === 'complete' ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Concluir
                    </button>
                    <button type="button" onClick={() => handleClose(false)} disabled={closing !== null}
                      className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-white/5" style={{ color: 'var(--sophi-text3)' }}>
                      {closing === 'archive' ? <Loader2 size={10} className="animate-spin" /> : <Flag size={10} />} Arquivar
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text2)' }}>Fases & Critérios de Progressão</p>
          {canEdit && plan.is_active && (
            <button type="button" onClick={() => { setEditingPhase(null); setShowPhaseModal(true) }}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-[var(--sophi-green-bg)]" style={{ color: 'var(--sophi-green)' }}>
              <Plus size={10} /> Novo Critério
            </button>
          )}
        </div>
        <div className="p-4">
          {phases.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--sophi-text3)' }}>Sem critérios definidos</p>
          ) : (
            <div className="space-y-2">
              {phases.map((ph) => (
                <div key={ph.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--sophi-text)' }}>Fase {ph.phase_number} — {ph.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--sophi-text3)' }}>
                        a partir de {formatShort(ph.start_date)}
                        {ph.test_date ? ` · Teste de critérios: ${formatShort(ph.test_date)}` : ''}
                      </p>
                      {ph.criteria && <p className="text-[11px] mt-1.5 whitespace-pre-wrap" style={{ color: 'var(--sophi-text2)' }}>{ph.criteria}</p>}
                    </div>
                    {canEdit && confirmDeletePhaseId !== ph.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => { setEditingPhase(ph); setShowPhaseModal(true) }} className="p-1 rounded hover:bg-white/10">
                          <Pencil size={11} style={{ color: 'var(--sophi-text3)' }} />
                        </button>
                        <button type="button" onClick={() => setConfirmDeletePhaseId(ph.id)} className="p-1 rounded hover:bg-white/10">
                          <Trash2 size={11} style={{ color: 'var(--sophi-danger)' }} />
                        </button>
                      </div>
                    )}
                  </div>
                  {confirmDeletePhaseId === ph.id && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--sophi-border)' }}>
                      <p className="text-[10px] flex-1" style={{ color: 'var(--sophi-danger)' }}>Eliminar esta fase? Os dias já associados perdem apenas a etiqueta.</p>
                      <button type="button" onClick={() => setConfirmDeletePhaseId(null)} disabled={deletingPhase}
                        className="text-[10px] font-medium px-2 py-1 rounded" style={{ color: 'var(--sophi-text3)' }}>
                        Cancelar
                      </button>
                      <button type="button" onClick={() => handleDeletePhase(ph.id)} disabled={deletingPhase}
                        className="text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1" style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}>
                        {deletingPhase ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin" style={{ color: 'var(--sophi-text3)' }} /></div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: weekCount }, (_, i) => addDays(startMonday, i * 7)).map((monday, i) => (
            <WeekBlock
              key={monday}
              weekIndex={i}
              mondayStart={monday}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              days={dayMap}
              matchDays={matchDays}
              phases={phases}
              canEdit={canEdit}
              onCellClick={(date, period) => setDayTarget({ date, period })}
            />
          ))}
          {canEdit && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setExtraDays((d) => d - 1)} disabled={extraDays <= 0}
                className="flex-1 py-2 rounded-lg border border-dashed text-xs font-medium hover:border-[var(--sophi-danger)] hover:text-[var(--sophi-danger)] disabled:opacity-30 disabled:hover:border-[var(--sophi-border2)] disabled:hover:text-[var(--sophi-text3)]"
                style={{ borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text3)' }}>
                − Remover dia
              </button>
              <button type="button" onClick={() => setExtraDays((d) => d + 1)}
                className="flex-1 py-2 rounded-lg border border-dashed text-xs font-medium hover:border-[var(--sophi-green)] hover:text-[var(--sophi-green)]"
                style={{ borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text3)' }}>
                + Adicionar dia
              </button>
            </div>
          )}
        </div>
      )}

      {showPlanModal && (
        <PlanModal athleteId={plan.athlete_id} athletes={athletes} existing={plan} occurrences={occurrences}
          onClose={() => setShowPlanModal(false)}
          onSaved={() => { setShowPlanModal(false); onPlanChanged() }} />
      )}
      {showPhaseModal && (
        <PhaseModal planId={plan.id} existing={editingPhase}
          onClose={() => setShowPhaseModal(false)}
          onSaved={() => { setShowPhaseModal(false); loadDetail() }} />
      )}
      {dayTarget && (
        <DayEntryModal
          planId={plan.id}
          date={dayTarget.date}
          period={dayTarget.period}
          existing={dayMap.get(dayKey(dayTarget.date, dayTarget.period)) ?? null}
          phases={phases}
          onClose={() => setDayTarget(null)}
          onSaved={() => { setDayTarget(null); loadDetail() }}
        />
      )}
    </div>
  )
}
