import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// FUT-style athlete card — photo is the hero, data at the bottom.
// Used in squad/page.tsx and athletes/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  available:   { label: 'Disponível',   color: 'var(--aura-green)',  bg: 'var(--aura-green-bg)',  dot: '#00e5a0' },
  modified:    { label: 'Condicionado', color: 'var(--aura-warn)',   bg: 'var(--aura-warn-bg)',   dot: '#f6ad55' },
  unavailable: { label: 'Indisponível', color: 'var(--aura-danger)', bg: 'var(--aura-danger-bg)', dot: '#ff4d6d' },
  rehab:       { label: 'Reabilitação', color: 'var(--aura-blue)',   bg: 'var(--aura-blue-bg)',   dot: '#4d9aff' },
}

interface AthleteCardProps {
  href:         string
  name:         string
  photoUrl?:    string | null
  shirtNumber?: number | null
  position?:    string | null
  status:       string
  score:        number | null
  scoreColor:   string
  scoreLabel:   string
}

export function AthleteCard({
  href, name, photoUrl, shirtNumber, position,
  status, score, scoreColor, scoreLabel,
}: AthleteCardProps) {
  const st = STATUS_CFG[status] ?? STATUS_CFG.available

  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        className="flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 group cursor-pointer"
        style={{
          background:   'var(--aura-bg2)',
          borderColor:  'var(--aura-border)',
          boxShadow:    '0 1px 3px rgba(0,0,0,0.18)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--aura-border2)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow  = '0 4px 16px rgba(0,0,0,0.28)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--aura-border)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow  = '0 1px 3px rgba(0,0,0,0.18)'
        }}
      >
        {/* ── Hero photo (top ~65%) ──────────────────────────────────── */}
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: '4/5', background: 'var(--aura-bg3)' }}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={name}
              style={{
                position:       'absolute',
                inset:          0,
                width:          '100%',
                height:         '100%',
                objectFit:      'cover',
                objectPosition: 'center top',
                display:        'block',
              }}
            />
          ) : (
            /* Shirt-number fallback — mesh-style background */
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                backgroundImage: 'radial-gradient(var(--aura-border2) 1px, transparent 1px)',
                backgroundSize:  '12px 12px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-syne)',
                  fontSize:   '2.5rem',
                  fontWeight: 900,
                  color:      'var(--aura-green)',
                  lineHeight: 1,
                }}
              >
                {shirtNumber ?? '—'}
              </span>
            </div>
          )}

          {/* Score chip — top right corner */}
          {score !== null && (
            <div
              className="absolute top-2 right-2 rounded-lg px-1.5 py-0.5"
              style={{
                background: 'rgba(10,13,18,0.72)',
                backdropFilter: 'blur(6px)',
                border: `1px solid ${scoreColor}44`,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-dm-mono)',
                  fontSize:   '11px',
                  fontWeight: 700,
                  color:      scoreColor,
                }}
              >
                {score}%
              </span>
            </div>
          )}
        </div>

        {/* ── Data zone (bottom ~35%) ────────────────────────────────── */}
        <div
          className="flex flex-col gap-1.5 p-3"
          style={{
            background:  'var(--aura-bg2)',
            borderTop:   '1px solid var(--aura-border)',
          }}
        >
          {/* Name */}
          <p
            className="text-sm font-semibold truncate leading-tight"
            style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-inter)' }}
          >
            {name}
          </p>

          {/* Shirt + position */}
          <p
            className="text-[10px] truncate"
            style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}
          >
            {shirtNumber ? `#${shirtNumber}` : ''}
            {shirtNumber && position ? ' · ' : ''}
            {position ?? ''}
          </p>

          {/* Status badge — full width */}
          <div
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 mt-0.5"
            style={{ background: st.bg }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: st.dot }}
            />
            <span
              className="text-[10px] font-semibold truncate"
              style={{ color: st.color }}
            >
              {st.label}
            </span>
            {score !== null && (
              <span
                className="ml-auto text-[10px] font-medium"
                style={{ color: st.color, opacity: 0.7 }}
              >
                {scoreLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
