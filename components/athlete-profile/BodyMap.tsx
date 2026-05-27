'use client'

import { useState } from 'react'
import type { BodyZoneInfo, BodyRegion } from '@/types/athlete-profile'

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// viewBox per figure: "0 0 88 272"   centre-x = 44
//
// Y landmarks        X landmarks (arms hang alongside torso)
//  Head:   0–26       L-arm outer  6    R-arm outer 82
//  Neck:  26–36       L-arm inner 22    R-arm inner 66
//  Chest: 36–86       Chest:      22–66 (44 px wide)
//  Abs:   86–118      Waist:      25–63
//  Hip:  118–150      Hip wide:   18–70
//  Thigh:150–200      L-thigh:    18–38   R-thigh: 50–70
//  Knee: 200–220      Calf:       13–39   /  49–75
//  Calf: 220–256      Ankle:      15–37   /  51–73
//  Ankle:256–266      Foot:        9–39   /  49–79
//  Foot: 266–272
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  fillIdle:    'rgba(148,163,184,0.10)',   // slate-400 @ 10 %  — barely visible
  fillHover:   'rgba(148,163,184,0.26)',   // slate-400 @ 26 %  — clear hover
  strokeIdle:  'var(--aura-text2)',        // adapts to theme
  sw:          0.8,
  swSel:       1.6,
  active: { fill: 'rgba(239,68,68,0.22)',    stroke: 'rgba(239,68,68,0.80)'    },
  recent: { fill: 'rgba(245,158,11,0.22)',   stroke: 'rgba(245,158,11,0.80)'   },
} as const

const LABELS: Record<BodyRegion, string> = {
  head:        'Cabeça',
  neck:        'Pescoço',
  chest:       'Tórax',
  abdomen:     'Abdómen',
  shoulder:    'Ombro',
  arm:         'Braço',
  elbow:       'Cotovelo',
  forearm:     'Antebraço',
  wrist:       'Pulso',
  hand:        'Mão',
  hip:         'Anca / Pélvis',
  thigh:       'Coxa',
  knee:        'Joelho',
  calf:        'Gémeo',
  ankle:       'Tornozelo',
  foot:        'Pé',
  upper_back:  'Costas sup.',
  lower_back:  'Costas inf.',
  glute:       'Glúteo',
  hamstring:   'Isquiotibiais',
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone component — wraps any SVG children with interactive fill / stroke state
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
    stroke = T.strokeIdle
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
        transition:     'fill 0.16s ease, stroke-width 0.12s ease',
      }}
    >
      {children}
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontal SVG  (anterior view)
// ─────────────────────────────────────────────────────────────────────────────

interface SvgProps extends ZoneCtx {}

function FrontalSvg({ zoneMap, selected, hovered, onSelect, onHover }: SvgProps) {
  const z: ZoneCtx = { zoneMap, selected, hovered, onSelect, onHover }

  return (
    <svg viewBox="0 0 88 272" className="w-16" style={{ overflow: 'visible' }}>

      {/* ── HEAD ──────────────────────────────────────────────────── */}
      <Zone region="head" {...z}>
        <ellipse cx="44" cy="13" rx="12.5" ry="13" />
      </Zone>

      {/* ── NECK ──────────────────────────────────────────────────── */}
      <Zone region="neck" {...z}>
        {/* slim trapezoid, slightly wider at base */}
        <path d="M 40,25.5 C 40,28 39,32 39,36 L 49,36 C 49,32 48,28 48,25.5 Z" />
      </Zone>

      {/* ── SHOULDERS — deltoid crescent on each side ─────────────── */}
      <Zone region="shoulder" {...z}>
        {/* Left deltoid */}
        <path d="
          M 22,44
          C 15,42 8,46 6,55
          C 4,63 6,71 8,77
          C 13,71 17,69 22,69
          L 22,44 Z
        " />
        {/* Right deltoid */}
        <path d="
          M 66,44
          L 66,69
          C 71,69 75,71 80,77
          C 82,71 84,63 82,55
          C 80,46 73,42 66,44 Z
        " />
      </Zone>

      {/* ── CHEST — upper torso, V-taper trapezoid ────────────────── */}
      <Zone region="chest" {...z}>
        <path d="
          M 39,36 L 49,36
          C 53,38 61,42 66,46
          L 66,86 L 22,86
          L 22,46
          C 27,42 35,38 39,36 Z
        " />
      </Zone>

      {/* ── ABDOMEN ───────────────────────────────────────────────── */}
      <Zone region="abdomen" {...z}>
        <path d="
          M 22,86 L 66,86
          C 65,97 63,108 63,118
          L 25,118
          C 25,108 23,97 22,86 Z
        " />
      </Zone>

      {/* ── HIP / PELVIS — widens then curves to crotch ───────────── */}
      <Zone region="hip" {...z}>
        <path d="
          M 25,118 L 63,118
          C 67,125 70,133 70,143
          C 66,150 58,154 52,154
          L 44,157 L 36,154
          C 30,154 22,150 18,143
          C 18,133 21,125 25,118 Z
        " />
      </Zone>

      {/* ── UPPER ARMS ────────────────────────────────────────────── */}
      <Zone region="arm" {...z}>
        {/* Left — tapered athletic arm */}
        <path d="
          M 7,57
          C 5,65 4,79 5,97
          L 5,114
          C 5,119 8,123 13,123
          L 18,123
          C 22,122 22,118 22,114
          L 22,69
          C 17,69 12,71 8,77
          C 6,71 6,63 7,57 Z
        " />
        {/* Right — mirror */}
        <path d="
          M 81,57
          C 82,63 82,71 80,77
          C 76,71 71,69 66,69
          L 66,114
          C 66,118 66,122 70,123
          L 75,123
          C 80,123 83,119 83,114
          L 83,97
          C 84,79 83,65 81,57 Z
        " />
      </Zone>

      {/* ── ELBOWS ────────────────────────────────────────────────── */}
      <Zone region="elbow" {...z}>
        {/* Left */}
        <path d="
          M 5,114 L 5,128
          C 5,132 8,135 13,135
          L 17,135
          C 21,134 22,130 22,126
          L 22,118
          C 21,122 17,123 13,123 Z
        " />
        {/* Right */}
        <path d="
          M 83,114 L 83,126
          C 83,130 84,134 80,135
          L 75,135
          C 71,134 66,130 66,118
          L 66,126
          C 66,130 67,122 71,123
          L 75,123
          C 80,123 83,119 83,114 Z
        " />
      </Zone>

      {/* ── FOREARMS ──────────────────────────────────────────────── */}
      <Zone region="forearm" {...z}>
        {/* Left — slightly tapered toward wrist */}
        <path d="
          M 5,130
          C 3,138 3,152 5,164
          L 7,187
          C 7,190 10,192 14,192
          L 18,192
          C 21,192 22,189 22,185
          L 22,160
          C 22,148 22,136 21,131
          C 16,130 10,130 5,130 Z
        " />
        {/* Right */}
        <path d="
          M 83,130
          C 78,130 72,130 67,131
          L 66,160
          L 66,185
          C 66,189 67,192 70,192
          L 74,192
          C 78,192 81,190 81,187
          L 83,164
          C 85,152 85,138 83,130 Z
        " />
      </Zone>

      {/* ── THIGHS ────────────────────────────────────────────────── */}
      <Zone region="thigh" {...z}>
        {/* Left */}
        <path d="
          M 18,150
          C 15,157 14,171 15,189
          L 15,200 L 38,200
          L 38,186
          C 37,170 37,157 37,152
          Z
        " />
        {/* Right */}
        <path d="
          M 70,150
          L 51,152
          C 51,157 51,170 50,186
          L 50,200 L 73,200
          L 73,189
          C 74,171 73,157 70,150 Z
        " />
      </Zone>

      {/* ── KNEES ─────────────────────────────────────────────────── */}
      <Zone region="knee" {...z}>
        {/* Left */}
        <path d="
          M 15,200 L 15,214
          C 15,218 19,221 25,221
          L 29,221
          C 35,221 38,218 38,214
          L 38,200 Z
        " />
        {/* Right */}
        <path d="
          M 50,200 L 50,214
          C 50,218 53,221 59,221
          L 63,221
          C 69,221 73,218 73,214
          L 73,200 Z
        " />
      </Zone>

      {/* ── CALVES — organic gastrocnemius shape ──────────────────── */}
      <Zone region="calf" {...z}>
        {/* Left */}
        <path d="
          M 13,221 L 39,221
          C 40,229 41,241 39,251
          C 37,257 32,260 26,260
          C 20,260 16,257 14,251
          C 12,241 12,229 13,221 Z
        " />
        {/* Right */}
        <path d="
          M 49,221 L 75,221
          C 76,229 76,241 74,251
          C 72,257 68,260 62,260
          C 56,260 51,257 49,251
          C 47,241 47,229 49,221 Z
        " />
      </Zone>

      {/* ── ANKLES ────────────────────────────────────────────────── */}
      <Zone region="ankle" {...z}>
        {/* Left */}
        <path d="M 16,260 L 36,260 C 37,262 37,266 36,267 L 16,267 C 15,266 15,262 16,260 Z" />
        {/* Right */}
        <path d="M 52,260 L 72,260 C 73,262 73,266 72,267 L 52,267 C 51,266 51,262 52,260 Z" />
      </Zone>

      {/* ── FEET ──────────────────────────────────────────────────── */}
      <Zone region="foot" {...z}>
        {/* Left */}
        <path d="
          M 10,267 L 37,267
          C 39,269 40,272 37,272
          L 10,272
          C 7,272 7,269 10,267 Z
        " />
        {/* Right */}
        <path d="
          M 51,267 L 78,267
          C 81,269 81,272 78,272
          L 51,272
          C 48,272 48,269 51,267 Z
        " />
      </Zone>

      {/* ── Anatomy reference lines (non-interactive) ─────────────── */}
      <g
        className="pointer-events-none"
        stroke="var(--aura-text2)"
        strokeWidth="0.45"
        fill="none"
        opacity={0.22}
      >
        {/* Clavicles */}
        <path d="M 44,36 C 40,38 32,41 24,46" />
        <path d="M 44,36 C 48,38 56,41 64,46" />
        {/* Sternal midline */}
        <line x1="44" y1="36" x2="44" y2="86" />
        {/* Linea alba */}
        <line x1="44" y1="86" x2="44" y2="118" strokeDasharray="2 2.5" />
        {/* Inguinal lines */}
        <path d="M 44,150 C 38,148 30,148 22,143" strokeDasharray="2 2.5" />
        <path d="M 44,150 C 50,148 58,148 66,143" strokeDasharray="2 2.5" />
      </g>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Dorsal SVG  (posterior view)
// Same paths, different zone mappings:
//   chest → upper_back   |  abdomen → lower_back   |  hip → glute
//   thigh → hamstring     |  rest identical to front
// ─────────────────────────────────────────────────────────────────────────────

function DorsalSvg({ zoneMap, selected, hovered, onSelect, onHover }: SvgProps) {
  const z: ZoneCtx = { zoneMap, selected, hovered, onSelect, onHover }

  return (
    <svg viewBox="0 0 88 272" className="w-16" style={{ overflow: 'visible' }}>

      <Zone region="head" {...z}>
        <ellipse cx="44" cy="13" rx="12.5" ry="13" />
      </Zone>

      <Zone region="neck" {...z}>
        <path d="M 40,25.5 C 40,28 39,32 39,36 L 49,36 C 49,32 48,28 48,25.5 Z" />
      </Zone>

      <Zone region="shoulder" {...z}>
        <path d="M 22,44 C 15,42 8,46 6,55 C 4,63 6,71 8,77 C 13,71 17,69 22,69 L 22,44 Z" />
        <path d="M 66,44 L 66,69 C 71,69 75,71 80,77 C 82,71 84,63 82,55 C 80,46 73,42 66,44 Z" />
      </Zone>

      {/* ── UPPER BACK ────────────────────────────────────────────── */}
      <Zone region="upper_back" {...z}>
        <path d="
          M 39,36 L 49,36
          C 53,38 61,42 66,46
          L 66,86 L 22,86
          L 22,46
          C 27,42 35,38 39,36 Z
        " />
      </Zone>

      {/* ── LOWER BACK ────────────────────────────────────────────── */}
      <Zone region="lower_back" {...z}>
        <path d="
          M 22,86 L 66,86
          C 65,97 63,108 63,118
          L 25,118
          C 25,108 23,97 22,86 Z
        " />
      </Zone>

      {/* ── GLUTES ────────────────────────────────────────────────── */}
      <Zone region="glute" {...z}>
        <path d="
          M 25,118 L 63,118
          C 67,125 70,133 70,143
          C 66,150 58,154 52,154
          L 44,157 L 36,154
          C 30,154 22,150 18,143
          C 18,133 21,125 25,118 Z
        " />
      </Zone>

      <Zone region="arm" {...z}>
        <path d="
          M 7,57 C 5,65 4,79 5,97 L 5,114
          C 5,119 8,123 13,123 L 18,123
          C 22,122 22,118 22,114 L 22,69
          C 17,69 12,71 8,77 C 6,71 6,63 7,57 Z
        " />
        <path d="
          M 81,57 C 82,63 82,71 80,77
          C 76,71 71,69 66,69 L 66,114
          C 66,118 66,122 70,123 L 75,123
          C 80,123 83,119 83,114 L 83,97
          C 84,79 83,65 81,57 Z
        " />
      </Zone>

      <Zone region="elbow" {...z}>
        <path d="M 5,114 L 5,128 C 5,132 8,135 13,135 L 17,135 C 21,134 22,130 22,126 L 22,118 C 21,122 17,123 13,123 Z" />
        <path d="M 83,114 L 83,126 C 83,130 84,134 80,135 L 75,135 C 71,134 66,130 66,118 L 66,126 C 66,130 67,122 71,123 L 75,123 C 80,123 83,119 83,114 Z" />
      </Zone>

      <Zone region="forearm" {...z}>
        <path d="
          M 5,130 C 3,138 3,152 5,164 L 7,187
          C 7,190 10,192 14,192 L 18,192
          C 21,192 22,189 22,185 L 22,160
          C 22,148 22,136 21,131
          C 16,130 10,130 5,130 Z
        " />
        <path d="
          M 83,130 C 78,130 72,130 67,131
          L 66,160 L 66,185
          C 66,189 67,192 70,192 L 74,192
          C 78,192 81,190 81,187 L 83,164
          C 85,152 85,138 83,130 Z
        " />
      </Zone>

      {/* ── HAMSTRINGS ────────────────────────────────────────────── */}
      <Zone region="hamstring" {...z}>
        <path d="
          M 18,150 C 15,157 14,171 15,189
          L 15,200 L 38,200 L 38,186
          C 37,170 37,157 37,152 Z
        " />
        <path d="
          M 70,150 L 51,152
          C 51,157 51,170 50,186
          L 50,200 L 73,200 L 73,189
          C 74,171 73,157 70,150 Z
        " />
      </Zone>

      <Zone region="knee" {...z}>
        <path d="M 15,200 L 15,214 C 15,218 19,221 25,221 L 29,221 C 35,221 38,218 38,214 L 38,200 Z" />
        <path d="M 50,200 L 50,214 C 50,218 53,221 59,221 L 63,221 C 69,221 73,218 73,214 L 73,200 Z" />
      </Zone>

      <Zone region="calf" {...z}>
        <path d="M 13,221 L 39,221 C 40,229 41,241 39,251 C 37,257 32,260 26,260 C 20,260 16,257 14,251 C 12,241 12,229 13,221 Z" />
        <path d="M 49,221 L 75,221 C 76,229 76,241 74,251 C 72,257 68,260 62,260 C 56,260 51,257 49,251 C 47,241 47,229 49,221 Z" />
      </Zone>

      <Zone region="ankle" {...z}>
        <path d="M 16,260 L 36,260 C 37,262 37,266 36,267 L 16,267 C 15,266 15,262 16,260 Z" />
        <path d="M 52,260 L 72,260 C 73,262 73,266 72,267 L 52,267 C 51,266 51,262 52,260 Z" />
      </Zone>

      {/* ── Anatomy reference lines (posterior) ───────────────────── */}
      <g
        className="pointer-events-none"
        stroke="var(--aura-text2)"
        strokeWidth="0.45"
        fill="none"
        opacity={0.22}
      >
        {/* Spine */}
        <line x1="44" y1="36" x2="44" y2="150" />
        {/* Scapulae outlines */}
        <path d="M 44,46 C 40,48 34,54 32,64 C 30,74 33,82 36,86" />
        <path d="M 44,46 C 48,48 54,54 56,64 C 58,74 55,82 52,86" />
        {/* SI joint hint */}
        <path d="M 38,136 C 40,138 44,139 44,139 C 44,139 48,138 50,136" strokeDasharray="2 2.5" />
      </g>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone detail panel  (shown below the maps when a region is selected)
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
  zoneMap:   Map<BodyRegion, BodyZoneInfo>
  className?: string
}

export function BodyMap({ zoneMap, className }: BodyMapProps) {
  const [selected, setSelected] = useState<BodyRegion | null>(null)
  const [hovered,  setHovered]  = useState<BodyRegion | null>(null)

  function handleSelect(region: BodyRegion) {
    setSelected((prev) => (prev === region ? null : region))
  }

  const selectedInfo = selected ? (zoneMap.get(selected) ?? null) : null

  const svgProps: SvgProps = {
    zoneMap,
    selected,
    hovered,
    onSelect: handleSelect,
    onHover:  setHovered,
  }

  return (
    <div className={className} onClick={() => setSelected(null)}>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        {([
          { label: 'Lesão ativa',   color: 'rgba(239,68,68,0.85)'    },
          { label: 'Lesão recente', color: 'rgba(245,158,11,0.85)'   },
        ] as const).map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
            <span className="text-[10px]" style={{ color: 'var(--aura-text2)' }}>
              {l.label}
            </span>
          </div>
        ))}
      </div>

      {/* Both SVG figures */}
      <div
        className="flex gap-8 justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-1.5">
          <p
            className="text-[9px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--aura-text2)' }}
          >
            Anterior
          </p>
          <FrontalSvg {...svgProps} />
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <p
            className="text-[9px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--aura-text2)' }}
          >
            Posterior
          </p>
          <DorsalSvg {...svgProps} />
        </div>
      </div>

      {/* Region detail on selection */}
      {selected && selectedInfo && (
        <ZoneDetail info={selectedInfo} />
      )}
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
