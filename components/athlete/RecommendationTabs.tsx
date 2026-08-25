'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getRecommendations, type Stakeholder } from '@/lib/recommendations'
import type { RiskLevel } from '@/types'

const STAKEHOLDERS: { value: Stakeholder; label: string; icon: string }[] = [
  { value: 'clinical', label: 'Clínico', icon: '🩺' },
  { value: 'coach', label: 'Treinador', icon: '🎽' },
  { value: 'athlete', label: 'Atleta', icon: '⚽' },
]

export function RecommendationTabs({
  dominantVariable,
  riskLevel,
}: {
  dominantVariable: string | null
  riskLevel: RiskLevel
}) {
  const [active, setActive] = useState<Stakeholder>('clinical')
  const recommendations = getRecommendations(dominantVariable, riskLevel, active)

  return (
    <div>
      {/* Tab buttons */}
      <div
        className="flex gap-1 mb-3 p-1 rounded-lg"
        style={{ background: 'var(--sophi-bg3)' }}
      >
        {STAKEHOLDERS.map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => setActive(value)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              active === value
                ? 'text-[var(--sophi-text)]'
                : 'text-[var(--sophi-text3)] hover:text-[var(--sophi-text2)]'
            )}
            style={active === value ? { background: 'var(--sophi-bg2)' } : {}}
          >
            <span>{icon}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Recommendations list */}
      <div className="space-y-2">
        {recommendations.length === 0 ? (
          <p className="text-xs py-3 text-center" style={{ color: 'var(--sophi-text3)' }}>
            Sem recomendações para este nível de risco.
          </p>
        ) : (
          recommendations.map((rec, i) => (
            <div
              key={i}
              className="flex gap-3 p-3 rounded-lg"
              style={{ background: 'var(--sophi-bg3)' }}
            >
              <span className="text-base mt-0.5">{rec.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-snug" style={{ color: 'var(--sophi-text)' }}>
                  {rec.text}
                </p>
                {rec.timing && (
                  <p className="text-[11px] mt-1 font-mono" style={{ color: 'var(--sophi-text3)' }}>
                    {rec.timing}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
