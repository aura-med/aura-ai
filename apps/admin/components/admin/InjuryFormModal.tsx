'use client'
import { useState } from 'react'
import { createOsiicsCode } from '@/lib/clinical-actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ToastType } from './useToast'
import type { OsiicsCode } from '@/types'

// ── Suggested values (editable free-text + datalist) ─────────────────────────
const BODY_REGIONS = [
  'Cabeça', 'Pescoço', 'Coluna', 'Ombro', 'Cotovelo', 'Pulso',
  'Mão', 'Pélvis', 'Coxa', 'Joelho', 'Perna', 'Tornozelo', 'Pé', 'Outro',
]
const INJURY_TYPES = [
  'Músculo', 'Ligamento', 'Tendão', 'Osso', 'Cartilagem', 'Nervo', 'Pele', 'Outro',
]
const SEVERITY_LABELS = ['Minor', 'Moderate', 'Major', 'Severe']

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  toast: (type: ToastType, message: string) => void
}

// ── Form state type ───────────────────────────────────────────────────────────
interface FormState {
  code: string
  body_region: string
  injury_type: string
  diagnosis: string
  severity_label: string
  has_uefa_data: boolean
  expected_recovery_min: string
  expected_recovery_max: string
}

const INITIAL: FormState = {
  code: '',
  body_region: '',
  injury_type: '',
  diagnosis: '',
  severity_label: '',
  has_uefa_data: false,
  expected_recovery_min: '',
  expected_recovery_max: '',
}

// ── Component ─────────────────────────────────────────────────────────────────
export function InjuryFormModal({ open, onClose, onSuccess, toast }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'root', string>>>({})
  const [saving, setSaving] = useState(false)

  // ── Helpers ────────────────────────────────────────────────────────────────
  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => {
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  function reset() {
    setForm(INITIAL)
    setErrors({})
  }

  function handleClose() {
    reset()
    onClose()
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate(): Partial<Record<keyof FormState | 'root', string>> {
    const e: Partial<Record<keyof FormState | 'root', string>> = {}
    if (!form.code || form.code.length !== 4) {
      e.code = 'O código deve ter exactamente 4 caracteres'
    }
    if (!form.body_region.trim()) e.body_region = 'Campo obrigatório'
    if (!form.injury_type.trim())  e.injury_type  = 'Campo obrigatório'
    if (!form.diagnosis.trim())    e.diagnosis    = 'Campo obrigatório'

    if (form.has_uefa_data) {
      if (!form.expected_recovery_min) e.expected_recovery_min = 'Obrigatório com dados UEFA'
      if (!form.expected_recovery_max) e.expected_recovery_max = 'Obrigatório com dados UEFA'
      if (
        form.expected_recovery_min &&
        form.expected_recovery_max &&
        Number(form.expected_recovery_min) > Number(form.expected_recovery_max)
      ) {
        e.expected_recovery_min = 'Mínimo não pode ser maior que máximo'
      }
    }
    return e
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setSaving(true)
    const payload: OsiicsCode = {
      code: form.code.toUpperCase(),
      body_region: form.body_region.trim(),
      injury_type: form.injury_type.trim(),
      diagnosis: form.diagnosis.trim(),
      severity_label: form.severity_label.trim() || null,
      expected_recovery_min: form.has_uefa_data ? Number(form.expected_recovery_min) : null,
      expected_recovery_max: form.has_uefa_data ? Number(form.expected_recovery_max) : null,
    }

    console.log('[InjuryFormModal] submitting to dim_osiics_codes')
    const result = await createOsiicsCode(payload)
    setSaving(false)

    if (!result.ok) {
      console.error('[InjuryFormModal] admin action error:', result.code, result.message)
      if (result.code === '23505') {
        setErrors({ code: `Código ${payload.code} já existe` })
      } else {
        toast('error', `Erro ao guardar: ${result.message}${result.code ? ` (código ${result.code})` : ''}`)
      }
      return
    }
    console.log('[InjuryFormModal] insert ok:', payload.code)

    toast('success', `Lesão ${payload.code} adicionada com sucesso`)
    reset()
    onSuccess()
    onClose()
  }

  // ── Input style helpers ────────────────────────────────────────────────────
  function borderFor(key: keyof FormState) {
    return errors[key] ? 'var(--sophi-danger)' : 'var(--sophi-border2)'
  }

  const baseInput =
    'mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--sophi-green)] transition-colors'
  const baseTextarea =
    'mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--sophi-green)] transition-colors resize-none'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Lesão OSIICS</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* ── Code ──────────────────────────────────────────────────────── */}
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
              Código OSIICS *
            </label>
            <input
              value={form.code}
              onChange={(e) => setField('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={4}
              placeholder="Ex: TMS1"
              spellCheck={false}
              className={`${baseInput} font-mono uppercase tracking-widest`}
              style={{ borderColor: borderFor('code'), color: 'var(--sophi-text)' }}
            />
            {errors.code && (
              <p className="text-xs mt-1" style={{ color: 'var(--sophi-danger)' }}>{errors.code}</p>
            )}
          </div>

          {/* ── Body Region + Injury Type ────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
                Região Corporal *
              </label>
              <input
                value={form.body_region}
                onChange={(e) => setField('body_region', e.target.value)}
                list="sophi-body-regions"
                placeholder="Ex: Coxa"
                className={baseInput}
                style={{ borderColor: borderFor('body_region'), color: 'var(--sophi-text)' }}
              />
              <datalist id="sophi-body-regions">
                {BODY_REGIONS.map((r) => <option key={r} value={r} />)}
              </datalist>
              {errors.body_region && (
                <p className="text-xs mt-1" style={{ color: 'var(--sophi-danger)' }}>{errors.body_region}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
                Tipo de Lesão *
              </label>
              <input
                value={form.injury_type}
                onChange={(e) => setField('injury_type', e.target.value)}
                list="sophi-injury-types"
                placeholder="Ex: Músculo"
                className={baseInput}
                style={{ borderColor: borderFor('injury_type'), color: 'var(--sophi-text)' }}
              />
              <datalist id="sophi-injury-types">
                {INJURY_TYPES.map((t) => <option key={t} value={t} />)}
              </datalist>
              {errors.injury_type && (
                <p className="text-xs mt-1" style={{ color: 'var(--sophi-danger)' }}>{errors.injury_type}</p>
              )}
            </div>
          </div>

          {/* ── Diagnosis ───────────────────────────────────────────────── */}
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
              Diagnóstico Clínico *
            </label>
            <textarea
              value={form.diagnosis}
              onChange={(e) => setField('diagnosis', e.target.value)}
              rows={2}
              placeholder="Descrição clínica do diagnóstico…"
              className={baseTextarea}
              style={{ borderColor: borderFor('diagnosis'), color: 'var(--sophi-text)' }}
            />
            {errors.diagnosis && (
              <p className="text-xs mt-1" style={{ color: 'var(--sophi-danger)' }}>{errors.diagnosis}</p>
            )}
          </div>

          {/* ── Severity Label (optional) ────────────────────────────────── */}
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
              Severidade{' '}
              <span className="font-normal" style={{ color: 'var(--sophi-text3)' }}>(opcional)</span>
            </label>
            <input
              value={form.severity_label}
              onChange={(e) => setField('severity_label', e.target.value)}
              list="sophi-severity-labels"
              placeholder="Ex: Moderate"
              className={baseInput}
              style={{ borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
            />
            <datalist id="sophi-severity-labels">
              {SEVERITY_LABELS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* ── UEFA Reference Data toggle ───────────────────────────────── */}
          <div
            className="rounded-xl border p-4 space-y-4"
            style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: 'var(--sophi-text)' }}>
                  Dados de Referência UEFA
                </p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--sophi-text3)' }}>
                  Ativar apenas se existem dados do estudo UEFA para esta lesão.
                  Desativado → passa <code className="font-mono text-[10px]">NULL</code> para prevenir alucinações do modelo ML.
                </p>
              </div>
              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={form.has_uefa_data}
                onClick={() => setField('has_uefa_data', !form.has_uefa_data)}
                className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2"
                style={{
                  background: form.has_uefa_data ? 'var(--sophi-green)' : 'var(--sophi-bg4)',
                }}
              >
                <span
                  className="pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-md transition-transform duration-200"
                  style={{
                    background: 'white',
                    transform: form.has_uefa_data ? 'translateX(20px)' : 'translateX(0)',
                  }}
                />
              </button>
            </div>

            {/* Recovery fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className="text-xs font-medium transition-colors"
                  style={{ color: form.has_uefa_data ? 'var(--sophi-text2)' : 'var(--sophi-text3)' }}
                >
                  Recuperação Mínima (dias)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.expected_recovery_min}
                  onChange={(e) => setField('expected_recovery_min', e.target.value)}
                  disabled={!form.has_uefa_data}
                  placeholder="0"
                  className={`${baseInput} disabled:opacity-40 disabled:cursor-not-allowed`}
                  style={{
                    borderColor: errors.expected_recovery_min ? 'var(--sophi-danger)' : 'var(--sophi-border2)',
                    color: 'var(--sophi-text)',
                  }}
                />
                {errors.expected_recovery_min && (
                  <p className="text-xs mt-1" style={{ color: 'var(--sophi-danger)' }}>
                    {errors.expected_recovery_min}
                  </p>
                )}
              </div>
              <div>
                <label
                  className="text-xs font-medium transition-colors"
                  style={{ color: form.has_uefa_data ? 'var(--sophi-text2)' : 'var(--sophi-text3)' }}
                >
                  Recuperação Máxima (dias)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.expected_recovery_max}
                  onChange={(e) => setField('expected_recovery_max', e.target.value)}
                  disabled={!form.has_uefa_data}
                  placeholder="0"
                  className={`${baseInput} disabled:opacity-40 disabled:cursor-not-allowed`}
                  style={{
                    borderColor: errors.expected_recovery_max ? 'var(--sophi-danger)' : 'var(--sophi-border2)',
                    color: 'var(--sophi-text)',
                  }}
                />
                {errors.expected_recovery_max && (
                  <p className="text-xs mt-1" style={{ color: 'var(--sophi-danger)' }}>
                    {errors.expected_recovery_max}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'A guardar…' : 'Guardar Lesão'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
