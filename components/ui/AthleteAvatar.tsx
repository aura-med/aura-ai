// Shared athlete avatar — photo fills the rectangle via absolute inset-0 + object-cover.
// Dimensions are controlled by .ath-avatar in globals.css (currently 56×56, border-radius 10px).
// Falls back to shirt number when no photo is available.

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
            position:   'absolute',
            inset:      0,
            width:      '100%',
            height:     '100%',
            objectFit:  'cover',
            objectPosition: 'center top',
            display:    'block',
          }}
        />
      </div>
    )
  }
  return <div className="ath-avatar">{shirtNumber ?? '—'}</div>
}
