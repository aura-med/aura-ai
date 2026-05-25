'use client'
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { RehabProtocolDB, RehabProtocolPhase } from '@/types'
import type { ToastType } from './useToast'

// ── Constants ─────────────────────────────────────────────────────────────────
// Confirmed columns in rehab_protocols: id, name, key, phases, total_days, evidence
// status / osiics_codes / updated_at do NOT exist yet — kept out of all DB calls.

const BLANK_PHASE: RehabProtocolPhase = {
  name: '',
  progression_criteria: '',
  load_restrictions: '',
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  toast: (type: ToastType, message: string) => void
  allCodes: never[]  // reserved for when osiics_codes column is added to DB
  protocol?: RehabProtocolDB | null
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ProtocolFormModal({ open, onClose, onSuccess, toast, protocol }: Props) {
  const isEdit = Boolean(protocol)

  const [saving, setSaving]           = useState(false)
  const [name, setName]               = useState('')
  const [key, setKey]                 = useState('')
  const [totalDays, setTotalDays]     = useState('')
  const [evidence, setEvidence]       = useState('')
  const [phases, setPhases]           = useState<RehabProtocolPhase[]>([{ ...BLANK_PHASE }])
  const [expandedIdx, setExpandedIdx] = useState<number>(0)
  const [errors, setErrors]           = useState<Record<string, string>>({})

  // Populate form when editing
  useEffect(() => {
    if (!open) return
    if (protocol) {
      setName(protocol.name ?? '')
      setKey(protocol.key ?? '')
      setTotalDays(protocol.total_days != null ? String(protocol.total_days) : '')
      setEvidence(protocol.evidence ?? '')
      setPhases(protocol.phases?.length ? protocol.phases : [{ ...BLANK_PHASE }])
      setExpandedIdx(0)
    } else {
      reset()
    }
  }, [open, protocol])

  // ── Helpers ────────────────────────────────────────────────────────────────
  function reset() {
    setName(''); setKey(''); setTotalDays(''); setEvidence('')
    setPhases([{ ...BLANK_PHASE }]); setExpandedIdx(0); setErrors({})
  }

  function handleClose() { reset(); onClose() }

  function clearErr(k: string) {
    setErrors((e) => { const n = { ...e }; delete n[k]; return n })
  }

  // ── Phase helpers ──────────────────────────────────────────────────────────
  function updatePhase(idx: number, k: keyof RehabProtocolPhase, v: string) {
    setPhases((prev) => prev.map((p, i) => (i === idx ? { ...p, [k]: v } : p)))
    clearErr(`phase_${idx}_${k}`)
  }

  function addPhase() {
    setPhases((prev) => [...prev, { ...BLANK_PHASE }])
    setExpandedIdx(phases.length)
  }

  function removePhase(idx: number) {
    if (phases.length === 1) return
    setPhases((prev) => prev.filter((_, i) => i !== idx))
    setExpandedIdx((prev) => Math.max(0, prev >= idx ? prev - 1 : prev))
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Nome obrigatório'
    if (!key.trim())  e.key  = 'Chave obrigatória'
    phases.forEach((p, i) => {
      if (!p.name.trim()) e[`phase_${i}_name`] = 'Nome da fase obrigatório'
    })
    return e
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      const firstPhaseErr = Object.keys(errs).find((k) => k.startsWith('phase_'))
      if (firstPhaseErr) setExpandedIdx(parseInt(firstPhaseErr.split('_')[1], 10))
      return
    }

    setSaving(true)
    const supabase = createClient()

    // Only use confirmed columns — do NOT include status / osiics_codes / timestamps
    const payload = {
      name: name.trim(),
      key: key.trim(),
      phases,
      total_days: totalDays ? Number(totalDays) : null,
      evidence: evidence.trim() || null,
    }

    console.log('[ProtocolFormModal] submitting payload:', payload)

    let dbError
    if (isEdit && protocol) {
      const res = await supabase.from('rehab_protocols').update(payload).eq('id', protocol.id)
      dbError = res.error
      console.log('[ProtocolFormModal] update result:', res.error ?? 'ok')
    } else {
      const res = await supabase.from('rehab_protocols').insert(payload)
      dbError = res.error
      console.log('[ProtocolFormModal] insert result:', res.error ?? 'ok')
    }

    setSaving(false)
    if (dbError) {
      console.error('[ProtocolFormModal] Supabase error:', dbError.code, dbError.message, dbError.details)
      toast('error', `Erro: ${dbError.message} (código ${dbError.code})`)
      return
    }

    toast('success', isEdit ? 'Protocolo actualizado' : 'Protocolo criado com sucesso')
    reset()
    onSuccess()
    onClose()
  }

  // ── Style helpers ──────────────────────────────────────────────────────────
  const baseInput =
    'mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--aura-green)] transition-colors'
  const baseTextarea =
    'mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--aura-green)] transition-colors resize-none'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar Protocolo' : 'Novo Protocolo de Reabilitação'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-5 mt-2 pr-1">

          {/* ── Name + Key ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
                Nome do Protocolo *
              </label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); clearErr('name') }}
                placeholder="Ex: Lesão Muscular Grau II — Isquiotibiais"
                className={baseInput}
                style={{
                  borderColor: errors.name ? 'var(--aura-danger)' : 'var(--aura-border2)',
                  color: 'var(--aura-text)',
                }}
              />
              {errors.name && (
                <p className="text-xs mt-1" style={{ color: 'var(--aura-danger)' }}>{errors.name}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
                Chave (key) *
              </label>
              <input
                value={key}
                onChange={(e) => { setKey(e.target.value.toLowerCase().replace(/\s+/g, '_')); clearErr('key') }}
                placeholder="Ex: tms2_grau2"
                className={`${baseInput} font-mono`}
                style={{
                  borderColor: errors.key ? 'var(--aura-danger)' : 'var(--aura-border2)',
                  color: 'var(--aura-text)',
                }}
              />
              {errors.key && (
                <p className="text-xs mt-1" style={{ color: 'var(--aura-danger)' }}>{errors.key}</p>
              )}
            </div>
          </div>

          {/* ── Total Days + Evidence ────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
                Duração Total (dias)
              </label>
              <input
                type="number"
                min={1}
                value={totalDays}
                onChange={(e) => setTotalDays(e.target.value)}
                placeholder="Ex: 21"
                className={baseInput}
                style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
                Referência / Evidência
              </label>
              <input
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Ex: UEFA Elite Club Injury Study 2023"
                className={baseInput}
                style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}
              />
            </div>
          </div>

          {/* ── Phases ──────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
                  Fases do Protocolo *
                </label>
                <span className="ml-2 text-[10px] font-mono" style={{ color: 'var(--aura-text3)' }}>
                  {phases.length} fase{phases.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={addPhase}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-[var(--aura-bg4)]"
                style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-green)' }}
              >
                <Plus size={11} />
                Adicionar Fase
              </button>
            </div>

            <div className="space-y-2">
              {phases.map((phase, i) => {
                const isExpanded = expandedIdx === i
                const hasError   = !!errors[`phase_${i}_name`]

                return (
                  <div
                    key={i}
                    className="rounded-xl border overflow-hidden"
                    style={{
                      borderColor: hasError
                        ? 'rgba(255,77,109,0.4)'
                        : isExpanded
                        ? 'rgba(0,229,160,0.2)'
                        : 'var(--aura-border)',
                      background: 'var(--aura-bg3)',
                    }}
                  >
                    {/* Header */}
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
                      onClick={() => setExpandedIdx(isExpanded ? -1 : i)}
                    >
                      <GripVertical size={13} style={{ color: 'var(--aura-text3)', flexShrink: 0 }} />
                      <span
                        className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          background: isExpanded ? 'rgba(0,229,160,0.1)' : 'var(--aura-bg4)',
                          color: isExpanded ? 'var(--aura-green)' : 'var(--aura-text3)',
                        }}
                      >
                        F{i + 1}
                      </span>
                      <span
                        className="flex-1 text-sm truncate"
                        style={{ color: phase.name ? 'var(--aura-text)' : 'var(--aura-text3)' }}
                      >
                        {phase.name || `Fase ${i + 1} — sem nome`}
                      </span>
                      {phases.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removePhase(i) }}
                          className="p-1 rounded-lg transition-colors hover:bg-[var(--aura-danger-bg)]"
                        >
                          <Trash2 size={12} style={{ color: 'var(--aura-danger)' }} />
                        </button>
                      )}
                      {isExpanded
                        ? <ChevronUp  size={13} style={{ color: 'var(--aura-text3)' }} />
                        : <ChevronDown size={13} style={{ color: 'var(--aura-text3)' }} />}
                    </div>

                    {/* Body */}
                    {isExpanded && (
                      <div
                        className="px-3 pb-4 space-y-4 border-t"
                        style={{ borderColor: 'var(--aura-border)' }}
                      >
                        <div className="pt-3">
                          <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
                            Nome da Fase *
                          </label>
                          <input
                            value={phase.name}
                            onChange={(e) => updatePhase(i, 'name', e.target.value)}
                            placeholder="Ex: Fase 1 — Controlo da Inflamação"
                            className={baseInput}
                            style={{
                              borderColor: errors[`phase_${i}_name`]
                                ? 'var(--aura-danger)'
                                : 'var(--aura-border2)',
                              color: 'var(--aura-text)',
                            }}
                          />
                          {errors[`phase_${i}_name`] && (
                            <p className="text-xs mt-1" style={{ color: 'var(--aura-danger)' }}>
                              {errors[`phase_${i}_name`]}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
                            Critérios de Progressão{' '}
                            <span style={{ color: 'var(--aura-text3)', fontWeight: 400 }}>(opcional)</span>
                          </label>
                          <textarea
                            value={phase.progression_criteria}
                            onChange={(e) => updatePhase(i, 'progression_criteria', e.target.value)}
                            rows={2}
                            placeholder="Ex: Dor < 3/10, sem edema, amplitude de movimento completa…"
                            className={baseTextarea}
                            style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
                            Restrições de Carga{' '}
                            <span style={{ color: 'var(--aura-text3)', fontWeight: 400 }}>(opcional)</span>
                          </label>
                          <textarea
                            value={phase.load_restrictions}
                            onChange={(e) => updatePhase(i, 'load_restrictions', e.target.value)}
                            rows={2}
                            placeholder="Ex: Sem corrida, máximo 30% carga isométrica, sem contacto…"
                            className={baseTextarea}
                            style={{ borderColor: 'var(--aura-border2)', color: 'var(--aura-text)' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'A guardar…' : isEdit ? 'Atualizar Protocolo' : 'Criar Protocolo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
