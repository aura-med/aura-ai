// Shared athlete avatar: shows photo when available, falls back to shirt number.
// Matches .ath-avatar dimensions (34×34, border-radius 8px) by default.

interface AthleteAvatarProps {
  photoUrl?: string | null
  shirtNumber?: number | null
  name: string
}

export function AthleteAvatar({ photoUrl, shirtNumber, name }: AthleteAvatarProps) {
  if (photoUrl) {
    return (
      <div className="ath-avatar">
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
  return <div className="ath-avatar">{shirtNumber ?? '—'}</div>
}
