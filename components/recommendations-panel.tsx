'use client'

// components/recommendations-panel.tsx
// Aura — Recommendations Panel (main app)
//
// onAcknowledge matches the signature of acknowledgeRecommendations() server action:
//   (logId: string, stakeholder: 'clinical' | 'coach') => Promise<{success, error?}>
// Pass the server action directly from the athlete detail page.

import { useState } from 'react'
import type { RecommendationSet, Recommendation, UserRole } from '@/types'

interface Props {
  recommendations:  RecommendationSet
  logId:            string | null
  generatedAt:      string
  dominantVariable: string | null
  riskLevel:        'low' | 'medium' | 'high' | 'critical'
  confidence:       'high' | 'medium' | 'low'
  viewerRole:       UserRole
  acknowledged:     { clinical: boolean; coach: boolean }
  onAcknowledge?:   (logId: string, stakeholder: 'clinical' | 'coach') => Promise<{ success: boolean; error?: string }>
}

const RISK_CONFIG = {
  low:      { color: 'var(--aura-green)',  bg: 'rgba(0,229,160,0.08)',  label: 'Baixo Risco' },
  medium:   { color: '#f59e0b',            bg: 'rgba(245,158,11,0.08)', label: 'Risco Moderado' },
  high:     { color: '#f97316',            bg: 'rgba(249,115,22,0.08)', label: 'Risco Elevado' },
  critical: { color: '#ef4444',            bg: 'rgba(239,68,68,0.08)',  label: 'Risco Crítico' },
}

const REC_TYPE_CONFIG = {
  success:  { color: 'var(--aura-green)', bg: 'rgba(0,229,160,0.06)' },
  info:     { color: '#3b82f6',           bg: 'rgba(59,130,246,0.06)' },
  warning:  { color: '#f97316',           bg: 'rgba(249,115,22,0.06)' },
  critical: { color: '#ef4444',           bg: 'rgba(239,68,68,0.06)' },
}

const VARIABLE_LABELS: Record<string, string> = {
  history: 'Historial de Lesão',
  acwr:    'Carga (ACWR)',
  hrv:     'HRV',
  fatigue: 'Fadiga',
  sleep:   'Sono',
  tqr:     'Recuperação (TQR)',
  stress:  'Stress',
  decel:   'Decelerações',
  md:      'Pós-Jogo',
}

const STAKEHOLDER_TABS: { key: keyof RecommendationSet; label: string; roles: UserRole[] }[] = [
  { key: 'clinical', label: 'Clínico',   roles: ['admin', 'doctor', 'physio'] },
  { key: 'coach',    label: 'Treinador', roles: ['admin', 'coach', 'fitness_coach', 'doctor', 'physio'] },
  { key: 'athlete',  label: 'Atleta',    roles: ['admin', 'athlete', 'doctor', 'physio', 'coach', 'fitness_coach'] },
]

function RecCard({ rec }: { rec: Recommendation }) {
  const cfg = REC_TYPE_CONFIG[rec.type] ?? REC_TYPE_CONFIG.info
  return (
    <div
      className="flex items-start gap-3 rounded-lg p-3"
      style={{ background: cfg.bg, borderLeft: `3px solid ${cfg.color}` }}
    >
      <span className="text-base leading-none">{rec.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--aura-text)' }}>
          {rec.text}
        </p>
        {rec.timing && rec.timing !== '—' && (
          <span
            className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: `${cfg.color}20`,
              color: cfg.color,
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            {rec.timing}
          </span>
        )}
      </div>
    </div>
  )
}

function ConfidencePill({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const cfg = {
    high:   { color: 'var(--aura-green)', label: 'Alta confiança' },
    medium: { color: '#f59e0b',           label: 'Confiança média' },
    low:    { color: '#ef4444',           label: 'Dados incompletos' },
  }[confidence]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `${cfg.color}15`, color: cfg.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

export function RecommendationsPanel({
  recommendations,
  logId,
  generatedAt,
  dominantVariable,
  riskLevel,
  confidence,
  viewerRole,
  acknowledged,
  onAcknowledge,
}: Props) {
  const riskCfg = RISK_CONFIG[riskLevel]

  const defaultTab = viewerRole === 'athlete'
    ? 'athlete'
    : viewerRole === 'coach' || viewerRole === 'fitness_coach'
    ? 'coach'
    : 'clinical'

  const [activeTab, setActiveTab]         = useState<keyof RecommendationSet>(defaultTab)
  const [isAcknowledging, setIsAck]       = useState(false)
  const [localAcknowledged, setLocalAck]  = useState(acknowledged)
  const [ackError, setAckError]           = useState<string | null>(null)

  const visibleTabs  = STAKEHOLDER_TABS.filter((t) => t.roles.includes(viewerRole))
  const currentRecs  = recommendations[activeTab] ?? []

  const canAcknowledge =
    (activeTab === 'clinical' && ['admin', 'doctor', 'physio'].includes(viewerRole)) ||
    (activeTab === 'coach'    && ['admin', 'coach', 'fitness_coach'].includes(viewerRole))

  const isAcknowledged =
    (activeTab === 'clinical' && localAcknowledged.clinical) ||
    (activeTab === 'coach'    && localAcknowledged.coach)

  async function handleAcknowledge() {
    if (!onAcknowledge || !logId) return
    const stakeholder = activeTab === 'clinical' ? 'clinical' : 'coach'
    setAckError(null)
    setIsAck(true)
    try {
      const res = await onAcknowledge(logId, stakeholder)
      if (res.success) {
        setLocalAck((prev) => ({ ...prev, [stakeholder]: true }))
      } else {
        setAckError(res.error ?? 'Não foi possível registar o visto.')
      }
    } catch {
      setAckError('Não foi possível registar o visto.')
    } finally {
      setIsAck(false)
    }
  }

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ border: '1px solid var(--aura-border)', background: 'var(--aura-bg2)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: riskCfg.bg, borderBottom: `1px solid ${riskCfg.color}30` }}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full" style={{ background: riskCfg.color }} />
          <span className="text-sm font-semibold" style={{ color: riskCfg.color }}>
            {riskCfg.label}
          </span>
          {dominantVariable && (
            <span className="text-xs" style={{ color: 'var(--aura-text3)' }}>
              · {VARIABLE_LABELS[dominantVariable] ?? dominantVariable}
            </span>
          )}
        </div>
        <ConfidencePill confidence={confidence} />
      </div>

      {/* Tabs */}
      {visibleTabs.length > 1 && (
        <div className="flex border-b" style={{ borderColor: 'var(--aura-border)' }}>
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 px-4 py-2.5 text-xs font-semibold transition-colors"
              style={
                activeTab === tab.key
                  ? { color: 'var(--aura-green)', borderBottom: '2px solid var(--aura-green)' }
                  : { color: 'var(--aura-text3)', borderBottom: '2px solid transparent' }
              }
            >
              {tab.label}
              {tab.key === 'clinical' && localAcknowledged.clinical && (
                <span className="ml-1 text-[9px] opacity-60">✓</span>
              )}
              {tab.key === 'coach' && localAcknowledged.coach && (
                <span className="ml-1 text-[9px] opacity-60">✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Recommendations */}
      <div className="space-y-2 p-4">
        {currentRecs.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>
            Sem recomendações para este nível de risco.
          </p>
        ) : (
          currentRecs.map((rec, i) => <RecCard key={i} rec={rec} />)
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between gap-3 border-t px-4 py-2.5"
        style={{ borderColor: 'var(--aura-border)' }}
      >
        <div>
          <p className="text-[10px]" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono, monospace)' }}>
            {new Date(generatedAt).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            {' · Suporte à decisão — não substitui julgamento clínico'}
          </p>
          {ackError && (
            <p className="mt-1 text-[11px]" role="alert" style={{ color: 'var(--aura-danger)' }}>
              {ackError}
            </p>
          )}
        </div>

        {canAcknowledge && logId && onAcknowledge && (
          <button
            onClick={handleAcknowledge}
            disabled={isAcknowledged || isAcknowledging}
            className="flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all disabled:opacity-50"
            style={
              isAcknowledged
                ? { background: 'rgba(0,229,160,0.1)', color: 'var(--aura-green)' }
                : { background: 'var(--aura-bg3)', color: 'var(--aura-text2)', border: '1px solid var(--aura-border)' }
            }
          >
            {isAcknowledging ? 'A registar...' : isAcknowledged ? '✓ Visto' : 'Marcar como visto'}
          </button>
        )}
      </div>
    </div>
  )
}
