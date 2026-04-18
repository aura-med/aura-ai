'use client'

import { partialBarColor } from '@/lib/utils'
import type { ScorePartials, ScoreWeights } from '@/types'

const VARIABLE_LABELS: Record<string, string> = {
  history: 'Historial Lesões',
  acwr:    'ACWR GPS',
  hrv:     'HRV Δ Baseline',
  fatigue: 'Fadiga (Hooper)',
  sleep:   'Sono (horas)',
  tqr:     'TQR',
  stress:  'Stress',
  decel:   'Dec. Alta Int.',
  md:      'MD+n',
}

interface Props {
  partials: ScorePartials
  weights: ScoreWeights
  missing: string[]
}

export function PartialScoreBars({ partials, weights, missing }: Props) {
  const vars = Object.keys(weights) as (keyof ScorePartials)[]

  return (
    <div className="space-y-2.5">
      {vars.map((key) => {
        const val = partials[key]
        const isMissing = missing.includes(key)
        const pct = val !== null ? Math.round(val * 100) : 0
        const barColor = val !== null ? partialBarColor(val) : 'var(--aura-text3)'
        const weight = Math.round(weights[key] * 100)

        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--aura-text2)' }}>
                  {VARIABLE_LABELS[key] ?? key}
                </span>
                <span
                  className="text-[10px] font-mono px-1 rounded"
                  style={{
                    background: 'var(--aura-bg3)',
                    color: 'var(--aura-text3)',
                  }}
                >
                  w{weight}%
                </span>
                {isMissing && (
                  <span
                    className="text-[10px] px-1 rounded"
                    style={{ background: 'var(--aura-warn-bg)', color: 'var(--aura-warn)' }}
                  >
                    sem dados
                  </span>
                )}
              </div>
              {!isMissing && (
                <span
                  className="text-xs font-mono font-bold"
                  style={{ color: barColor }}
                >
                  {pct}%
                </span>
              )}
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--aura-bg4)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: isMissing ? '0%' : `${pct}%`,
                  background: barColor,
                  opacity: isMissing ? 0.3 : 1,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
