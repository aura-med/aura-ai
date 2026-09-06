// Static brand asset (small, self-hosted SVG) — a plain <img> avoids
// next/image's SVG optimizer, which Next.js disables by default for
// security (see next.config.mjs: no images.dangerouslyAllowSVG).
export function SophiMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/branding/sophi-mark.svg" alt="Sophi" width={size} height={size} className={className} />
  )
}
