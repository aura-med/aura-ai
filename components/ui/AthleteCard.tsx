import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// FUT-style athlete card — photo is the hero, data at the bottom.
// Used in squad/page.tsx and athletes/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  available:   { label: 'Disponível',   color: 'var(--sophi-green)',  bg: 'var(--sophi-green-bg)',  dot: '#00e5a0' },
  modified:    { label: 'Condicionado', color: 'var(--sophi-warn)',   bg: 'var(--sophi-warn-bg)',   dot: '#f6ad55' },
  unavailable: { label: 'Indisponível', color: 'var(--sophi-danger)', bg: 'var(--sophi-danger-bg)', dot: '#ff4d6d' },
  rehab:       { label: 'Reabilitação', color: 'var(--sophi-blue)',   bg: 'var(--sophi-blue-bg)',   dot: '#4d9aff' },
}

interface AthleteCardProps {
  href:            string
  name:            string
  photoUrl?:       string | null
  shirtNumber?:    number | null
  position?:       string | null
  status:          string
  score:           number | null
  scoreColor:      string
  scoreLabel:      string
  loadManagement?: boolean
}

export function AthleteCard({
  href, name, photoUrl, shirtNumber, position,
  status, loadManagement,
}: AthleteCardProps) {
  const st = STATUS_CFG[status] ?? STATUS_CFG.available

  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        className="fut-card flex flex-col overflow-hidden rounded-2xl cursor-pointer"
        style={{ background: 'var(--sophi-bg2)' }}
      >
        {/* ── Hero photo (top ~65%) ──────────────────────────────────── */}
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: '4/5', background: 'var(--sophi-bg3)' }}
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
                backgroundImage: 'radial-gradient(var(--sophi-border2) 1px, transparent 1px)',
                backgroundSize:  '12px 12px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-syne)',
                  fontSize:   '2.5rem',
                  fontWeight: 900,
                  color:      'var(--sophi-green)',
                  lineHeight: 1,
                }}
              >
                {shirtNumber ?? '—'}
              </span>
            </div>
          )}

          {/* Score chip — hidden for now: phase-1 scoring isn't populated yet,
              showing it here would misrepresent the athlete's actual state. */}
        </div>

        {/* ── Data zone (bottom ~35%) ────────────────────────────────── */}
        <div
          className="flex flex-col gap-1.5 p-3"
          style={{
            background:  'var(--sophi-bg2)',
            borderTop:   '1px solid var(--sophi-border)',
          }}
        >
          {/* Name */}
          <p
            className="text-sm font-semibold truncate leading-tight"
            style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-inter)' }}
          >
            {name}
          </p>

          {/* Shirt + position */}
          <p
            className="text-[10px] truncate"
            style={{ color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}
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
          </div>

          {/* Load management badge — athlete is otherwise available but
              training under a managed-load plan (see rehab_plans.plan_type). */}
          {loadManagement && (
            <div
              className="flex items-center gap-1.5 rounded-lg px-2 py-1"
              style={{ background: 'var(--sophi-warn-bg)' }}
            >
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#f6ad55' }} />
              <span className="text-[10px] font-semibold truncate" style={{ color: 'var(--sophi-warn)' }}>
                Gestão de Carga
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
