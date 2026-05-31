'use client'

// apps/admin/app/(admin)/organizations/[id]/recommendations/client.tsx
// Interactive sections: thresholds editor, weights editor, override form

import { useState, useTransition, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Plus, RotateCcw, Save } from 'lucide-react'
import { upsertOrgRecommendationConfig, upsertOrgRecommendationOverride, deactivateOrgOverride, resetOrgRecommendationConfig } from '@/lib/recommendation-actions'
import { ALL_VARIABLES, ALL_RISK_LEVELS, ALL_STAKEHOLDERS, VARIABLE_META } from '@root/lib/recommendations'
import type { RiskLevel } from '@root/types'

// ─── Shared sub-components ─────────────────────────────────────────────────

function SectionToggle({ title, children, defaultOpen = false, forceOpen = false }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  forceOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen || forceOpen)

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  return (
    <div className="rounded-lg border" style={{ borderColor: 'var(--aura-border)', background: 'var(--aura-bg)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold">{title}</span>
        {open ? <ChevronUp size={14} style={{ color: 'var(--aura-text3)' }} /> : <ChevronDown size={14} style={{ color: 'var(--aura-text3)' }} />}
      </button>
      {open && <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--aura-border)' }}>{children}</div>}
    </div>
  )
}

function ActionFeedback({ success, error }: { success?: boolean; error?: string }) {
  if (!success && !error) return null
  return (
    <div
      className="flex items-center gap-2 rounded-md px-3 py-2 text-xs"
      style={{
        background: success ? 'rgba(0,229,160,0.08)' : 'rgba(239,68,68,0.08)',
        color: success ? 'var(--aura-green)' : '#ef4444',
      }}
    >
      {success ? <Check size={12} /> : <AlertTriangle size={12} />}
      {success ? 'Guardado com sucesso' : error}
    </div>
  )
}

// ─── Thresholds Editor ────────────────────────────────────────────────────────

function ThresholdsEditor({ orgId, thresholds }: { orgId: string; thresholds: { medium: number; high: number; critical: number } }) {
  const [vals, setVals] = useState(thresholds)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ success?: boolean; error?: string }>({})

  const RISK_COLORS: Record<string, string> = {
    medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
  }

  function handleSave() {
    startTransition(async () => {
      const res = await upsertOrgRecommendationConfig(orgId, { risk_thresholds: vals })
      setFeedback(res)
    })
  }

  function handleReset() {
    setVals({ medium: 40, high: 65, critical: 85 })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>
        Define the score boundaries (0–100) for each risk band. Lower boundary is inclusive.
        Default: Low &lt;40 · Medium 40–64 · High 65–84 · Critical ≥85.
      </p>

      {/* Visual band preview */}
      <div className="relative h-5 w-full overflow-hidden rounded-full" style={{ background: 'var(--aura-bg3)' }}>
        {[
          { from: 0,             to: vals.medium,   color: 'var(--aura-green)', label: 'Low' },
          { from: vals.medium,   to: vals.high,     color: '#f59e0b',           label: 'Medium' },
          { from: vals.high,     to: vals.critical, color: '#f97316',           label: 'High' },
          { from: vals.critical, to: 100,           color: '#ef4444',           label: 'Critical' },
        ].map((band) => (
          <div
            key={band.label}
            className="absolute inset-y-0 flex items-center justify-center text-[9px] font-bold"
            style={{
              left:       `${band.from}%`,
              width:      `${band.to - band.from}%`,
              background: `${band.color}40`,
              color:      band.color,
            }}
          >
            {band.to - band.from > 10 ? band.label : ''}
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(['medium', 'high', 'critical'] as const).map((level) => (
          <div key={level}>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider" style={{ color: RISK_COLORS[level], fontFamily: 'var(--font-dm-mono)' }}>
              {level} starts at
            </label>
            <input
              type="number"
              min={level === 'medium' ? 1 : level === 'high' ? vals.medium + 1 : vals.high + 1}
              max={level === 'medium' ? vals.high - 1 : level === 'high' ? vals.critical - 1 : 99}
              value={vals[level]}
              onChange={(e) => setVals((prev) => ({ ...prev, [level]: Number(e.target.value) }))}
              className="w-full rounded-md border px-3 py-2 text-sm"
              style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold"
          style={{ background: 'var(--aura-green)', color: 'var(--aura-bg)' }}
        >
          <Save size={13} />
          {isPending ? 'A guardar...' : 'Guardar limiares'}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm"
          style={{ color: 'var(--aura-text2)', border: '1px solid var(--aura-border)' }}
        >
          <RotateCcw size={12} />
          Reset defaults
        </button>
        <ActionFeedback {...feedback} />
      </div>
    </div>
  )
}

// ─── Weights Editor ───────────────────────────────────────────────────────────

function WeightsEditor({ orgId, weights, weightsSum }: { orgId: string; weights: Record<string, number>; weightsSum: number }) {
  const [vals, setVals] = useState<Record<string, number>>(weights)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ success?: boolean; error?: string }>({})

  const sum = Object.values(vals).reduce((a, b) => a + b, 0)
  const sumOk = Math.abs(sum - 1.0) <= 0.02

  function handleChange(variable: string, value: number) {
    setVals((prev) => ({ ...prev, [variable]: Math.round(value * 100) / 100 }))
  }

  function handleSave() {
    startTransition(async () => {
      const res = await upsertOrgRecommendationConfig(orgId, { variable_weights: vals })
      setFeedback(res)
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>
        Weights must sum to 1.0 (±0.02 tolerance). Adjustments must be clinically justified.
        Changes are logged to the audit trail.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {ALL_VARIABLES.map((variable) => {
          const meta = VARIABLE_META[variable]
          const w = vals[variable] ?? 0
          const pct = Math.round(w * 100)
          return (
            <div key={variable} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
                  {meta.label}
                </label>
                <span
                  className="text-xs font-bold"
                  style={{ color: 'var(--aura-green)', fontFamily: 'var(--font-dm-mono)' }}
                >
                  {pct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.40}
                step={0.01}
                value={w}
                onChange={(e) => handleChange(variable, parseFloat(e.target.value))}
                className="w-full accent-[var(--aura-green)]"
              />
              <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--aura-bg3)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(w / 0.40) * 100}%`, background: 'var(--aura-green)' }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <div
          className="rounded px-2 py-1 text-xs font-bold"
          style={{
            background: sumOk ? 'rgba(0,229,160,0.1)' : 'rgba(239,68,68,0.1)',
            color: sumOk ? 'var(--aura-green)' : '#ef4444',
            fontFamily: 'var(--font-dm-mono)',
          }}
        >
          Σ = {sum.toFixed(2)} {sumOk ? '✓' : '⚠ deve ser 1.00'}
        </div>
        <button
          onClick={handleSave}
          disabled={isPending || !sumOk}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--aura-green)', color: 'var(--aura-bg)' }}
        >
          <Save size={13} />
          {isPending ? 'A guardar...' : 'Guardar pesos'}
        </button>
        <ActionFeedback {...feedback} />
      </div>
    </div>
  )
}

// ─── Override Form ────────────────────────────────────────────────────────────

type OverridePrefill = { variable: string; risk_level: RiskLevel; stakeholder: 'clinical' | 'coach' | 'athlete' } | null

function OverrideForm({ orgId, initialValues }: { orgId: string; initialValues?: OverridePrefill }) {
  const [form, setForm] = useState({
    variable:      initialValues?.variable    ?? ALL_VARIABLES[0],
    risk_level:    initialValues?.risk_level  ?? 'high' as RiskLevel,
    stakeholder:   initialValues?.stakeholder ?? 'clinical' as 'clinical' | 'coach' | 'athlete',
    override_type: 'text_only' as 'text_only' | 'add_rule' | 'deactivate',
    custom_text:   '',
    custom_icon:   '',
    custom_timing: '',
    justification: '',
  })
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ success?: boolean; error?: string }>({})
  const [open, setOpen] = useState(!!initialValues)

  useEffect(() => {
    if (initialValues) {
      setForm(prev => ({
        ...prev,
        variable:    initialValues.variable,
        risk_level:  initialValues.risk_level,
        stakeholder: initialValues.stakeholder,
      }))
      setOpen(true)
    }
  }, [initialValues])

  function handleSubmit() {
    startTransition(async () => {
      const res = await upsertOrgRecommendationOverride(orgId, form)
      setFeedback(res)
      if (res.success) {
        setOpen(false)
        setForm((prev) => ({ ...prev, custom_text: '', justification: '' }))
      }
    })
  }

  const selectClass = "w-full rounded-md border px-2.5 py-2 text-sm"
  const selectStyle = { background: 'var(--aura-bg3)', borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }

  return (
    <div className="space-y-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:border-[var(--aura-green)]"
          style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text2)' }}
        >
          <Plus size={13} />
          Add rule override
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: 'var(--aura-border)' }}>
          <p className="text-sm font-semibold">New rule override</p>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--aura-text3)' }}>Variable</label>
              <select value={form.variable} onChange={(e) => setForm((p) => ({ ...p, variable: e.target.value }))} className={selectClass} style={selectStyle}>
                {ALL_VARIABLES.map((v) => <option key={v} value={v}>{VARIABLE_META[v]?.label ?? v}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--aura-text3)' }}>Risk Level</label>
              <select value={form.risk_level} onChange={(e) => setForm((p) => ({ ...p, risk_level: e.target.value as RiskLevel }))} className={selectClass} style={selectStyle}>
                {ALL_RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--aura-text3)' }}>Stakeholder</label>
              <select value={form.stakeholder} onChange={(e) => setForm((p) => ({ ...p, stakeholder: e.target.value as any }))} className={selectClass} style={selectStyle}>
                {ALL_STAKEHOLDERS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--aura-text3)' }}>Override Type</label>
              <select value={form.override_type} onChange={(e) => setForm((p) => ({ ...p, override_type: e.target.value as any }))} className={selectClass} style={selectStyle}>
                <option value="text_only">Text only</option>
                <option value="add_rule">Add rule</option>
                <option value="deactivate">Deactivate</option>
              </select>
            </div>
          </div>

          {form.override_type !== 'deactivate' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--aura-text3)' }}>Custom text *</label>
                <input
                  type="text"
                  value={form.custom_text}
                  onChange={(e) => setForm((p) => ({ ...p, custom_text: e.target.value }))}
                  placeholder="Recommendation text..."
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  style={selectStyle}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--aura-text3)' }}>Timing</label>
                <input
                  type="text"
                  value={form.custom_timing}
                  onChange={(e) => setForm((p) => ({ ...p, custom_timing: e.target.value }))}
                  placeholder="e.g. Hoje"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  style={selectStyle}
                />
              </div>
            </div>
          )}

          {form.override_type === 'deactivate' && (
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: '#ef4444' }}>
                Clinical justification * (required for deactivations — logged to audit trail)
              </label>
              <textarea
                value={form.justification}
                onChange={(e) => setForm((p) => ({ ...p, justification: e.target.value }))}
                placeholder="Clinical reason for deactivating this base rule for this organisation..."
                rows={3}
                className="w-full rounded-md border px-3 py-2 text-sm"
                style={selectStyle}
              />
            </div>
          )}

          {form.override_type === 'text_only' && (
            <div
              className="flex items-start gap-2 rounded-md p-3 text-xs"
              style={{ background: 'rgba(0,229,160,0.06)', color: 'var(--aura-text2)' }}
            >
              <AlertTriangle size={12} style={{ color: 'var(--aura-green)', flexShrink: 0, marginTop: 1 }} />
              Text-only override preserves the clinical direction — the recommendation's intent cannot be altered.
            </div>
          )}

          {form.override_type === 'deactivate' && (
            <div
              className="flex items-start gap-2 rounded-md p-3 text-xs"
              style={{ background: 'rgba(239,68,68,0.06)', color: '#ef4444' }}
            >
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              Safety-critical rules (locked) cannot be deactivated regardless of override. Only rules marked as overridable will be hidden.
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--aura-green)', color: 'var(--aura-bg)' }}
            >
              <Save size={13} />
              {isPending ? 'A guardar...' : 'Save override'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-1.5 text-sm"
              style={{ color: 'var(--aura-text2)', border: '1px solid var(--aura-border)' }}
            >
              Cancel
            </button>
            <ActionFeedback {...feedback} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function RecommendationConfigClient({
  orgId,
  thresholds,
  weights,
  weightsSum,
  contextType,
  language,
}: {
  orgId:       string
  thresholds:  { medium: number; high: number; critical: number }
  weights:     Record<string, number>
  weightsSum:  number
  contextType: 'club' | 'federation'
  language:    'pt' | 'en' | 'es'
}) {
  const searchParams = useSearchParams()
  const overrideSectionRef = useRef<HTMLDivElement>(null)

  const parsedOverride = useMemo<OverridePrefill>(() => {
    const param = searchParams.get('override')
    if (!param) return null
    const [variable, risk_level, stakeholder] = param.split('__')
    if (!variable || !risk_level || !stakeholder) return null
    return {
      variable,
      risk_level:  risk_level  as RiskLevel,
      stakeholder: stakeholder as 'clinical' | 'coach' | 'athlete',
    }
  }, [searchParams])

  useEffect(() => {
    if (parsedOverride && overrideSectionRef.current) {
      overrideSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [parsedOverride])

  const [isPending, startTransition] = useTransition()
  const [ctxFeedback, setCtxFeedback] = useState<{ success?: boolean; error?: string }>({})

  function handleContextSave(field: 'context_type' | 'language', value: string) {
    startTransition(async () => {
      const res = await upsertOrgRecommendationConfig(orgId, { [field]: value as any })
      setCtxFeedback(res)
    })
  }

  return (
    <div className="space-y-3">
      {/* Context type */}
      <SectionToggle title="Deployment Context" defaultOpen>
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>
            Context affects ACWR calculation behaviour and match-day (MD+n) logic.
          </p>
          <div className="flex items-center gap-4">
            {(['club', 'federation'] as const).map((ct) => (
              <button
                key={ct}
                onClick={() => handleContextSave('context_type', ct)}
                className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-all"
                style={contextType === ct
                  ? { borderColor: 'var(--aura-green)', color: 'var(--aura-green)', background: 'rgba(0,229,160,0.08)' }
                  : { borderColor: 'var(--aura-border)', color: 'var(--aura-text2)' }
                }
              >
                <span className="capitalize">{ct}</span>
                {contextType === ct && <Check size={12} />}
              </button>
            ))}
            {(['pt', 'en', 'es'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => handleContextSave('language', lang)}
                className="rounded-md border px-3 py-2 text-sm font-semibold uppercase transition-all"
                style={language === lang
                  ? { borderColor: 'var(--aura-green)', color: 'var(--aura-green)', background: 'rgba(0,229,160,0.08)' }
                  : { borderColor: 'var(--aura-border)', color: 'var(--aura-text2)' }
                }
              >
                {lang}
              </button>
            ))}
            <ActionFeedback {...ctxFeedback} />
          </div>
          {contextType === 'federation' && (
            <div
              className="rounded-md p-3 text-xs"
              style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }}
            >
              ⚠ Federation context: ACWR is structurally limited in early camp days (insufficient chronic window).
              Within-camp metrics and the Day 1 arrival protocol substitute for canonical ACWR.
            </div>
          )}
        </div>
      </SectionToggle>

      {/* Thresholds */}
      <SectionToggle title="Risk Band Thresholds">
        <ThresholdsEditor orgId={orgId} thresholds={thresholds} />
      </SectionToggle>

      {/* Weights */}
      <SectionToggle title="Variable Weights">
        <WeightsEditor orgId={orgId} weights={weights} weightsSum={weightsSum} />
      </SectionToggle>

      {/* Override form */}
      <div ref={overrideSectionRef}>
        <SectionToggle title="Add Rule Override" forceOpen={!!parsedOverride}>
          <OverrideForm orgId={orgId} initialValues={parsedOverride} />
        </SectionToggle>
      </div>
    </div>
  )
}
