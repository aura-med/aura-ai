'use client'

import { useState } from 'react'
import type { BodyZoneInfo, BodyRegion } from '@/types/athlete-profile'

// ── Colours ───────────────────────────────────────────────────────────────────

const INJURY: Record<'clear' | 'recent' | 'active', { fill: string; stroke: string }> = {
  clear:  { fill: 'rgba(0,229,160,0.20)',  stroke: '#00e5a0' },
  recent: { fill: 'rgba(246,173,85,0.28)', stroke: '#f6ad55' },
  active: { fill: 'rgba(255,77,109,0.32)', stroke: '#ff4d6d' },
}

// Adapts to light (#e8edf5) and dark (#181e2e) themes automatically
const DEFAULT_FILL   = 'var(--aura-bg3)'
const DEFAULT_STROKE = 'var(--aura-text2)'   // #5a6478 light / #8892a4 dark

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

  const fill   = hasInjury ? INJURY[status].fill   : DEFAULT_FILL
  const stroke = hasInjury ? INJURY[status].stroke : DEFAULT_STROKE

  return (
    <g
      onClick={(e) => { e.stopPropagation(); onSelect(region) }}
      style={{
        fill,
        stroke,
        strokeWidth:  isSel ? 2 : 1,
        cursor: 'pointer',
        filter: isSel ? 'brightness(0.88)' : undefined,
        transition: 'filter 0.12s',
      }}
    >
      {children}
    </g>
  )
}

// ── Frontal SVG ───────────────────────────────────────────────────────────────
//
//  viewBox "0 0 160 395"  —  centre x = 80
//  All zones tile together to form the complete body silhouette.
//  There is NO separate base layer; the zones ARE the figure.

interface SvgProps {
  zoneMap: Map<BodyRegion, BodyZoneInfo>
  selected: BodyRegion | null
  onSelect: (r: BodyRegion) => void
}

function FrontalSvg({ zoneMap, selected, onSelect }: SvgProps) {
  const z = { zoneMap, selected, onSelect }

  return (
    <svg viewBox="0 0 160 395" className="w-20" style={{ overflow: 'visible' }}>

      {/* ── Head ── */}
      <Zone region="head" {...z}>
        <ellipse cx="80" cy="24" rx="24" ry="23" />
      </Zone>

      {/* ── Neck ── */}
      <Zone region="neck" {...z}>
        <path d="M 70,46 L 90,46 L 90,66 L 70,66 Z" />
      </Zone>

      {/* ── Shoulders (deltoid blobs) ── */}
      <Zone region="shoulder" {...z}>
        <ellipse cx="30" cy="84" rx="20" ry="15" />
        <ellipse cx="130" cy="84" rx="20" ry="15" />
      </Zone>

      {/* ── Chest — central trapezoid, connects neck base to waist ── */}
      <Zone region="chest" {...z}>
        <path d="M 50,66 L 110,66 L 106,130 L 54,130 Z" />
      </Zone>

      {/* ── Abdomen ── */}
      <Zone region="abdomen" {...z}>
        <path d="M 54,130 L 106,130 L 108,168 L 52,168 Z" />
      </Zone>

      {/* ── Hip / Pelvis — flares out toward legs ── */}
      <Zone region="hip" {...z}>
        <path d="M 52,168 L 108,168 C 118,172 128,182 130,196
                 L 130,208 L 30,208 L 30,196 C 32,182 42,172 52,168 Z" />
      </Zone>

      {/* ── Upper Arms ── */}
      <Zone region="arm" {...z}>
        <path d="M 14,78 C 10,84 8,92 10,102 L 12,136 C 12,142 16,146 22,146
                 L 30,146 C 36,146 36,142 34,136 L 36,102 C 36,92 34,84 30,78 Z" />
        <path d="M 146,78 C 150,84 152,92 150,102 L 148,136 C 148,142 144,146 138,146
                 L 130,146 C 124,146 124,142 126,136 L 124,102 C 124,92 126,84 130,78 Z" />
      </Zone>

      {/* ── Elbows ── */}
      <Zone region="elbow" {...z}>
        <ellipse cx="22" cy="152" rx="12" ry="9" />
        <ellipse cx="138" cy="152" rx="12" ry="9" />
      </Zone>

      {/* ── Forearms ── */}
      <Zone region="forearm" {...z}>
        <path d="M 10,161 C 8,167 8,177 10,187 L 12,202 C 12,208 16,210 22,210
                 L 30,210 C 36,210 36,206 34,200 L 34,185 C 34,173 32,165 28,161 Z" />
        <path d="M 150,161 C 152,167 152,177 150,187 L 148,202 C 148,208 144,210 138,210
                 L 130,210 C 124,210 124,206 126,200 L 126,185 C 128,173 128,165 132,161 Z" />
      </Zone>

      {/* ── Wrists ── */}
      <Zone region="wrist" {...z}>
        <ellipse cx="22" cy="215" rx="12" ry="7" />
        <ellipse cx="138" cy="215" rx="12" ry="7" />
      </Zone>

      {/* ── Thighs (gap between them is intentional — crotch) ── */}
      <Zone region="thigh" {...z}>
        <path d="M 30,208 L 68,208 L 64,272 C 62,280 56,284 48,284
                 L 38,284 C 30,282 28,276 28,270 Z" />
        <path d="M 92,208 L 130,208 L 132,270 C 132,276 130,282 122,284
                 L 112,284 C 104,284 98,280 96,272 Z" />
      </Zone>

      {/* ── Knees ── */}
      <Zone region="knee" {...z}>
        <ellipse cx="48" cy="291" rx="18" ry="11" />
        <ellipse cx="112" cy="291" rx="18" ry="11" />
      </Zone>

      {/* ── Calves — gastrocnemius: wider belly, tapers to ankle ── */}
      <Zone region="calf" {...z}>
        <path d="M 30,302 C 24,310 22,326 25,340 C 28,352 38,360 48,360
                 C 58,360 68,352 71,340 C 73,326 70,310 64,302 Z" />
        <path d="M 96,302 C 90,310 87,326 90,340 C 93,352 102,360 112,360
                 C 122,360 132,352 135,340 C 137,326 134,310 128,302 Z" />
      </Zone>

      {/* ── Ankles ── */}
      <Zone region="ankle" {...z}>
        <ellipse cx="48" cy="366" rx="16" ry="8" />
        <ellipse cx="112" cy="366" rx="16" ry="8" />
      </Zone>

      {/* ── Feet ── */}
      <Zone region="foot" {...z}>
        <path d="M 32,374 C 30,378 32,384 40,386 L 60,386 C 68,386 70,382 68,376
                 L 65,374 Z" />
        <path d="M 96,374 L 95,376 C 93,382 95,386 103,386 L 122,386 C 130,384 132,378 130,374 Z" />
      </Zone>

      {/* ── Subtle anatomy guide lines (non-clickable) ── */}
      <g
        className="pointer-events-none"
        stroke={DEFAULT_STROKE}
        strokeWidth="0.6"
        strokeDasharray="3 3"
        opacity={0.3}
        fill="none"
      >
        {/* Clavicles */}
        <line x1="80" y1="68" x2="42" y2="82" />
        <line x1="80" y1="68" x2="118" y2="82" />
        {/* Sternum */}
        <line x1="80" y1="68" x2="80" y2="130" />
        {/* Linea alba */}
        <line x1="80" y1="130" x2="80" y2="168" strokeDasharray="2 3" />
      </g>
    </svg>
  )
}

// ── Dorsal SVG ────────────────────────────────────────────────────────────────

function DorsalSvg({ zoneMap, selected, onSelect }: SvgProps) {
  const z = { zoneMap, selected, onSelect }

  return (
    <svg viewBox="0 0 160 395" className="w-20" style={{ overflow: 'visible' }}>

      <Zone region="head" {...z}>
        <ellipse cx="80" cy="24" rx="24" ry="23" />
      </Zone>

      <Zone region="neck" {...z}>
        <path d="M 70,46 L 90,46 L 90,66 L 70,66 Z" />
      </Zone>

      <Zone region="shoulder" {...z}>
        <ellipse cx="30" cy="84" rx="20" ry="15" />
        <ellipse cx="130" cy="84" rx="20" ry="15" />
      </Zone>

      {/* Upper back */}
      <Zone region="upper_back" {...z}>
        <path d="M 50,66 L 110,66 L 106,130 L 54,130 Z" />
      </Zone>

      {/* Lower back */}
      <Zone region="lower_back" {...z}>
        <path d="M 54,130 L 106,130 L 108,168 L 52,168 Z" />
      </Zone>

      {/* Glutes */}
      <Zone region="glute" {...z}>
        <path d="M 52,168 L 108,168 C 118,172 128,182 130,196
                 L 130,208 L 30,208 L 30,196 C 32,182 42,172 52,168 Z" />
      </Zone>

      <Zone region="arm" {...z}>
        <path d="M 14,78 C 10,84 8,92 10,102 L 12,136 C 12,142 16,146 22,146
                 L 30,146 C 36,146 36,142 34,136 L 36,102 C 36,92 34,84 30,78 Z" />
        <path d="M 146,78 C 150,84 152,92 150,102 L 148,136 C 148,142 144,146 138,146
                 L 130,146 C 124,146 124,142 126,136 L 124,102 C 124,92 126,84 130,78 Z" />
      </Zone>

      <Zone region="elbow" {...z}>
        <ellipse cx="22" cy="152" rx="12" ry="9" />
        <ellipse cx="138" cy="152" rx="12" ry="9" />
      </Zone>

      <Zone region="forearm" {...z}>
        <path d="M 10,161 C 8,167 8,177 10,187 L 12,202 C 12,208 16,210 22,210
                 L 30,210 C 36,210 36,206 34,200 L 34,185 C 34,173 32,165 28,161 Z" />
        <path d="M 150,161 C 152,167 152,177 150,187 L 148,202 C 148,208 144,210 138,210
                 L 130,210 C 124,210 124,206 126,200 L 126,185 C 128,173 128,165 132,161 Z" />
      </Zone>

      <Zone region="wrist" {...z}>
        <ellipse cx="22" cy="215" rx="12" ry="7" />
        <ellipse cx="138" cy="215" rx="12" ry="7" />
      </Zone>

      {/* Hamstrings */}
      <Zone region="hamstring" {...z}>
        <path d="M 30,208 L 68,208 L 64,272 C 62,280 56,284 48,284
                 L 38,284 C 30,282 28,276 28,270 Z" />
        <path d="M 92,208 L 130,208 L 132,270 C 132,276 130,282 122,284
                 L 112,284 C 104,284 98,280 96,272 Z" />
      </Zone>

      <Zone region="knee" {...z}>
        <ellipse cx="48" cy="291" rx="18" ry="11" />
        <ellipse cx="112" cy="291" rx="18" ry="11" />
      </Zone>

      <Zone region="calf" {...z}>
        <path d="M 30,302 C 24,310 22,326 25,340 C 28,352 38,360 48,360
                 C 58,360 68,352 71,340 C 73,326 70,310 64,302 Z" />
        <path d="M 96,302 C 90,310 87,326 90,340 C 93,352 102,360 112,360
                 C 122,360 132,352 135,340 C 137,326 134,310 128,302 Z" />
      </Zone>

      <Zone region="ankle" {...z}>
        <ellipse cx="48" cy="366" rx="16" ry="8" />
        <ellipse cx="112" cy="366" rx="16" ry="8" />
      </Zone>

      {/* ── Spine line ── */}
      <g
        className="pointer-events-none"
        stroke={DEFAULT_STROKE}
        strokeWidth="0.6"
        strokeDasharray="3 3"
        opacity={0.3}
        fill="none"
      >
        <line x1="80" y1="66" x2="80" y2="168" />
        {/* Scapula hints */}
        <ellipse cx="62" cy="96" rx="12" ry="16" />
        <ellipse cx="98" cy="96" rx="12" ry="16" />
      </g>
    </svg>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function ZoneDetail({ info }: { info: BodyZoneInfo }) {
  const cfg = {
    active: { label: 'Lesão ativa',         color: 'var(--aura-danger)' },
    recent: { label: 'Lesão recente (<6m)', color: 'var(--aura-warn)'   },
    clear:  { label: 'Sem lesões ativas',   color: 'var(--aura-green)'  },
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
        <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
      </div>
      {info.injuries.map((inj) => (
        <div key={inj.id} className="pt-1.5 border-t space-y-0.5" style={{ borderColor: 'var(--aura-border)' }}>
          <p style={{ color: 'var(--aura-text)' }}>{inj.diagnosis}</p>
          <p style={{ color: 'var(--aura-text3)' }}>
            {new Date(inj.injury_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
            {inj.severity ? ` · ${inj.severity}` : ''}
            {inj.is_active && <span className="ml-1.5 font-bold" style={{ color: 'var(--aura-danger)' }}>ATIVA</span>}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface BodyMapProps {
  zoneMap: Map<BodyRegion, BodyZoneInfo>
  className?: string
}

export function BodyMap({ zoneMap, className }: BodyMapProps) {
  const [selected, setSelected] = useState<BodyRegion | null>(null)

  function handleSelect(region: BodyRegion) {
    setSelected((prev) => (prev === region ? null : region))
  }

  const selectedInfo = selected ? (zoneMap.get(selected) ?? null) : null

  return (
    <div className={className} onClick={() => setSelected(null)}>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        {[
          { label: 'Lesão ativa',   color: 'var(--aura-danger)' },
          { label: 'Lesão recente', color: 'var(--aura-warn)'   },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
            <span className="text-[10px]" style={{ color: 'var(--aura-text2)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* SVG views */}
      <div
        className="flex gap-6 justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-1">
          <p className="text-[9px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: 'var(--aura-text2)' }}>Frontal</p>
          <FrontalSvg zoneMap={zoneMap} selected={selected} onSelect={handleSelect} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-[9px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: 'var(--aura-text2)' }}>Dorsal</p>
          <DorsalSvg zoneMap={zoneMap} selected={selected} onSelect={handleSelect} />
        </div>
      </div>

      {/* Selected zone detail */}
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
