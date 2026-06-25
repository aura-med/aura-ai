import type { CSSProperties } from 'react'

// Shared athlete avatar: shows photo when available, falls back to shirt number.
// Matches .ath-avatar dimensions (34×34, border-radius 8px) by default.

interface AthleteAvatarProps {
  photoUrl?: string | null
  shirtNumber?: number | null
  name: string
  size?: number
}

export function AthleteAvatar({ photoUrl, shirtNumber, name, size }: AthleteAvatarProps) {
  const sizeStyle = size ? { width: size, height: size } : undefined
  const className = size ? undefined : 'ath-avatar'

  const containerStyle: CSSProperties = size
    ? {
        width: size,
        height: size,
        borderRadius: 8,
        background: 'var(--aura-bg3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: Math.max(9, size * 0.35),
        fontWeight: 700,
        color: 'var(--aura-text3)',
        fontFamily: 'var(--font-dm-mono)',
        overflow: 'hidden',
        position: 'relative',
      }
    : {}

  if (photoUrl) {
    return (
      <div className={className} style={size ? containerStyle : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={name}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            display: 'block',
          }}
        />
      </div>
    )
  }

  return (
    <div className={className} style={size ? containerStyle : undefined}>
      {shirtNumber ?? '—'}
    </div>
  )
}
