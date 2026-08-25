import type { ReadinessIndicator } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  green: 'var(--sophi-green)',
  amber: 'var(--sophi-warn)',
  red: 'var(--sophi-danger)',
  grey: 'var(--sophi-text3)',
}

export function ReadinessRow({ indicators }: { indicators: ReadinessIndicator[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {indicators.map((ind) => (
        <div
          key={ind.label}
          className="rounded-lg border p-3 flex flex-col gap-1"
          style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wide" style={{ color: 'var(--sophi-text3)' }}>
              {ind.label}
            </span>
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: STATUS_COLORS[ind.status] }}
            />
          </div>
          <span className="text-lg font-bold font-mono" style={{ color: STATUS_COLORS[ind.status] }}>
            {ind.value}
          </span>
          {ind.detail && (
            <span className="text-[10px]" style={{ color: 'var(--sophi-text3)' }}>
              {ind.detail}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
