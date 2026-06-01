export function DashboardSkeleton({ title = 'A carregar' }: { title?: string }) {
  return (
    <div aria-label={title} aria-busy="true">
      <div className="sec-hdr">
        <div className="h-6 w-56 rounded bg-[var(--aura-bg3)]" />
        <div className="mt-2 h-3 w-72 rounded bg-[var(--aura-bg3)]" />
      </div>
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="kpi">
            <div className="h-8 w-16 rounded bg-[var(--aura-bg4)]" />
            <div className="mt-3 h-3 w-24 rounded bg-[var(--aura-bg4)]" />
          </div>
        ))}
      </div>
      <div className="g2">
        {[0, 1].map((item) => (
          <div key={item} className="card">
            <div className="h-3 w-36 rounded bg-[var(--aura-bg4)]" />
            <div className="mt-5 space-y-3">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="h-10 rounded bg-[var(--aura-bg3)]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
