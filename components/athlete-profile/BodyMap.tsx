'use client'

import { useState } from 'react'
import type { BodyZoneInfo, BodyRegion } from '@/types/athlete-profile'

// ── Colours ───────────────────────────────────────────────────────────────────

const INJURY_COLORS: Record<'clear' | 'recent' | 'active', { fill: string; stroke: string }> = {
  clear:  { fill: 'rgba(0,229,160,0.18)',  stroke: '#00e5a0' },
  recent: { fill: 'rgba(246,173,85,0.26)', stroke: '#f6ad55' },
  active: { fill: 'rgba(255,77,109,0.30)', stroke: '#ff4d6d' },
}

// CSS variables → adapts to light AND dark mode
// --aura-text2 is #5a6478 in light mode (dark enough to see on white)
// --aura-text3 is #9aa3b2 in light mode (too light — don't use for strokes)
const D_FILL   = 'transparent'
const D_STROKE = 'var(--aura-text2)'

// ── Region labels ─────────────────────────────────────────────────────────────

const REGION_LABELS: Record<BodyRegion, string> = {
  head: 'Cabeça', neck: 'Pescoço', chest: 'Tórax', abdomen: 'Abdómen',
  shoulder: 'Ombro', arm: 'Braço', elbow: 'Cotovelo', forearm: 'Antebraço',
  wrist: 'Pulso', hand: 'Mão', hip: 'Anca / Pélvis', thigh: 'Coxa',
  knee: 'Joelho', calf: 'Gémeo', ankle: 'Tornozelo', foot: 'Pé',
  upper_back: 'Costas sup.', lower_back: 'Costas inf.',
  glute: 'Glúteo', hamstring: 'Isquiotibiais',
}

// ── Zone wrapper ──────────────────────────────────────────────────────────────

interface ZoneProps {
  region: BodyRegion
  zoneMap: Map<BodyRegion, BodyZoneInfo>
  selected: BodyRegion | null
  onSelect: (r: BodyRegion) => void
  children: React.ReactNode
}

function Zone({ region, zoneMap, selected, onSelect, children }: ZoneProps) {
  const info      = zoneMap.get(region)
  const hasInjury = (info?.injuries.length ?? 0) > 0
  const status    = info?.status ?? 'clear'
  const isSel     = selected === region

  const fill   = hasInjury ? INJURY_COLORS[status].fill   : D_FILL
  const stroke = hasInjury ? INJURY_COLORS[status].stroke : D_STROKE

  return (
    <g
      onClick={(e) => { e.stopPropagation(); onSelect(region) }}
      style={{
        fill,
        stroke,
        strokeWidth:  isSel ? 1.8 : 0.85,
        opacity:      hasInjury ? 1 : 0.55,
        cursor:       'pointer',
        transition:   'opacity 0.15s, stroke-width 0.15s',
        filter:       isSel ? 'brightness(1.25)' : undefined,
      }}
    >
      {children}
    </g>
  )
}

// ── Decorative anatomy lines (non-interactive) ────────────────────────────────

function FrontalDetails() {
  return (
    <g
      className="pointer-events-none"
      stroke="var(--aura-text2)"
      strokeWidth="0.5"
      opacity={0.35}
      fill="none"
    >
      {/* Clavicles */}
      <line x1="60" y1="58" x2="22" y2="70" />
      <line x1="60" y1="58" x2="98" y2="70" />
      {/* Sternum */}
      <line x1="60" y1="58" x2="60" y2="100" />
      {/* Linea alba (abdomen midline) */}
      <line x1="60" y1="100" x2="60" y2="132" strokeDasharray="1.5 2" />
      {/* Inguinal fold */}
      <line x1="32" y1="158" x2="60" y2="150" />
      <line x1="88" y1="158" x2="60" y2="150" />
    </g>
  )
}

function DorsalDetails() {
  return (
    <g
      className="pointer-events-none"
      stroke="var(--aura-text2)"
      strokeWidth="0.5"
      opacity={0.35}
      fill="none"
    >
      {/* Spine */}
      <line x1="60" y1="54" x2="60" y2="158" strokeDasharray="2 2" />
      {/* Scapula outlines */}
      <ellipse cx="45" cy="74" rx="10" ry="13" />
      <ellipse cx="75" cy="74" rx="10" ry="13" />
      {/* Sacrum */}
      <ellipse cx="60" cy="148" rx="8" ry="10" />
    </g>
  )
}

// ── Body silhouette base (non-interactive) ────────────────────────────────────

function BodyBase() {
  return (
    <g
      className="pointer-events-none"
      fill="var(--aura-bg3)"
      stroke="var(--aura-text2)"
      strokeWidth="0.7"
      opacity={0.75}
    >
      {/* Head */}
      <ellipse cx="60" cy="21" rx="19" ry="20" />
      {/* Neck */}
      <rect x="53" y="40" width="14" height="14" rx="2" />
      {/* Torso */}
      <path d="M28,54 C22,56 20,62 20,68 L20,158 C24,162 30,164 36,164
               L84,164 C90,164 96,162 100,158 L100,68 C100,62 98,56 92,54 Z" />
      {/* Left arm */}
      <path d="M8,72 C6,74 6,80 8,88 L10,118 C10,122 12,124 16,124
               L22,124 C26,124 26,120 24,116 L26,86 C26,80 22,74 20,72 Z" />
      {/* Right arm */}
      <path d="M112,72 C114,74 114,80 112,88 L110,118 C110,122 108,124 104,124
               L98,124 C94,124 94,120 96,116 L94,86 C94,80 98,74 100,72 Z" />
      {/* Left forearm */}
      <path d="M8,130 C6,132 6,138 8,148 L10,164 C10,168 12,170 16,170
               L22,170 C26,170 26,166 24,162 L24,146 C24,138 22,132 20,130 Z" />
      {/* Right forearm */}
      <path d="M112,130 C114,132 114,138 112,148 L110,164 C110,168 108,170 104,170
               L98,170 C94,170 94,166 96,162 L96,146 C96,138 98,132 100,130 Z" />
      {/* Left thigh */}
      <path d="M30,164 C26,166 24,172 26,180 L28,214 C28,218 32,222 38,222
               L50,222 C56,220 56,216 54,210 L56,178 C56,170 54,166 50,164 Z" />
      {/* Right thigh */}
      <path d="M90,164 C94,166 96,172 94,180 L92,214 C92,218 88,222 82,222
               L70,222 C64,220 64,216 66,210 L64,178 C64,170 66,166 70,164 Z" />
      {/* Left lower leg */}
      <path d="M28,228 C24,234 22,246 24,256 C26,264 32,270 40,270
               L48,270 C54,264 54,254 52,244 C50,236 46,230 42,228 Z" />
      {/* Right lower leg */}
      <path d="M92,228 C96,234 98,246 96,256 C94,264 88,270 80,270
               L72,270 C66,264 66,254 68,244 C70,236 74,230 78,228 Z" />
    </g>
  )
}

// ── Frontal SVG ───────────────────────────────────────────────────────────────

interface SvgProps {
  zoneMap: Map<BodyRegion, BodyZoneInfo>
  selected: BodyRegion | null
  onSelect: (r: BodyRegion) => void
}

function FrontalSvg({ zoneMap, selected, onSelect }: SvgProps) {
  const z = { zoneMap, selected, onSelect }
  return (
    <svg viewBox="0 0 120 286" className="w-[90px]" style={{ overflow: 'visible' }}>
      <BodyBase />
      <FrontalDetails />

      <Zone region="head" {...z}>
        <ellipse cx="60" cy="21" rx="18" ry="19" />
      </Zone>

      <Zone region="neck" {...z}>
        <rect x="53" y="40" width="14" height="14" rx="3" />
      </Zone>

      <Zone region="shoulder" {...z}>
        <ellipse cx="20" cy="66" rx="13" ry="11" />
        <ellipse cx="100" cy="66" rx="13" ry="11" />
      </Zone>

      <Zone region="chest" {...z}>
        {/* Trapezoid: wider at shoulder line, narrows to abdomen */}
        <path d="M34,54 L86,54 C92,56 98,62 98,68 L96,100 L24,100 C22,90 22,74 28,68 C30,62 32,54 34,54 Z" />
      </Zone>

      <Zone region="abdomen" {...z}>
        <rect x="36" y="100" width="48" height="32" rx="4" />
      </Zone>

      <Zone region="hip" {...z}>
        <path d="M28,132 C22,134 20,140 20,146 L20,158 C22,162 26,164 32,164
                 L88,164 C94,164 98,162 100,158 L100,146 C100,140 98,134 92,132 Z" />
      </Zone>

      <Zone region="arm" {...z}>
        <path d="M8,72 C6,76 6,82 8,90 L10,118 C10,122 12,124 16,124 L22,124
                 C26,124 26,120 24,116 L26,88 C26,80 22,74 20,72 Z" />
        <path d="M112,72 C114,76 114,82 112,90 L110,118 C110,122 108,124 104,124 L98,124
                 C94,124 94,120 96,116 L94,88 C94,80 98,74 100,72 Z" />
      </Zone>

      <Zone region="elbow" {...z}>
        <ellipse cx="14" cy="127" rx="8" ry="7" />
        <ellipse cx="106" cy="127" rx="8" ry="7" />
      </Zone>

      <Zone region="forearm" {...z}>
        <path d="M8,134 C6,138 6,144 8,152 L10,164 C10,168 12,170 16,170 L22,170
                 C26,170 26,166 24,162 L24,150 C24,142 22,136 20,134 Z" />
        <path d="M112,134 C114,138 114,144 112,152 L110,164 C110,168 108,170 104,170 L98,170
                 C94,170 94,166 96,162 L96,150 C96,142 98,136 100,134 Z" />
      </Zone>

      <Zone region="wrist" {...z}>
        <ellipse cx="14" cy="173" rx="8" ry="5" />
        <ellipse cx="106" cy="173" rx="8" ry="5" />
      </Zone>

      <Zone region="thigh" {...z}>
        <path d="M30,164 C26,168 24,174 26,182 L28,212 C28,218 32,222 38,222
                 L50,222 C56,218 56,214 54,208 L56,180 C56,172 54,166 50,164 Z" />
        <path d="M90,164 C94,168 96,174 94,182 L92,212 C92,218 88,222 82,222
                 L70,222 C64,218 64,214 66,208 L64,180 C64,172 66,166 70,164 Z" />
      </Zone>

      <Zone region="knee" {...z}>
        <ellipse cx="40" cy="227" rx="12" ry="8" />
        <ellipse cx="80" cy="227" rx="12" ry="8" />
      </Zone>

      <Zone region="calf" {...z}>
        {/* Gastrocnemius — wider in belly, tapers to ankle */}
        <path d="M30,235 C26,240 24,250 26,260 C28,268 34,272 40,272
                 C46,272 52,268 54,260 C56,250 54,240 50,235 Z" />
        <path d="M70,235 C66,240 64,250 66,260 C68,268 74,272 80,272
                 C86,272 92,268 94,260 C96,250 94,240 90,235 Z" />
      </Zone>

      <Zone region="ankle" {...z}>
        <ellipse cx="40" cy="275" rx="11" ry="6" />
        <ellipse cx="80" cy="275" rx="11" ry="6" />
      </Zone>

      <Zone region="foot" {...z}>
        <path d="M28,281 C28,279 31,279 40,279 C52,279 55,281 58,283 L58,286 L26,286 Z" />
        <path d="M68,281 C68,279 72,279 80,279 C92,279 95,281 94,283 L94,286 L62,286 Z" />
      </Zone>
    </svg>
  )
}

// ── Dorsal SVG ────────────────────────────────────────────────────────────────

function DorsalSvg({ zoneMap, selected, onSelect }: SvgProps) {
  const z = { zoneMap, selected, onSelect }
  return (
    <svg viewBox="0 0 120 286" className="w-[90px]" style={{ overflow: 'visible' }}>
      <BodyBase />
      <DorsalDetails />

      <Zone region="head" {...z}>
        <ellipse cx="60" cy="21" rx="18" ry="19" />
      </Zone>

      <Zone region="neck" {...z}>
        <rect x="53" y="40" width="14" height="14" rx="3" />
      </Zone>

      <Zone region="shoulder" {...z}>
        <ellipse cx="20" cy="66" rx="13" ry="11" />
        <ellipse cx="100" cy="66" rx="13" ry="11" />
      </Zone>

      <Zone region="upper_back" {...z}>
        <path d="M34,54 L86,54 C92,56 98,62 98,68 L96,100 L24,100 C22,90 22,74 28,68 C30,62 32,54 34,54 Z" />
      </Zone>

      <Zone region="lower_back" {...z}>
        <rect x="36" y="100" width="48" height="32" rx="4" />
      </Zone>

      <Zone region="glute" {...z}>
        <path d="M28,132 C22,134 20,140 20,146 L20,158 C22,162 26,164 32,164
                 L88,164 C94,164 98,162 100,158 L100,146 C100,140 98,134 92,132 Z" />
      </Zone>

      <Zone region="arm" {...z}>
        <path d="M8,72 C6,76 6,82 8,90 L10,118 C10,122 12,124 16,124 L22,124
                 C26,124 26,120 24,116 L26,88 C26,80 22,74 20,72 Z" />
        <path d="M112,72 C114,76 114,82 112,90 L110,118 C110,122 108,124 104,124 L98,124
                 C94,124 94,120 96,116 L94,88 C94,80 98,74 100,72 Z" />
      </Zone>

      <Zone region="elbow" {...z}>
        <ellipse cx="14" cy="127" rx="8" ry="7" />
        <ellipse cx="106" cy="127" rx="8" ry="7" />
      </Zone>

      <Zone region="forearm" {...z}>
        <path d="M8,134 C6,138 6,144 8,152 L10,164 C10,168 12,170 16,170 L22,170
                 C26,170 26,166 24,162 L24,150 C24,142 22,136 20,134 Z" />
        <path d="M112,134 C114,138 114,144 112,152 L110,164 C110,168 108,170 104,170 L98,170
                 C94,170 94,166 96,162 L96,150 C96,142 98,136 100,134 Z" />
      </Zone>

      <Zone region="wrist" {...z}>
        <ellipse cx="14" cy="173" rx="8" ry="5" />
        <ellipse cx="106" cy="173" rx="8" ry="5" />
      </Zone>

      <Zone region="hamstring" {...z}>
        <path d="M30,164 C26,168 24,174 26,182 L28,212 C28,218 32,222 38,222
                 L50,222 C56,218 56,214 54,208 L56,180 C56,172 54,166 50,164 Z" />
        <path d="M90,164 C94,168 96,174 94,182 L92,212 C92,218 88,222 82,222
                 L70,222 C64,218 64,214 66,208 L64,180 C64,172 66,166 70,164 Z" />
      </Zone>

      <Zone region="knee" {...z}>
        <ellipse cx="40" cy="227" rx="12" ry="8" />
        <ellipse cx="80" cy="227" rx="12" ry="8" />
      </Zone>

      <Zone region="calf" {...z}>
        <path d="M30,235 C26,240 24,250 26,260 C28,268 34,272 40,272
                 C46,272 52,268 54,260 C56,250 54,240 50,235 Z" />
        <path d="M70,235 C66,240 64,250 66,260 C68,268 74,272 80,272
                 C86,272 92,268 94,260 C96,250 94,240 90,235 Z" />
      </Zone>

      <Zone region="ankle" {...z}>
        <ellipse cx="40" cy="275" rx="11" ry="6" />
        <ellipse cx="80" cy="275" rx="11" ry="6" />
      </Zone>
    </svg>
  )
}

// ── Selected zone detail panel ────────────────────────────────────────────────

function ZoneDetail({ info }: { info: BodyZoneInfo }) {
  const statusColor = {
    active: 'var(--aura-danger)', recent: 'var(--aura-warn)', clear: 'var(--aura-green)',
  }[info.status]
  const statusLabel = {
    active: 'Lesão ativa', recent: 'Lesão recente (<6m)', clear: 'Sem lesões ativas',
  }[info.status]

  return (
    <div
      className="mt-3 rounded-xl border p-3 space-y-2 text-xs"
      style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border)' }}
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold" style={{ color: 'var(--aura-text)' }}>
          {REGION_LABELS[info.region]}
        </p>
        <span className="text-[10px] font-bold" style={{ color: statusColor }}>
          {statusLabel}
        </span>
      </div>
      {info.injuries.map((inj) => (
        <div key={inj.id} className="pt-1.5 border-t space-y-0.5" style={{ borderColor: 'var(--aura-border)' }}>
          <p style={{ color: 'var(--aura-text)' }}>{inj.diagnosis}</p>
          <p style={{ color: 'var(--aura-text3)' }}>
            {new Date(inj.injury_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
            {inj.severity ? ` · ${inj.severity}` : ''}
            {inj.is_active ? (
              <span className="ml-1.5 font-bold" style={{ color: 'var(--aura-danger)' }}>ATIVA</span>
            ) : null}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface BodyMapProps {
  zoneMap: Map<BodyRegion, BodyZoneInfo>
  className?: string
}

export function BodyMap({ zoneMap, className }: BodyMapProps) {
  const [selected, setSelected] = useState<BodyRegion | null>(null)

  function handleSelect(region: BodyRegion) {
    setSelected((prev) => (prev === region ? null : region))
  }

  const selectedInfo = selected ? zoneMap.get(selected) ?? null : null

  const legend = [
    { label: 'Lesão ativa',   color: 'var(--aura-danger)' },
    { label: 'Lesão recente', color: 'var(--aura-warn)'   },
    { label: 'Sem lesão',     color: 'var(--aura-green)'  },
  ]

  return (
    <div className={className} onClick={() => setSelected(null)}>
      {/* Legend */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {legend.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
            <span className="text-[10px]" style={{ color: 'var(--aura-text2)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Views */}
      <div className="flex gap-4 justify-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-1">
          <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--aura-text2)' }}>
            Frontal
          </p>
          <FrontalSvg zoneMap={zoneMap} selected={selected} onSelect={handleSelect} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--aura-text2)' }}>
            Dorsal
          </p>
          <DorsalSvg zoneMap={zoneMap} selected={selected} onSelect={handleSelect} />
        </div>
      </div>

      {/* Detail panel */}
      {selectedInfo && <ZoneDetail info={selectedInfo} />}
      {selected && !selectedInfo && (
        <div
          className="mt-3 rounded-xl border p-3 text-xs text-center"
          style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border)', color: 'var(--aura-text3)' }}
        >
          {REGION_LABELS[selected]} — sem lesões registadas
        </div>
      )}
    </div>
  )
}
