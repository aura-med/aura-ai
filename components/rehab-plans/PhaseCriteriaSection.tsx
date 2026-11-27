'use client'

// Formal, signed-off phase criteria (migration 096) — replaces the free
// checkbox-only pattern of RtpCriteriaSection for new usage: a criterion can
// carry a metric/threshold/measured value, and completed_by/completed_at are
// always derived server-side (set_rehab_criterion_completion), so a sign-off
// can't be forged by a direct client write the way a plain boolean could.

import { useState, useTransition } from 'react'
import { Plus, Trash2, Loader2, CheckSquare, Square, Pencil, X } from 'lucide-react'
import {
  upsertRehabPhaseCriterion, deleteRehabPhaseCriterion, setRehabCriterionCompletion,
} from '@/lib/actions/rehab-plan'
import { todayStr } from '@/lib/utils/microcycle'
import type { RehabPhaseCriterion, ThresholdOperator } from '@/types/athlete-profile'

const OPERATOR_LABELS: Record<ThresholdOperator, string> = {
  gte: '≥', lte: '≤', gt: '>', lt: '<', eq: '=',
}

interface PhaseCriteriaSectionProps {
  phaseId: string
  initialCriteria: RehabPhaseCriterion[]
  canEdit: boolean
  onChanged: () => void
}

export function PhaseCriteriaSection({ phaseId, initialCriteria, canEdit, onChanged }: PhaseCriteriaSectionProps) {
  const [showForm, setShowForm] = useState<'new' | string | null>(null)
  const [description, setDescription] = useState('')
  const [metricLabel, setMetricLabel] = useState('')
  const [thresholdOperator, setThresholdOperator] = useState<'' | ThresholdOperator>('')
  const [thresholdValue, setThresholdValue] = useState('')
  const [unit, setUnit] = useState('')
  const [targetTestDate, setTargetTestDate] = useState('')
  const [measuredInputs, setMeasuredInputs] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const criteria = initialCriteria
  const doneCount = criteria.filter((c) => c.is_completed).length
  const today = todayStr()

  function resetForm() {
    setDescription(''); setMetricLabel(''); setThresholdOperator(''); setThresholdValue(''); setUnit(''); setTargetTestDate('')
  }

  function startEdit(c: RehabPhaseCriterion) {
    setDescription(c.description)
    setMetricLabel(c.metric_label ?? '')
    setThresholdOperator(c.threshold_operator ?? '')
    setThresholdValue(c.threshold_value != null ? String(c.threshold_value) : '')
    setUnit(c.unit ?? '')
    setTargetTestDate(c.target_test_date ?? '')
    setShowForm(c.id)
  }

  function handleSaveForm() {
    if (!description.trim()) { setError('Descrição obrigatória'); return }
    setError(null)
    const criterionId = showForm !== 'new' ? showForm ?? undefined : undefined
    startTransition(async () => {
      try {
        await upsertRehabPhaseCriterion({
          criterionId,
          phaseId,
          description: description.trim(),
          metricLabel: metricLabel.trim() || null,
          thresholdOperator: thresholdOperator || null,
          thresholdValue: thresholdValue ? Number(thresholdValue) : null,
          unit: unit.trim() || null,
          targetTestDate: targetTestDate || null,
          displayOrder: criteria.length,
        })
        setShowForm(null)
        resetForm()
        onChanged()
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  function handleDelete(criterionId: string) {
    startTransition(async () => {
      await deleteRehabPhaseCriterion(criterionId, phaseId)
      onChanged()
    })
  }

  function handleToggle(c: RehabPhaseCriterion) {
    const measuredRaw = measuredInputs[c.id]
    const measuredValue = measuredRaw ? Number(measuredRaw) : null
    startTransition(async () => {
      await setRehabCriterionCompletion(c.id, phaseId, !c.is_completed, measuredValue)
      onChanged()
    })
  }

  return (
    <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--sophi-border)' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text3)' }}>
          Critérios formais
        </p>
        {criteria.length > 0 && (
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full" style={{
            background: doneCount === criteria.length ? 'var(--sophi-green-bg)' : 'var(--sophi-bg4)',
            color: doneCount === criteria.length ? 'var(--sophi-green)' : 'var(--sophi-text3)',
          }}>
            {doneCount}/{criteria.length}
          </span>
        )}
        {canEdit && (
          <button type="button" onClick={() => { resetForm(); setShowForm('new') }}
            className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-[var(--sophi-accent-bg)]" style={{ color: 'var(--sophi-accent)' }}>
            <Plus size={9} /> Critério
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {criteria.map((c) => {
          const isDue = !c.is_completed && !!c.target_test_date && c.target_test_date <= today
          return (
          <div key={c.id} className="flex items-start gap-2">
            <button type="button" onClick={() => handleToggle(c)} disabled={isPending || !canEdit} className="shrink-0 mt-0.5">
              {c.is_completed
                ? <CheckSquare size={13} style={{ color: 'var(--sophi-green)' }} />
                : <Square size={13} style={{ color: isDue ? 'var(--sophi-danger)' : 'var(--sophi-text3)' }} />}
            </button>
            <div className="flex-1 min-w-0">
              <span className="text-[11px]" style={{ color: c.is_completed ? 'var(--sophi-text3)' : 'var(--sophi-text)', textDecoration: c.is_completed ? 'line-through' : 'none' }}>
                {c.description}
                {c.metric_label && c.threshold_operator && c.threshold_value != null && (
                  <span style={{ color: 'var(--sophi-text3)' }}>
                    {' '}({c.metric_label} {OPERATOR_LABELS[c.threshold_operator]} {c.threshold_value}{c.unit ?? ''})
                  </span>
                )}
                {!c.is_completed && c.target_test_date && (
                  <span className="font-semibold" style={{ color: isDue ? 'var(--sophi-danger)' : 'var(--sophi-text3)' }}>
                    {' '}· {isDue ? 'teste previsto para' : 'teste previsto:'} {c.target_test_date.slice(8, 10)}/{c.target_test_date.slice(5, 7)}/{c.target_test_date.slice(0, 4)}
                  </span>
                )}
              </span>
              {c.is_completed ? (
                <p className="text-[9px]" style={{ color: 'var(--sophi-text3)' }}>
                  {c.measured_value != null ? `Medido: ${c.measured_value}${c.unit ?? ''} · ` : ''}
                  {c.completed_by_name ?? '—'}{c.completed_at ? ` · ${c.completed_at.slice(0, 10)}` : ''}
                </p>
              ) : c.metric_label && canEdit ? (
                <input
                  type="number"
                  placeholder={`Valor medido${c.unit ? ` (${c.unit})` : ''}`}
                  value={measuredInputs[c.id] ?? ''}
                  onChange={(e) => setMeasuredInputs((m) => ({ ...m, [c.id]: e.target.value }))}
                  className="mt-0.5 w-32 text-[10px] px-1.5 py-0.5 rounded border outline-none"
                  style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
                />
              ) : null}
            </div>
            {canEdit && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button type="button" onClick={() => startEdit(c)} className="p-0.5 rounded hover:bg-[var(--sophi-bg4)] opacity-40 hover:opacity-100">
                  <Pencil size={10} style={{ color: 'var(--sophi-text3)' }} />
                </button>
                <button type="button" onClick={() => handleDelete(c.id)} disabled={isPending} className="p-0.5 rounded hover:bg-[var(--sophi-bg4)] opacity-40 hover:opacity-100">
                  <Trash2 size={10} style={{ color: 'var(--sophi-danger)' }} />
                </button>
              </div>
            )}
          </div>
          )
        })}

        {criteria.length === 0 && !showForm && (
          <p className="text-[10px]" style={{ color: 'var(--sophi-text3)' }}>Sem critérios formais nesta fase.</p>
        )}

        {showForm && (
          <div className="rounded-lg border p-2 space-y-1.5 mt-1" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg2)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold" style={{ color: 'var(--sophi-text2)' }}>
                {showForm === 'new' ? 'Novo critério' : 'Editar critério'}
              </span>
              <button type="button" onClick={() => { setShowForm(null); setError(null) }}><X size={11} style={{ color: 'var(--sophi-text3)' }} /></button>
            </div>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex: LSI do quadricípite acima do limiar"
              className="w-full text-[11px] px-2 py-1 rounded border outline-none" style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }} />
            <div className="grid grid-cols-4 gap-1.5">
              <input value={metricLabel} onChange={(e) => setMetricLabel(e.target.value)} placeholder="Métrica (ex: LSI)"
                className="text-[10px] px-1.5 py-1 rounded border outline-none" style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }} />
              <select value={thresholdOperator} onChange={(e) => setThresholdOperator(e.target.value as ThresholdOperator | '')}
                className="text-[10px] px-1 py-1 rounded border outline-none" style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}>
                <option value="">—</option>
                {(Object.keys(OPERATOR_LABELS) as ThresholdOperator[]).map((op) => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
              </select>
              <input type="number" value={thresholdValue} onChange={(e) => setThresholdValue(e.target.value)} placeholder="Valor"
                className="text-[10px] px-1.5 py-1 rounded border outline-none" style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }} />
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unid. (%)"
                className="text-[10px] px-1.5 py-1 rounded border outline-none" style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }} />
            </div>
            <label className="block">
              <span className="text-[9px] font-medium block mb-0.5" style={{ color: 'var(--sophi-text3)' }}>Data prevista do teste</span>
              <input type="date" value={targetTestDate} onChange={(e) => setTargetTestDate(e.target.value)}
                className="text-[10px] px-1.5 py-1 rounded border outline-none" style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }} />
            </label>
            {error && <p className="text-[10px]" style={{ color: 'var(--sophi-danger)' }}>{error}</p>}
            <button type="button" onClick={handleSaveForm} disabled={isPending}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded" style={{ background: 'var(--sophi-primary)', color: 'var(--sophi-on-primary)' }}>
              {isPending ? <Loader2 size={9} className="animate-spin" /> : null} Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
