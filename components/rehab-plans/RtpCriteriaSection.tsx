'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Loader2, CheckSquare, Square, Sparkles } from 'lucide-react'

const RTP_PRESETS = [
  'Corrida 100% sem dor',
  'Salto unipodal sem hesitação',
  'Mudanças de direção indolores',
  'Força simétrica (diferença < 10%)',
  'Amplitude de movimento completa',
  'Sem edema em repouso',
  'Treino de grupo sem restrições',
  'Aprovação médica para regresso',
  'Sprints máximos sem sintomas',
  'Equilíbrio unipodal 10s estável',
]
import { updateRtpCriteria } from '@/lib/actions/rehab-plan'
import type { RtpCriterion } from '@/types/athlete-profile'

interface RtpCriteriaSectionProps {
  planId: string
  initialCriteria: RtpCriterion[]
  canEdit: boolean
}

export function RtpCriteriaSection({ planId, initialCriteria, canEdit }: RtpCriteriaSectionProps) {
  const [criteria, setCriteria] = useState<RtpCriterion[]>(initialCriteria)
  const [newLabel, setNewLabel] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [isPending, startTransition] = useTransition()

  const doneCount = criteria.filter((c) => c.done).length
  const total = criteria.length

  async function persist(next: RtpCriterion[]) {
    setCriteria(next)
    startTransition(async () => {
      await updateRtpCriteria(planId, next)
    })
  }

  function toggle(id: string) {
    persist(criteria.map((c) => c.id === id ? { ...c, done: !c.done } : c))
  }

  function remove(id: string) {
    persist(criteria.filter((c) => c.id !== id))
  }

  function addCriterion() {
    const label = newLabel.trim()
    if (!label) return
    const next: RtpCriterion = { id: crypto.randomUUID(), label, done: false }
    persist([...criteria, next])
    setNewLabel('')
    setShowAdd(false)
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text2)' }}>
          Critérios RTP
        </p>
        {total > 0 && (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full" style={{
            background: doneCount === total ? 'var(--sophi-green-bg)' : 'var(--sophi-bg4)',
            color: doneCount === total ? 'var(--sophi-green)' : 'var(--sophi-text3)',
          }}>
            {doneCount}/{total}
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-[var(--sophi-green-bg)]"
            style={{ color: 'var(--sophi-green)' }}
          >
            <Plus size={10} /> Adicionar
          </button>
        )}
      </div>

      <div className="p-4 space-y-2">
        {criteria.length === 0 && !showAdd && (
          <p className="text-xs text-center py-3" style={{ color: 'var(--sophi-text3)' }}>
            {canEdit ? 'Sem critérios definidos — clique em Adicionar' : 'Sem critérios RTP definidos'}
          </p>
        )}

        {criteria.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => toggle(c.id)}
              disabled={isPending || !canEdit}
              className="shrink-0 mt-0.5"
              aria-label={c.done ? 'Marcar como incompleto' : 'Marcar como completo'}
            >
              {c.done
                ? <CheckSquare size={15} style={{ color: 'var(--sophi-green)' }} />
                : <Square size={15} style={{ color: 'var(--sophi-text3)' }} />
              }
            </button>
            <span className="flex-1 text-xs leading-relaxed" style={{
              color: c.done ? 'var(--sophi-text3)' : 'var(--sophi-text)',
              textDecoration: c.done ? 'line-through' : 'none',
            }}>
              {c.label}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() => remove(c.id)}
                disabled={isPending}
                className="shrink-0 p-0.5 rounded hover:bg-white/10 opacity-40 hover:opacity-100 transition-opacity"
              >
                <Trash2 size={11} style={{ color: 'var(--sophi-danger)' }} />
              </button>
            )}
          </div>
        ))}

        {showAdd && (
          <div className="space-y-2 pt-1">
            {/* Preset suggestions */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1" style={{ color: 'var(--sophi-text3)' }}>
                <Sparkles size={10} />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Sugestões</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {RTP_PRESETS.filter((p) => !criteria.some((c) => c.label === p)).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      const next: RtpCriterion = { id: crypto.randomUUID(), label: preset, done: false }
                      persist([...criteria, next])
                    }}
                    className="text-[10px] px-2 py-1 rounded-full border hover:border-[var(--sophi-green)] hover:text-[var(--sophi-green)] transition-colors"
                    style={{ borderColor: 'var(--sophi-border)', color: 'var(--sophi-text2)', background: 'var(--sophi-bg3)' }}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
            {/* Free-text input */}
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCriterion(); if (e.key === 'Escape') { setShowAdd(false); setNewLabel('') } }}
                placeholder="Ou escreve um critério personalizado…"
                className="flex-1 text-xs px-3 py-1.5 rounded-lg border outline-none focus:ring-1"
                style={{
                  background: 'var(--sophi-bg3)',
                  borderColor: 'var(--sophi-border2)',
                  color: 'var(--sophi-text)',
                }}
              />
              <button
                type="button"
                onClick={addCriterion}
                disabled={!newLabel.trim() || isPending}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg"
                style={{ background: 'var(--sophi-green)', color: '#000', opacity: !newLabel.trim() ? 0.5 : 1 }}
              >
                {isPending ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                OK
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setNewLabel('') }}
                className="text-[10px] px-2 py-1.5 rounded-lg border hover:bg-white/5"
                style={{ borderColor: 'var(--sophi-border)', color: 'var(--sophi-text3)' }}
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
