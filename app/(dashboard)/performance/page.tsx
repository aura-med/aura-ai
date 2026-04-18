import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PerformancePage() {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  const { data: perf } = await supabase
    .from('performance_data')
    .select('*, athletes(name, shirt_number, position)')
    .eq('session_date', today)
    .order('vmax', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
        >
          Máximos & Perfil
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--aura-text2)' }}>
          Velocidades e métricas pico · {today}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {perf?.map((p) => {
          const athlete = p.athletes as unknown as { name: string; shirt_number: number; position: string } | null
          const vmaxPct = p.vmax_today_pct ?? 0
          const vmaxColor = vmaxPct >= 90 ? 'var(--aura-green)' : vmaxPct >= 80 ? 'var(--aura-warn)' : 'var(--aura-danger)'

          return (
            <div
              key={p.id}
              className="rounded-xl border p-4"
              style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>
                  {athlete?.name ?? '—'}
                </p>
                <span className="text-xs" style={{ color: 'var(--aura-text3)' }}>
                  {athlete?.position}
                </span>
              </div>

              <div className="flex items-end gap-1 mb-1">
                <span
                  className="text-2xl font-bold font-mono"
                  style={{ color: vmaxColor }}
                >
                  {p.vmax?.toFixed(1) ?? '—'}
                </span>
                <span className="text-xs mb-1" style={{ color: 'var(--aura-text3)' }}>km/h</span>
              </div>

              <div className="h-1.5 rounded-full mb-3" style={{ background: 'var(--aura-bg4)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${vmaxPct}%`, background: vmaxColor }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'HSR máx.', value: `${p.hsr_max ?? '—'}m`, color: 'var(--aura-blue)' },
                  { label: 'Sprint máx.', value: `${p.sprint_max ?? '—'}m`, color: 'var(--aura-warn)' },
                  { label: 'Acelerações', value: p.accel_max ?? '—', color: 'var(--aura-purple)' },
                  { label: 'Desacelerações', value: p.decel_max ?? '—', color: 'var(--aura-danger)' },
                ].map((m) => (
                  <div key={m.label}>
                    <p className="text-[10px]" style={{ color: 'var(--aura-text3)' }}>{m.label}</p>
                    <p className="font-mono font-bold" style={{ color: m.color }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {(!perf || perf.length === 0) && (
          <div
            className="col-span-full text-center py-12 rounded-xl border"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
              Sem dados de performance para hoje.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
