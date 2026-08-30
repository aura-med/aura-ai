// Static brand asset (small, self-hosted SVG) — see SophiMark.tsx for why
// this is a plain <img> rather than next/image.
//
// Currently a single hardcoded badge (Estrela da Amadora) — this app is
// multi-org (organizations table has no logo/badge column yet), so this
// only belongs where the active org is already known and matches this
// specific club. Do not render it on the shared, pre-auth login/password
// pages: those are used by every club on the platform, not just this one.
export function ClubBadge({ orgName, size = 28, className }: { orgName?: string; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/branding/estrela-amadora-badge.svg"
      alt={orgName ? `Escudo do ${orgName}` : 'Escudo do clube'}
      width={size}
      height={Math.round(size * (200 / 155))}
      className={className}
    />
  )
}
