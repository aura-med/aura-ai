'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { BodyZoneInfo, BodyRegion, InjuryEventSummary } from '@/types/athlete-profile'

// ── Zone status colours ───────────────────────────────────────────────────────

const ZONE_COLORS: Record<'clear' | 'recent' | 'active', { fill: string; stroke: string }> = {
  clear:  { fill: 'rgba(0,229,160,0.10)',  stroke: 'rgba(0,229,160,0.30)'  },
  recent: { fill: 'rgba(246,173,85,0.25)', stroke: 'rgba(246,173,85,0.70)' },
  active: { fill: 'rgba(255,77,109,0.30)', stroke: 'rgba(255,77,109,0.80)' },
}

const DEFAULT_COLORS = { fill: 'rgba(255,255,255,0.04)', stroke: 'rgba(255,255,255,0.10)' }

// ── Tooltip ───────────────────────────────────────────────────────────────────

function ZoneTooltip({ zone }: { zone: BodyZoneInfo }) {
  const statusLabel = { clear: 'Sem lesões', recent: 'Lesão recente (<6m)', active: 'Lesão ativa' }
  const statusColor = { clear: 'var(--aura-green)', recent: 'var(--aura-warn)', active: 'var(--aura-danger)' }
  return (
    <div
      className="absolute z-20 w-64 rounded-xl border p-3 shadow-xl text-xs space-y-2 pointer-events-none"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold" style={{ color: 'var(--aura-text)' }}>
          {REGION_LABELS[zone.region]}
        </span>
        <span className="font-semibold" style={{ color: statusColor[zone.status] }}>
          {statusLabel[zone.status]}
        </span>
      </div>
      {zone.injuries.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t" style={{ borderColor: 'var(--aura-border)' }}>
          {zone.injuries.slice(0, 3).map((inj) => (
            <div key={inj.id}>
              <p style={{ color: 'var(--aura-text)' }}>{inj.diagnosis}</p>
              <p style={{ color: 'var(--aura-text3)' }}>
                {new Date(inj.injury_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                {inj.severity && ` · ${inj.severity}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Region labels ─────────────────────────────────────────────────────────────

const REGION_LABELS: Record<BodyRegion, string> = {
  head: 'Cabeça', neck: 'Pescoço', chest: 'Tórax', abdomen: 'Abdómen',
  shoulder: 'Ombro', arm: 'Braço', elbow: 'Cotovelo', forearm: 'Antebraço',
  wrist: 'Pulso', hand: 'Mão', hip: 'Anca', thigh: 'Coxa',
  knee: 'Joelho', calf: 'Gémeo', ankle: 'Tornozelo', foot: 'Pé',
  upper_back: 'Costas sup.', lower_back: 'Costas inf.', glute: 'Glúteo', hamstring: 'Isquiotibiais',
}

// ── Clickable zone wrapper ────────────────────────────────────────────────────

interface ZoneProps {
  region: BodyRegion
  zoneMap: Map<BodyRegion, BodyZoneInfo>
  onSelect: (region: BodyRegion) => void
  selected: BodyRegion | null
  children: React.ReactNode
}

function Zone({ region, zoneMap, onSelect, selected, children }: ZoneProps) {
  const info = zoneMap.get(region)
  const status = info?.status ?? 'clear'
  const hasInjuries = (info?.injuries.length ?? 0) > 0
  const colors = hasInjuries ? ZONE_COLORS[status] : DEFAULT_COLORS
  const isSelected = selected === region

  return (
    <g
      onClick={() => onSelect(region)}
      className="cursor-pointer"
      style={{
        fill: isSelected ? colors.stroke : colors.fill,
        stroke: isSelected ? colors.stroke : colors.stroke,
        strokeWidth: isSelected ? 2 : 1,
        transition: 'fill 0.15s, stroke 0.15s',
      }}
    >
      {children}
    </g>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface BodyMapProps {
  zoneMap: Map<BodyRegion, BodyZoneInfo>
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BodyMap({ zoneMap, className }: BodyMapProps) {
  const [selected, setSelected] = useState<BodyRegion | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const selectedInfo = selected ? zoneMap.get(selected) : null

  function handleSelect(region: BodyRegion, e: React.MouseEvent) {
    e.stopPropagation()
    if (selected === region) {
      setSelected(null)
      setTooltipPos(null)
    } else {
      setSelected(region)
      setTooltipPos({ x: e.clientX, y: e.clientY })
    }
  }

  // Legend
  const legend = [
    { status: 'active',  label: 'Lesão ativa',      color: 'var(--aura-danger)' },
    { status: 'recent',  label: 'Lesão recente',     color: 'var(--aura-warn)'   },
    { status: 'clear',   label: 'Sem lesão',          color: 'var(--aura-green)'  },
  ]

  return (
    <div className={cn('relative', className)} onClick={() => { setSelected(null); setTooltipPos(null) }}>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        {legend.map((l) => (
          <div key={l.status} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
            <span className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-6 justify-center">
        {/* ── Frontal view ─────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-1">
          <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>Frontal</p>
          <svg
            viewBox="0 0 120 280"
            className="w-28"
            style={{ overflow: 'visible' }}
          >
            {/* Head */}
            <Zone region="head" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <ellipse cx="60" cy="22" rx="18" ry="20" onClick={(e) => handleSelect('head', e)} />
            </Zone>
            {/* Neck */}
            <Zone region="neck" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="52" y="41" width="16" height="12" rx="3" onClick={(e) => handleSelect('neck', e)} />
            </Zone>
            {/* Shoulders */}
            <Zone region="shoulder" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <ellipse cx="28" cy="62" rx="14" ry="10" onClick={(e) => handleSelect('shoulder', e)} />
              <ellipse cx="92" cy="62" rx="14" ry="10" onClick={(e) => handleSelect('shoulder', e)} />
            </Zone>
            {/* Chest */}
            <Zone region="chest" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="36" y="52" width="48" height="38" rx="4" onClick={(e) => handleSelect('chest', e)} />
            </Zone>
            {/* Abdomen */}
            <Zone region="abdomen" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="38" y="90" width="44" height="32" rx="4" onClick={(e) => handleSelect('abdomen', e)} />
            </Zone>
            {/* Arms */}
            <Zone region="arm" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="14" y="72" width="14" height="34" rx="5" onClick={(e) => handleSelect('arm', e)} />
              <rect x="92" y="72" width="14" height="34" rx="5" onClick={(e) => handleSelect('arm', e)} />
            </Zone>
            {/* Elbows */}
            <Zone region="elbow" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <circle cx="21" cy="110" r="7" onClick={(e) => handleSelect('elbow', e)} />
              <circle cx="99" cy="110" r="7" onClick={(e) => handleSelect('elbow', e)} />
            </Zone>
            {/* Forearm */}
            <Zone region="forearm" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="14" y="117" width="14" height="28" rx="5" onClick={(e) => handleSelect('forearm', e)} />
              <rect x="92" y="117" width="14" height="28" rx="5" onClick={(e) => handleSelect('forearm', e)} />
            </Zone>
            {/* Wrist/Hand */}
            <Zone region="wrist" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <ellipse cx="21" cy="150" rx="7" ry="5" onClick={(e) => handleSelect('wrist', e)} />
              <ellipse cx="99" cy="150" rx="7" ry="5" onClick={(e) => handleSelect('wrist', e)} />
            </Zone>
            {/* Hip */}
            <Zone region="hip" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="36" y="122" width="48" height="22" rx="4" onClick={(e) => handleSelect('hip', e)} />
            </Zone>
            {/* Thigh */}
            <Zone region="thigh" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="37" y="144" width="20" height="42" rx="5" onClick={(e) => handleSelect('thigh', e)} />
              <rect x="63" y="144" width="20" height="42" rx="5" onClick={(e) => handleSelect('thigh', e)} />
            </Zone>
            {/* Knee */}
            <Zone region="knee" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <circle cx="47" cy="190" r="9" onClick={(e) => handleSelect('knee', e)} />
              <circle cx="73" cy="190" r="9" onClick={(e) => handleSelect('knee', e)} />
            </Zone>
            {/* Calf */}
            <Zone region="calf" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="39" y="199" width="16" height="38" rx="5" onClick={(e) => handleSelect('calf', e)} />
              <rect x="65" y="199" width="16" height="38" rx="5" onClick={(e) => handleSelect('calf', e)} />
            </Zone>
            {/* Ankle */}
            <Zone region="ankle" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <ellipse cx="47" cy="240" rx="8" ry="5" onClick={(e) => handleSelect('ankle', e)} />
              <ellipse cx="73" cy="240" rx="8" ry="5" onClick={(e) => handleSelect('ankle', e)} />
            </Zone>
            {/* Foot */}
            <Zone region="foot" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="38" y="245" width="19" height="10" rx="4" onClick={(e) => handleSelect('foot', e)} />
              <rect x="63" y="245" width="19" height="10" rx="4" onClick={(e) => handleSelect('foot', e)} />
            </Zone>
          </svg>
        </div>

        {/* ── Dorsal view ──────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-1">
          <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>Dorsal</p>
          <svg viewBox="0 0 120 280" className="w-28" style={{ overflow: 'visible' }}>
            {/* Head */}
            <Zone region="head" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <ellipse cx="60" cy="22" rx="18" ry="20" onClick={(e) => handleSelect('head', e)} />
            </Zone>
            {/* Neck */}
            <Zone region="neck" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="52" y="41" width="16" height="12" rx="3" onClick={(e) => handleSelect('neck', e)} />
            </Zone>
            {/* Upper back */}
            <Zone region="upper_back" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="36" y="52" width="48" height="38" rx="4" onClick={(e) => handleSelect('upper_back', e)} />
            </Zone>
            {/* Lower back */}
            <Zone region="lower_back" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="38" y="90" width="44" height="32" rx="4" onClick={(e) => handleSelect('lower_back', e)} />
            </Zone>
            {/* Shoulders (dorsal) */}
            <Zone region="shoulder" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <ellipse cx="28" cy="62" rx="14" ry="10" onClick={(e) => handleSelect('shoulder', e)} />
              <ellipse cx="92" cy="62" rx="14" ry="10" onClick={(e) => handleSelect('shoulder', e)} />
            </Zone>
            {/* Arms (dorsal) */}
            <Zone region="arm" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="14" y="72" width="14" height="34" rx="5" onClick={(e) => handleSelect('arm', e)} />
              <rect x="92" y="72" width="14" height="34" rx="5" onClick={(e) => handleSelect('arm', e)} />
            </Zone>
            {/* Glute */}
            <Zone region="glute" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="36" y="122" width="48" height="22" rx="4" onClick={(e) => handleSelect('glute', e)} />
            </Zone>
            {/* Hamstring */}
            <Zone region="hamstring" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="37" y="144" width="20" height="42" rx="5" onClick={(e) => handleSelect('hamstring', e)} />
              <rect x="63" y="144" width="20" height="42" rx="5" onClick={(e) => handleSelect('hamstring', e)} />
            </Zone>
            {/* Knee (dorsal) */}
            <Zone region="knee" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <circle cx="47" cy="190" r="9" onClick={(e) => handleSelect('knee', e)} />
              <circle cx="73" cy="190" r="9" onClick={(e) => handleSelect('knee', e)} />
            </Zone>
            {/* Calf (dorsal) */}
            <Zone region="calf" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <rect x="39" y="199" width="16" height="38" rx="5" onClick={(e) => handleSelect('calf', e)} />
              <rect x="65" y="199" width="16" height="38" rx="5" onClick={(e) => handleSelect('calf', e)} />
            </Zone>
            {/* Ankle (dorsal) */}
            <Zone region="ankle" zoneMap={zoneMap} onSelect={(r) => { }} selected={selected}>
              <ellipse cx="47" cy="240" rx="8" ry="5" onClick={(e) => handleSelect('ankle', e)} />
              <ellipse cx="73" cy="240" rx="8" ry="5" onClick={(e) => handleSelect('ankle', e)} />
            </Zone>
          </svg>
        </div>
      </div>

      {/* ── Selected zone detail ───────────────────────────────────────────── */}
      {selectedInfo && (
        <div
          className="mt-4 rounded-xl border p-3 space-y-2 text-xs"
          style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border)' }}
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold" style={{ color: 'var(--aura-text)' }}>
              {REGION_LABELS[selectedInfo.region]}
            </p>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: selectedInfo.status === 'active' ? 'var(--aura-danger-bg)' :
                            selectedInfo.status === 'recent' ? 'var(--aura-warn-bg)' : 'var(--aura-green-bg)',
                color: selectedInfo.status === 'active' ? 'var(--aura-danger)' :
                       selectedInfo.status === 'recent' ? 'var(--aura-warn)' : 'var(--aura-green)',
              }}
            >
              {selectedInfo.status === 'active' ? 'Ativa' : selectedInfo.status === 'recent' ? 'Recente' : 'Resolvida'}
            </span>
          </div>
          {selectedInfo.injuries.map((inj) => (
            <div key={inj.id} className="pt-1.5 border-t" style={{ borderColor: 'var(--aura-border)' }}>
              <p style={{ color: 'var(--aura-text)' }}>{inj.diagnosis}</p>
              <p style={{ color: 'var(--aura-text3)' }}>
                {new Date(inj.injury_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                {inj.severity && ` · ${inj.severity}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
