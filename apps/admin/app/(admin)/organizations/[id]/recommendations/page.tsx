// apps/admin/app/(admin)/organizations/[id]/recommendations/page.tsx
// Aura Admin — Recommendation Model Configuration per Organisation
// NOT gated by Support Mode — this is platform config, not sensitive athlete data.

import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowLeft, BookOpen, ChevronRight, FlaskConical, Info, Lock, Shield } from 'lucide-react'
import { Card, PageHeader, StatusBadge } from '@/components/ui'
import { getOrgRecommendationsData } from '@/lib/admin-data'
import { ALL_VARIABLES, ALL_RISK_LEVELS, ALL_STAKEHOLDERS, RULES, FALLBACK, VARIABLE_META } from '@root/lib/recommendations'
import type { RiskLevel } from '@root/types'
import { RecommendationConfigClient } from './client'

const DEFAULT_THRESHOLDS = { medium: 40, high: 65, critical: 85 }
const DEFAULT_WEIGHTS     = {
  history: 0.20, acwr: 0.20, hrv: 0.18,
  fatigue: 0.13, sleep: 0.12, tqr: 0.07,
  stress: 0.04, decel: 0.04, md: 0.02,
}

const RISK_COLORS: Record<RiskLevel, string> = {
  low:      'var(--aura-green)',
  medium:   '#f59e0b',
  high:     '#f97316',
  critical: '#ef4444',
}

const EVIDENCE_LEVEL_COLORS: Record<string, string> = {
  Ia:     'var(--aura-green)',
  Ib:     'var(--aura-green)',
  IIa:    '#f59e0b',
  IIb:    '#f59e0b',
  III:    '#f97316',
  IV:     'var(--aura-text3)',
  Expert: 'var(--aura-text3)',
}

function EvidenceBadge({ level }: { level: string }) {
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
      style={{
        background: `${EVIDENCE_LEVEL_COLORS[level]}20`,
        color: EVIDENCE_LEVEL_COLORS[level],
        fontFamily: 'var(--font-dm-mono)',
      }}
    >
      {level}
    </span>
  )
}

function DirectionBadge({ direction }: { direction: string }) {
  const colors: Record<string, string> = {
    reduce_load: '#f97316',
    rest:        '#ef4444',
    monitor:     '#f59e0b',
    maintain:    'var(--aura-green)',
    assess:      '#8b5cf6',
    communicate: '#3b82f6',
  }
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
      style={{
        background: `${colors[direction] ?? 'var(--aura-text3)'}18`,
        color: colors[direction] ?? 'var(--aura-text3)',
        fontFamily: 'var(--font-dm-mono)',
      }}
    >
      {direction.replace('_', ' ')}
    </span>
  )
}

export default async function OrgRecommendationsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getOrgRecommendationsData(id)

  if (!data.organization) {
    return (
      <div className="space-y-6">
        <PageHeader title="Organisation not found" description="" />
      </div>
    )
  }

  const config    = data.config
  const overrides = data.overrides
  const thresholds = config?.risk_thresholds  ?? DEFAULT_THRESHOLDS
  const weights    = config?.variable_weights ?? DEFAULT_WEIGHTS

  const weightsSum = Object.values(weights as Record<string, number>)
    .reduce((a, b) => a + b, 0)

  // Build full rules matrix for display
  const rulesMatrix = ALL_VARIABLES.flatMap((variable) =>
    ALL_RISK_LEVELS.flatMap((riskLevel) =>
      ALL_STAKEHOLDERS.map((stakeholder) => {
        const rules =
          (RULES as any)[variable]?.[riskLevel]?.[stakeholder] ??
          (FALLBACK as any)[riskLevel]?.[stakeholder] ??
          []
        const activeOverride = overrides.find(
          (o) =>
            o.variable    === variable   &&
            o.risk_level  === riskLevel  &&
            o.stakeholder === stakeholder &&
            o.is_active,
        )
        return { variable, riskLevel, stakeholder, rules, activeOverride }
      }),
    ),
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--aura-text3)' }}>
        <Link href="/organizations" className="hover:text-[var(--aura-text)] transition-colors">
          Organizations
        </Link>
        <ChevronRight size={12} />
        <Link href={`/organizations/${id}`} className="hover:text-[var(--aura-text)] transition-colors">
          {data.organization.name}
        </Link>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--aura-text)' }}>Recommendation Model</span>
      </div>

      <PageHeader
        title={`Recommendation Model — ${data.organization.name}`}
        description="Configure risk thresholds, variable weights, and rule overrides for this organisation. Base rules are grounded in best available evidence and clinical direction is immutable."
      />

      {/* EU AI Act notice */}
      <Card>
        <div className="flex items-start gap-3">
          <Shield size={16} style={{ color: 'var(--aura-green)', flexShrink: 0, marginTop: 2 }} />
          <div className="space-y-1">
            <p className="text-sm font-semibold">EU AI Act Compliance — Art. 13 &amp; 14</p>
            <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>
              All base rules include bibliographic evidence references visible to clinicians (Art. 13 transparency).
              Clinical direction cannot be altered by any org override — human clinical judgement is always final (Art. 14).
              Rule deactivations require written justification logged to the audit trail.
            </p>
          </div>
        </div>
      </Card>

      {/* Config status */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
            Configuration
          </p>
          <p className="mt-1 text-lg font-semibold">
            {config ? 'Custom' : 'Default'}
          </p>
          <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>
            {config ? `Updated ${new Date(config.updated_at).toLocaleDateString('pt-PT')}` : 'Using Aura global defaults'}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
            Active Overrides
          </p>
          <p className="mt-1 text-lg font-semibold">{overrides.filter((o) => o.is_active).length}</p>
          <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>
            {overrides.filter((o) => o.override_type === 'deactivate' && o.is_active).length} deactivations
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
            Context
          </p>
          <p className="mt-1 text-lg font-semibold capitalize">{config?.context_type ?? 'club'}</p>
          <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>
            {config?.language?.toUpperCase() ?? 'PT'} · ACWR {config?.context_type === 'federation' ? 'condicionado' : 'canónico'}
          </p>
        </Card>
      </div>

      {/* Interactive config panels — client component */}
      <Suspense fallback={null}>
        <RecommendationConfigClient
          orgId={id}
          thresholds={thresholds as { medium: number; high: number; critical: number }}
          weights={weights as Record<string, number>}
          weightsSum={weightsSum}
          contextType={config?.context_type ?? 'club'}
          language={config?.language ?? 'pt'}
        />
      </Suspense>

      {/* Rules Library */}
      <Card className="overflow-x-auto p-0">
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--aura-border)' }}>
          <div className="flex items-center gap-2">
            <BookOpen size={14} style={{ color: 'var(--aura-green)' }} />
            <h2 className="text-sm font-semibold">Evidence-Based Rule Library</h2>
          </div>
          <span className="text-xs" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
            {ALL_VARIABLES.length} variables · {ALL_RISK_LEVELS.length} levels · {ALL_STAKEHOLDERS.length} stakeholders
          </span>
        </div>

        {/* Variable sections */}
        {ALL_VARIABLES.map((variable) => {
          const meta = VARIABLE_META[variable]
          const varOverrides = overrides.filter((o) => o.variable === variable && o.is_active)

          return (
            <div key={variable}>
              {/* Variable header */}
              <div
                className="flex items-center gap-3 border-b px-4 py-2.5"
                style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border)' }}
              >
                <span className="text-sm font-semibold">{meta.label}</span>
                <EvidenceBadge level={meta.evidenceLevel} />
                <span className="text-xs" style={{ color: 'var(--aura-text3)' }}>
                  {meta.evidence}
                </span>
                {varOverrides.length > 0 && (
                  <StatusBadge tone="green">{varOverrides.length} override{varOverrides.length > 1 ? 's' : ''}</StatusBadge>
                )}
              </div>

              {/* Rules table for this variable */}
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Risk</th>
                    <th style={{ width: 90 }}>Stakeholder</th>
                    <th>Rule text</th>
                    <th style={{ width: 80 }}>Direction</th>
                    <th style={{ width: 70 }}>Timing</th>
                    <th style={{ width: 60 }}>Lock</th>
                    <th style={{ width: 100 }}>Override</th>
                  </tr>
                </thead>
                <tbody>
                  {ALL_RISK_LEVELS.flatMap((riskLevel) =>
                    ALL_STAKEHOLDERS.flatMap((stakeholder) => {
                      const rules =
                        (RULES as any)[variable]?.[riskLevel]?.[stakeholder] ??
                        (FALLBACK as any)[riskLevel]?.[stakeholder] ??
                        []
                      const activeOverride = overrides.find(
                        (o) =>
                          o.variable    === variable &&
                          o.risk_level  === riskLevel &&
                          o.stakeholder === stakeholder &&
                          o.is_active,
                      )

                      return rules.map((rule: any, ruleIdx: number) => (
                        <tr
                          key={`${variable}-${riskLevel}-${stakeholder}-${ruleIdx}`}
                          style={activeOverride ? { background: 'rgba(0,229,160,0.04)' } : undefined}
                        >
                          {ruleIdx === 0 && (
                            <>
                              <td rowSpan={rules.length}>
                                <span
                                  className="inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                                  style={{
                                    background: `${RISK_COLORS[riskLevel as RiskLevel]}18`,
                                    color: RISK_COLORS[riskLevel as RiskLevel],
                                    fontFamily: 'var(--font-dm-mono)',
                                  }}
                                >
                                  {riskLevel}
                                </span>
                              </td>
                              <td rowSpan={rules.length}>
                                <StatusBadge tone={stakeholder === 'clinical' ? 'green' : 'neutral'}>
                                  {stakeholder}
                                </StatusBadge>
                              </td>
                            </>
                          )}
                          <td>
                            <div className="space-y-1">
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--aura-text)' }}>
                                {rule.icon} {rule.text}
                              </p>
                              {activeOverride && activeOverride.override_type === 'text_only' && ruleIdx === 0 && (
                                <p className="text-xs italic" style={{ color: 'var(--aura-green)' }}>
                                  → Override: {activeOverride.custom_text}
                                </p>
                              )}
                            </div>
                          </td>
                          <td>
                            <DirectionBadge direction={rule.clinical_direction} />
                          </td>
                          <td className="text-xs" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
                            {rule.timing ?? '—'}
                          </td>
                          <td>
                            {!rule.overridable ? (
                              <div className="flex items-center gap-1">
                                <Lock size={10} style={{ color: 'var(--aura-warn)' }} />
                                <span className="text-[9px]" style={{ color: 'var(--aura-warn)', fontFamily: 'var(--font-dm-mono)' }}>
                                  LOCKED
                                </span>
                              </div>
                            ) : (
                              <Link
                                href={`?override=${variable}__${riskLevel}__${stakeholder}`}
                                scroll={false}
                                className="text-[9px] transition-colors hover:text-[var(--aura-green)]"
                                style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)', textDecoration: 'none' }}
                              >
                                ↓ override
                              </Link>
                            )}
                          </td>
                          {ruleIdx === 0 && (
                            <td rowSpan={rules.length}>
                              {activeOverride ? (
                                <div className="space-y-1">
                                  <StatusBadge tone={activeOverride.override_type === 'deactivate' ? 'danger' : 'green'}>
                                    {activeOverride.override_type}
                                  </StatusBadge>
                                  {/* Deactivate button rendered in client component */}
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: 'var(--aura-text3)' }}>—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    }),
                  )}
                </tbody>
              </table>
            </div>
          )
        })}
      </Card>

      {/* Active overrides summary */}
      {overrides.filter((o) => o.is_active).length > 0 && (
        <Card className="overflow-x-auto p-0">
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--aura-border)' }}>
            <h2 className="text-sm font-semibold">Active Overrides for this Organisation</h2>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Risk</th>
                <th>Stakeholder</th>
                <th>Type</th>
                <th>Custom text</th>
                <th>Justification</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {overrides.filter((o) => o.is_active).map((override) => (
                <tr key={override.id}>
                  <td className="font-medium">{VARIABLE_META[override.variable]?.label ?? override.variable}</td>
                  <td>
                    <span
                      className="inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        background: `${RISK_COLORS[override.risk_level]}18`,
                        color: RISK_COLORS[override.risk_level],
                        fontFamily: 'var(--font-dm-mono)',
                      }}
                    >
                      {override.risk_level}
                    </span>
                  </td>
                  <td>
                    <StatusBadge tone={override.stakeholder === 'clinical' ? 'green' : 'neutral'}>
                      {override.stakeholder}
                    </StatusBadge>
                  </td>
                  <td>
                    <StatusBadge tone={override.override_type === 'deactivate' ? 'danger' : 'green'}>
                      {override.override_type}
                    </StatusBadge>
                  </td>
                  <td className="max-w-xs">
                    <p className="truncate text-xs" style={{ color: 'var(--aura-text2)' }}>
                      {override.custom_text ?? '—'}
                    </p>
                  </td>
                  <td className="max-w-xs">
                    <p className="truncate text-xs" style={{ color: 'var(--aura-text2)' }}>
                      {override.justification ?? '—'}
                    </p>
                  </td>
                  <td className="text-xs" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
                    {new Date(override.created_at).toLocaleDateString('pt-PT')}
                  </td>
                  <td>
                    {/* Deactivate button — handled in client component */}
                    <span className="text-xs" style={{ color: 'var(--aura-text3)' }}>via client</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
