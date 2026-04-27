import { riskColor, riskLevel, confidenceLabel, VAR_ICONS, VAR_LABELS } from '@/lib/scoring'
import type { Confidence, AthleteScore } from '@/types'

// ── ScoreBadge ────────────────────────────────────────────────────
export function ScoreBadge({ score }: { score: number }) {
  const level = riskLevel(score)
  return (
    <span className={`score-badge sb-${level}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: riskColor(score), display: 'inline-block' }} />
      {score}%
    </span>
  )
}

// ── ConfBadge ─────────────────────────────────────────────────────
export function ConfBadge({ confidence, reason, missing = [] }: {
  confidence: Confidence
  reason?: string
  missing?: string[]
}) {
  const cls = { high: 'conf-high', medium: 'conf-med', low: 'conf-low' }[confidence]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className={`conf ${cls}`} title={reason}>
        {confidenceLabel(confidence)}
      </span>
      {missing.length > 0 && (
        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          ({missing.length} var. ausente{missing.length > 1 ? 's' : ''})
        </span>
      )}
    </span>
  )
}

// ── DecompositionBars ─────────────────────────────────────────────
export function DecompositionBars({ calc }: { calc: AthleteScore }) {
  const missingWeightTotal = calc.missing.reduce(
    (s, k) => s + (calc.effective_weights[k] ?? 0),
    0
  )

  return (
    <div>
      {calc.missing.length > 0 && (
        <div className="alert alert-w" style={{ marginBottom: 10 }}>
          <div className="adot ad-w" />
          <div style={{ fontSize: 11.5 }}>
            <strong style={{ color: 'var(--warn)' }}>
              ⚠ {calc.missing.length} variável{calc.missing.length > 1 ? 'is' : ''} ausente{calc.missing.length > 1 ? 's' : ''}
            </strong>
            {' — peso total de '}
            <strong style={{ color: 'var(--warn)' }}>
              {Math.round(missingWeightTotal * 100)}%
            </strong>
            {' redistribuído pelas restantes variáveis.'}
          </div>
        </div>
      )}

      {Object.entries(calc.partials).map(([k, p]) => {
        const isAbsent = p === null
        const ew = calc.effective_weights[k] ?? 0
        const origW = 0 // we don't store orig here; show effective only
        const weightChanged = !isAbsent && ew > 0

        if (isAbsent) return (
          <div key={k} className="bar-row" style={{ opacity: 0.4 }}>
            <div className="bar-name" style={{ textDecoration: 'line-through', color: 'var(--text3)' }}>
              {VAR_ICONS[k]} {VAR_LABELS[k]}
            </div>
            <div className="bar-track"><div className="bar-fill" style={{ width: 0 }} /></div>
            <div className="bar-val" style={{ color: 'var(--text3)', fontSize: 10 }}>ausente</div>
            <div className="bar-w">—</div>
          </div>
        )

        const pct = Math.round(p! * 100)
        const col = p! < 0.33 ? 'var(--green2)' : p! < 0.66 ? 'var(--warn)' : 'var(--danger)'

        return (
          <div key={k} className="bar-row">
            <div className="bar-name">{VAR_ICONS[k]} {VAR_LABELS[k]}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%`, background: col }} />
            </div>
            <div className="bar-val" style={{ color: col }}>{pct}%</div>
            <div className="bar-w">×{(ew * 100).toFixed(0)}%</div>
          </div>
        )
      })}
    </div>
  )
}

// ── AlertBox ──────────────────────────────────────────────────────
export function AlertBox({ type, children }: {
  type: 'g' | 'w' | 'r' | 'b'
  children: React.ReactNode
}) {
  return (
    <div className={`alert alert-${type}`}>
      <div className={`adot ad-${type}`} />
      <div>{children}</div>
    </div>
  )
}

// ── Loading ───────────────────────────────────────────────────────
export function Loading({ text = 'A carregar...' }: { text?: string }) {
  return (
    <div className="loading">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────
export function Sparkline({ data, color, width = 80, height = 24 }: {
  data: (number | null)[]
  color: string
  width?: number
  height?: number
}) {
  const vals = data.filter(v => v !== null) as number[]
  if (vals.length < 2) return null

  const min = 0, max = 100
  const pts = data
    .map((v, i) => ({ x: (i / (data.length - 1)) * width, y: v == null ? null : height - ((v - min) / (max - min)) * (height - 4) - 2, v }))
    .filter(p => p.y !== null) as { x: number; y: number; v: number }[]

  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      <circle cx={last.x} cy={last.y} r={3} fill={color} />
    </svg>
  )
}
