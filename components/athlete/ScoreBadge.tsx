'use client'

import { cn } from '@/lib/utils'
import { riskColor, riskLabel, riskBgClass } from '@/lib/utils'
import type { RiskLevel, Confidence } from '@/types'

interface ScoreBadgeProps {
  score: number
  level: RiskLevel
  confidence?: Confidence
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ScoreBadge({ score, level, confidence, size = 'md', className }: ScoreBadgeProps) {
  const color = riskColor(level)
  const label = riskLabel(level)

  if (size === 'lg') {
    return (
      <div className={cn('flex flex-col items-center gap-1', className)}>
        <div
          className="relative flex items-center justify-center w-24 h-24 rounded-full border-2"
          style={{ borderColor: color, background: `${color}12` }}
        >
          <div className="text-center">
            <div
              className="text-3xl font-bold font-mono leading-none"
              style={{ color }}
            >
              {score}
            </div>
            <div className="text-xs" style={{ color: 'var(--aura-text3)' }}>%</div>
          </div>
        </div>
        <span
          className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border"
          style={{ color, borderColor: `${color}40`, background: `${color}12` }}
        >
          {label}
        </span>
        {confidence && (
          <span
            className="text-[10px] font-mono"
            style={{ color: 'var(--aura-text3)' }}
          >
            conf. {confidence === 'high' ? 'alta' : confidence === 'medium' ? 'média' : 'baixa'}
          </span>
        )}
      </div>
    )
  }

  if (size === 'sm') {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <span
          className="text-sm font-bold font-mono"
          style={{ color }}
        >
          {score}%
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
          style={{ background: `${color}15`, color }}
        >
          {label}
        </span>
      </div>
    )
  }

  // md (default)
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="flex items-baseline gap-0.5"
        style={{ color }}
      >
        <span className="text-2xl font-bold font-mono">{score}</span>
        <span className="text-sm">%</span>
      </div>
      <div className="flex flex-col">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full border"
          style={{ color, borderColor: `${color}40`, background: `${color}12` }}
        >
          {label}
        </span>
        {confidence && (
          <span className="text-[10px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>
            Conf. {confidence === 'high' ? 'Alta' : confidence === 'medium' ? 'Média' : 'Baixa'}
          </span>
        )}
      </div>
    </div>
  )
}
