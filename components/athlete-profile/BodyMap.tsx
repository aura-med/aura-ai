'use client'

import { useState } from 'react'
import type { BodyZoneInfo, BodyRegion } from '@/types/athlete-profile'

// ─────────────────────────────────────────────────────────────────────────────
// Premium body map — zero geometric primitives.
// Every zone is a pure <path> with cubic Bézier curves for organic silhouette.
//
// viewBox per figure: "0 0 100 316"   centre-x = 50
//
// Y landmarks                  X landmarks
//  Head:      4 – 37            Neck:       43 – 57
//  Neck:     36 – 47            Chest:      28 – 72
//  Chest:    47 – 100           Waist:      30 – 70
//  Abdomen: 100 – 132           Hip:        22 – 78
//  Hip:     132 – 171           L thigh:    16 – 44   R thigh: 56 – 84
//  Thigh:   157 – 218           L calf:     14 – 44   R calf:  56 – 86
//  Knee:    218 – 234           L ankle:    20 – 44   R ankle: 56 – 80
//  Calf:    234 – 280           L arm:       6 – 28   R arm:   72 – 94
//  Ankle:   280 – 294           Forearm:     6 – 28 / 72 – 94
//  Foot:    294 – 314
//  Arm:      88 – 144  (deltoid bottom → elbow)
//  Forearm: 160 – 228
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  fillIdle:  'rgba(248,250,252,0.13)',  // near-invisible wireframe
  fillHover: 'rgba(148,163,184,0.28)',  // slate-400 @ 28 %
  stroke:    'var(--aura-text2)',
  sw:        1.0,
  swSel:     1.8,
  active: { fill: 'rgba(239,68,68,0.18)',   stroke: 'rgba(239,68,68,0.82)'   },
  recent: { fill: 'rgba(245,158,11,0.18)',  stroke: 'rgba(245,158,11,0.82)'  },
} as const

const LABELS: Record<BodyRegion, string> = {
  head:       'Cabeça',
  neck:       'Pescoço',
  chest:      'Tórax',
  abdomen:    'Abdómen',
  shoulder:   'Ombro',
  arm:        'Braço',
  elbow:      'Cotovelo',
  forearm:    'Antebraço',
  wrist:      'Pulso',
  hand:       'Mão',
  hip:        'Anca / Pélvis',
  thigh:      'Coxa',
  knee:       'Joelho',
  calf:       'Gémeo',
  ankle:      'Tornozelo',
  foot:       'Pé',
  upper_back: 'Costas sup.',
  lower_back: 'Costas inf.',
  glute:      'Glúteo',
  hamstring:  'Isquiotibiais',
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone — the single interactive wrapper used by every path
// ─────────────────────────────────────────────────────────────────────────────

interface ZoneCtx {
  zoneMap:  Map<BodyRegion, BodyZoneInfo>
  selected: BodyRegion | null
  hovered:  BodyRegion | null
  onSelect: (r: BodyRegion) => void
  onHover:  (r: BodyRegion | null) => void
}

function Zone({
  region, zoneMap, selected, hovered, onSelect, onHover, children,
}: ZoneCtx & { region: BodyRegion; children: React.ReactNode }) {
  const info   = zoneMap.get(region)
  const hasInj = (info?.injuries.length ?? 0) > 0
  const status = info?.status ?? 'clear'
  const isSel  = selected === region
  const isHov  = hovered  === region

  let fill: string, stroke: string
  if (hasInj) {
    fill   = status === 'active' ? T.active.fill   : T.recent.fill
    stroke = status === 'active' ? T.active.stroke : T.recent.stroke
  } else {
    fill   = isSel || isHov ? T.fillHover : T.fillIdle
    stroke = T.stroke
  }

  return (
    <g
      role="button"
      aria-label={LABELS[region]}
      onClick={(e) => { e.stopPropagation(); onSelect(region) }}
      onMouseEnter={() => onHover(region)}
      onMouseLeave={() => onHover(null)}
      style={{
        fill,
        stroke,
        strokeWidth:    isSel ? T.swSel : T.sw,
        strokeLinejoin: 'round' as const,
        strokeLinecap:  'round' as const,
        cursor:         'pointer',
        transition:     'fill 0.2s ease, stroke-width 0.14s ease',
      }}
    >
      {children}
    </g>
  )
}

type SvgProps = ZoneCtx

// ─────────────────────────────────────────────────────────────────────────────
// Frontal (anterior) view
// ─────────────────────────────────────────────────────────────────────────────

function FrontalSvg({ zoneMap, selected, hovered, onSelect, onHover }: SvgProps) {
  const z: ZoneCtx = { zoneMap, selected, hovered, onSelect, onHover }

  return (
    <svg viewBox="0 0 100 316" className="w-20" style={{ overflow: 'visible' }}>

      {/* ── HEAD — organic cranial oval, not a <circle> ─────────── */}
      <Zone region="head" {...z}>
        <path d="
          M 50,4
          C 60,4 72,9 72,19
          C 72,28 67,34 59,36
          C 55,37 50,38 50,38
          C 50,38 45,37 41,36
          C 33,34 28,28 28,19
          C 28,9 40,4 50,4 Z
        " />
      </Zone>

      {/* ── NECK — slight trapezoid with organic curves ──────────── */}
      <Zone region="neck" {...z}>
        <path d="
          M 43,36
          C 43,39 42,43 42,47
          L 58,47
          C 58,43 57,39 57,36 Z
        " />
      </Zone>

      {/* ── SHOULDERS — bilateral deltoid caps ──────────────────── */}
      <Zone region="shoulder" {...z}>
        {/* Left deltoid */}
        <path d="
          M 28,56
          C 22,57 14,62 10,70
          C 8,78 10,87 14,91
          C 18,87 23,85 28,86
          L 28,56 Z
        " />
        {/* Right deltoid (mirror) */}
        <path d="
          M 72,56
          L 72,86
          C 77,85 82,87 86,91
          C 90,87 92,78 90,70
          C 86,62 78,57 72,56 Z
        " />
      </Zone>

      {/* ── CHEST — V-taper upper torso ─────────────────────────── */}
      <Zone region="chest" {...z}>
        <path d="
          M 42,47 L 58,47
          C 62,49 68,53 72,57
          L 72,100
          L 28,100
          L 28,57
          C 32,53 38,49 42,47 Z
        " />
      </Zone>

      {/* ── ABDOMEN ─────────────────────────────────────────────── */}
      <Zone region="abdomen" {...z}>
        <path d="
          M 28,100 L 72,100
          C 71,112 70,122 70,132
          L 30,132
          C 30,122 29,112 28,100 Z
        " />
      </Zone>

      {/* ── HIP / PELVIS — widens then curves to crotch ─────────── */}
      <Zone region="hip" {...z}>
        <path d="
          M 30,132 L 70,132
          C 74,138 78,148 78,157
          C 74,163 66,167 60,169
          L 50,171 L 40,169
          C 34,167 26,163 22,157
          C 22,148 26,138 30,132 Z
        " />
      </Zone>

      {/* ── THIGHS (bilateral) ───────────────────────────────────── */}
      <Zone region="thigh" {...z}>
        {/* Left quad */}
        <path d="
          M 22,157
          C 18,164 16,178 16,198
          L 16,218 L 44,218
          L 44,196
          C 43,178 43,167 44,168
          C 40,169 34,167 30,164
          C 26,162 22,160 22,157 Z
        " />
        {/* Right quad */}
        <path d="
          M 78,157
          C 78,160 74,162 70,164
          C 66,167 60,169 56,168
          C 57,167 57,178 56,196
          L 56,218 L 84,218
          L 84,198
          C 84,178 82,164 78,157 Z
        " />
      </Zone>

      {/* ── KNEES (bilateral) ───────────────────────────────────── */}
      <Zone region="knee" {...z}>
        {/* Left */}
        <path d="
          M 16,218
          C 14,222 14,230 16,234
          L 44,234
          C 44,230 44,226 44,222
          L 44,218 Z
        " />
        {/* Right */}
        <path d="
          M 56,218 L 56,222
          C 56,226 56,230 56,234
          L 84,234
          C 86,230 86,222 84,218 Z
        " />
      </Zone>

      {/* ── CALVES — natural gastrocnemius belly ─────────────────── */}
      <Zone region="calf" {...z}>
        {/* Left */}
        <path d="
          M 14,234 L 44,234
          C 46,244 47,258 44,270
          C 42,276 38,280 32,280
          C 26,280 22,276 20,270
          C 17,258 16,244 14,234 Z
        " />
        {/* Right */}
        <path d="
          M 56,234 L 86,234
          C 84,244 83,258 80,270
          C 78,276 74,280 68,280
          C 62,280 58,276 56,270
          C 53,258 54,244 56,234 Z
        " />
      </Zone>

      {/* ── ANKLES (bilateral) ───────────────────────────────────── */}
      <Zone region="ankle" {...z}>
        {/* Left */}
        <path d="
          M 20,280
          C 19,284 19,290 20,294
          L 44,294
          C 44,290 44,284 44,280 Z
        " />
        {/* Right */}
        <path d="
          M 56,280 L 80,280
          C 81,284 81,290 80,294
          L 56,294
          C 56,290 56,284 56,280 Z
        " />
      </Zone>

      {/* ── FEET (bilateral) ────────────────────────────────────── */}
      <Zone region="foot" {...z}>
        {/* Left */}
        <path d="
          M 14,294 L 45,294
          C 47,298 48,306 44,310
          L 14,310
          C 10,310 10,302 14,294 Z
        " />
        {/* Right */}
        <path d="
          M 55,294 L 86,294
          C 90,302 90,310 86,310
          L 56,310
          C 52,306 53,298 55,294 Z
        " />
      </Zone>

      {/* ── UPPER ARMS (bilateral) ───────────────────────────────── */}
      <Zone region="arm" {...z}>
        {/* Left — tapers from deltoid base toward elbow */}
        <path d="
          M 10,88
          C 6,100 4,118 5,134
          L 6,144
          C 6,150 10,154 15,154
          L 19,154
          C 24,154 28,150 28,144
          L 28,88
          C 22,86 16,86 10,88 Z
        " />
        {/* Right */}
        <path d="
          M 90,88
          C 94,100 96,118 95,134
          L 94,144
          C 94,150 90,154 85,154
          L 81,154
          C 76,154 72,150 72,144
          L 72,88
          C 78,86 84,86 90,88 Z
        " />
      </Zone>

      {/* ── ELBOWS (bilateral) ───────────────────────────────────── */}
      <Zone region="elbow" {...z}>
        {/* Left */}
        <path d="
          M 6,144
          C 4,150 4,158 6,162
          L 28,162
          C 28,158 28,150 28,146 Z
        " />
        {/* Right */}
        <path d="
          M 94,144 L 94,146
          C 94,150 94,158 94,162
          L 72,162
          C 72,158 72,150 72,144 Z
        " />
      </Zone>

      {/* ── FOREARMS (bilateral) — taper toward wrist ───────────── */}
      <Zone region="forearm" {...z}>
        {/* Left */}
        <path d="
          M 6,162
          C 4,174 4,192 6,208
          L 8,228
          C 9,232 13,234 17,234
          L 21,234
          C 25,234 26,230 26,226
          L 28,204
          C 28,188 28,172 28,164
          C 22,163 14,163 6,162 Z
        " />
        {/* Right */}
        <path d="
          M 94,162
          C 86,163 78,163 72,164
          L 72,204
          L 74,226
          C 74,230 75,234 79,234
          L 83,234
          C 87,234 91,232 92,228
          L 94,208
          C 96,192 96,174 94,162 Z
        " />
      </Zone>

      {/* ── Anatomy reference lines (non-interactive, subtle) ────── */}
      <g
        className="pointer-events-none"
        stroke="var(--aura-text2)"
        strokeWidth="0.5"
        fill="none"
        opacity={0.2}
      >
        {/* Clavicles */}
        <path d="M 50,47 C 44,49 36,52 28,57" />
        <path d="M 50,47 C 56,49 64,52 72,57" />
        {/* Sternal midline */}
        <line x1="50" y1="47" x2="50" y2="100" />
        {/* Linea alba */}
        <line x1="50" y1="100" x2="50" y2="132" strokeDasharray="2 3" />
        {/* Inguinal ligaments */}
        <path d="M 50,160 C 44,157 36,153 28,149" strokeDasharray="2 3" />
        <path d="M 50,160 C 56,157 64,153 72,149" strokeDasharray="2 3" />
      </g>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Dorsal (posterior) view
// Same bezier coordinate system — only zone labels differ:
//   chest → upper_back  |  abdomen → lower_back  |  hip → glute
//   thigh → hamstring   |  all others identical
// ─────────────────────────────────────────────────────────────────────────────

function DorsalSvg({ zoneMap, selected, hovered, onSelect, onHover }: SvgProps) {
  const z: ZoneCtx = { zoneMap, selected, hovered, onSelect, onHover }

  return (
    <svg viewBox="0 0 100 316" className="w-20" style={{ overflow: 'visible' }}>

      <Zone region="head" {...z}>
        <path d="M 50,4 C 60,4 72,9 72,19 C 72,28 67,34 59,36 C 55,37 50,38 50,38 C 50,38 45,37 41,36 C 33,34 28,28 28,19 C 28,9 40,4 50,4 Z" />
      </Zone>

      <Zone region="neck" {...z}>
        <path d="M 43,36 C 43,39 42,43 42,47 L 58,47 C 58,43 57,39 57,36 Z" />
      </Zone>

      <Zone region="shoulder" {...z}>
        <path d="M 28,56 C 22,57 14,62 10,70 C 8,78 10,87 14,91 C 18,87 23,85 28,86 L 28,56 Z" />
        <path d="M 72,56 L 72,86 C 77,85 82,87 86,91 C 90,87 92,78 90,70 C 86,62 78,57 72,56 Z" />
      </Zone>

      {/* ── UPPER BACK (same coords as chest front) ─────────────── */}
      <Zone region="upper_back" {...z}>
        <path d="M 42,47 L 58,47 C 62,49 68,53 72,57 L 72,100 L 28,100 L 28,57 C 32,53 38,49 42,47 Z" />
      </Zone>

      {/* ── LOWER BACK ───────────────────────────────────────────── */}
      <Zone region="lower_back" {...z}>
        <path d="M 28,100 L 72,100 C 71,112 70,122 70,132 L 30,132 C 30,122 29,112 28,100 Z" />
      </Zone>

      {/* ── GLUTES ───────────────────────────────────────────────── */}
      <Zone region="glute" {...z}>
        <path d="M 30,132 L 70,132 C 74,138 78,148 78,157 C 74,163 66,167 60,169 L 50,171 L 40,169 C 34,167 26,163 22,157 C 22,148 26,138 30,132 Z" />
      </Zone>

      <Zone region="arm" {...z}>
        <path d="M 10,88 C 6,100 4,118 5,134 L 6,144 C 6,150 10,154 15,154 L 19,154 C 24,154 28,150 28,144 L 28,88 C 22,86 16,86 10,88 Z" />
        <path d="M 90,88 C 94,100 96,118 95,134 L 94,144 C 94,150 90,154 85,154 L 81,154 C 76,154 72,150 72,144 L 72,88 C 78,86 84,86 90,88 Z" />
      </Zone>

      <Zone region="elbow" {...z}>
        <path d="M 6,144 C 4,150 4,158 6,162 L 28,162 C 28,158 28,150 28,146 Z" />
        <path d="M 94,144 L 94,146 C 94,150 94,158 94,162 L 72,162 C 72,158 72,150 72,144 Z" />
      </Zone>

      <Zone region="forearm" {...z}>
        <path d="M 6,162 C 4,174 4,192 6,208 L 8,228 C 9,232 13,234 17,234 L 21,234 C 25,234 26,230 26,226 L 28,204 C 28,188 28,172 28,164 C 22,163 14,163 6,162 Z" />
        <path d="M 94,162 C 86,163 78,163 72,164 L 72,204 L 74,226 C 74,230 75,234 79,234 L 83,234 C 87,234 91,232 92,228 L 94,208 C 96,192 96,174 94,162 Z" />
      </Zone>

      {/* ── HAMSTRINGS ───────────────────────────────────────────── */}
      <Zone region="hamstring" {...z}>
        <path d="M 22,157 C 18,164 16,178 16,198 L 16,218 L 44,218 L 44,196 C 43,178 43,167 44,168 C 40,169 34,167 30,164 C 26,162 22,160 22,157 Z" />
        <path d="M 78,157 C 78,160 74,162 70,164 C 66,167 60,169 56,168 C 57,167 57,178 56,196 L 56,218 L 84,218 L 84,198 C 84,178 82,164 78,157 Z" />
      </Zone>

      <Zone region="knee" {...z}>
        <path d="M 16,218 C 14,222 14,230 16,234 L 44,234 C 44,230 44,226 44,222 L 44,218 Z" />
        <path d="M 56,218 L 56,222 C 56,226 56,230 56,234 L 84,234 C 86,230 86,222 84,218 Z" />
      </Zone>

      <Zone region="calf" {...z}>
        <path d="M 14,234 L 44,234 C 46,244 47,258 44,270 C 42,276 38,280 32,280 C 26,280 22,276 20,270 C 17,258 16,244 14,234 Z" />
        <path d="M 56,234 L 86,234 C 84,244 83,258 80,270 C 78,276 74,280 68,280 C 62,280 58,276 56,270 C 53,258 54,244 56,234 Z" />
      </Zone>

      <Zone region="ankle" {...z}>
        <path d="M 20,280 C 19,284 19,290 20,294 L 44,294 C 44,290 44,284 44,280 Z" />
        <path d="M 56,280 L 80,280 C 81,284 81,290 80,294 L 56,294 C 56,290 56,284 56,280 Z" />
      </Zone>

      {/* ── Anatomy reference lines — posterior ─────────────────── */}
      <g
        className="pointer-events-none"
        stroke="var(--aura-text2)"
        strokeWidth="0.5"
        fill="none"
        opacity={0.2}
      >
        {/* Vertebral column */}
        <line x1="50" y1="47" x2="50" y2="157" />
        {/* Left scapula outline */}
        <path d="M 50,52 C 46,54 36,58 32,68 C 28,78 32,90 36,98" />
        {/* Right scapula outline */}
        <path d="M 50,52 C 54,54 64,58 68,68 C 72,78 68,90 64,98" />
        {/* Sacro-iliac hint */}
        <path d="M 44,150 C 46,152 50,153 50,153 C 50,153 54,152 56,150" strokeDasharray="2 2.5" />
      </g>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone detail panel
// ─────────────────────────────────────────────────────────────────────────────

function ZoneDetail({ info }: { info: BodyZoneInfo }) {
  const cfg = {
    active: { label: 'Lesão ativa',          color: 'var(--aura-danger)' },
    recent: { label: 'Lesão recente (<6m)',  color: 'var(--aura-warn)'   },
    clear:  { label: 'Sem lesões ativas',    color: 'var(--aura-green)'  },
  }[info.status]

  return (
    <div
      className="mt-3 rounded-xl border p-3 space-y-2 text-xs"
      style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border)' }}
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold" style={{ color: 'var(--aura-text)' }}>
          {LABELS[info.region]}
        </p>
        <span className="text-[10px] font-bold" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
      </div>
      {info.injuries.map((inj) => (
        <div
          key={inj.id}
          className="pt-1.5 border-t space-y-0.5"
          style={{ borderColor: 'var(--aura-border)' }}
        >
          <p style={{ color: 'var(--aura-text)' }}>{inj.diagnosis}</p>
          <p style={{ color: 'var(--aura-text3)' }}>
            {new Date(inj.injury_date).toLocaleDateString('pt-PT', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
            {inj.severity ? ` · ${inj.severity}` : ''}
            {inj.is_active && (
              <span className="ml-1.5 font-bold" style={{ color: 'var(--aura-danger)' }}>
                ATIVA
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BodyMap — public export
// ─────────────────────────────────────────────────────────────────────────────

interface BodyMapProps {
  zoneMap:    Map<BodyRegion, BodyZoneInfo>
  className?: string
}

export function BodyMap({ zoneMap, className }: BodyMapProps) {
  const [selected, setSelected] = useState<BodyRegion | null>(null)
  const [hovered,  setHovered]  = useState<BodyRegion | null>(null)

  const svgProps: SvgProps = {
    zoneMap,
    selected,
    hovered,
    onSelect: (r) => setSelected((p) => (p === r ? null : r)),
    onHover:  setHovered,
  }

  const selectedInfo = selected ? (zoneMap.get(selected) ?? null) : null

  return (
    <div className={className} onClick={() => setSelected(null)}>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        {[
          { label: 'Lesão ativa',   color: 'rgba(239,68,68,0.85)'   },
          { label: 'Lesão recente', color: 'rgba(245,158,11,0.85)'  },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[10px]" style={{ color: 'var(--aura-text2)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* SVG pair */}
      <div className="flex gap-8 justify-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-2">
          <p
            className="text-[9px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--aura-text2)' }}
          >
            Anterior
          </p>
          <FrontalSvg {...svgProps} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <p
            className="text-[9px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--aura-text2)' }}
          >
            Posterior
          </p>
          <DorsalSvg {...svgProps} />
        </div>
      </div>

      {/* Selection detail */}
      {selected && selectedInfo && <ZoneDetail info={selectedInfo} />}
      {selected && !selectedInfo && (
        <div
          className="mt-3 rounded-xl border p-3 text-xs text-center"
          style={{
            background:  'var(--aura-bg3)',
            borderColor: 'var(--aura-border)',
            color:       'var(--aura-text3)',
          }}
        >
          {LABELS[selected]} — sem lesões registadas
        </div>
      )}
    </div>
  )
}
