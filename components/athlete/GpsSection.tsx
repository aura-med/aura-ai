interface GpsSessionRow {
  session_date: string
  session_type: string | null
  total_distance_m: number | null
  hsr_distance_m: number | null
  max_speed_kmh: number | null
  player_load: number | null
}

export function GpsSection({ sessions }: { sessions: GpsSessionRow[] }) {
  if (sessions.length === 0) return null

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
        GPS Recente
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr style={{ color: 'var(--aura-text3)' }}>
              <th className="text-left py-1.5 pr-4">Data</th>
              <th className="text-left py-1.5 pr-4">Tipo</th>
              <th className="text-right py-1.5 pr-4">Distancia</th>
              <th className="text-right py-1.5 pr-4">HSR</th>
              <th className="text-right py-1.5 pr-4">Vmax</th>
              <th className="text-right py-1.5">Player Load</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((g, i) => (
              <tr
                key={`${g.session_date}-${i}`}
                className="border-t"
                style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }}
              >
                <td className="py-2 pr-4">
                  {new Date(g.session_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                </td>
                <td className="py-2 pr-4 capitalize">{g.session_type ?? '--'}</td>
                <td className="py-2 pr-4 text-right">
                  {g.total_distance_m ? `${(g.total_distance_m / 1000).toFixed(1)}km` : '--'}
                </td>
                <td className="py-2 pr-4 text-right">
                  {g.hsr_distance_m ? `${(g.hsr_distance_m / 1000).toFixed(1)}km` : '--'}
                </td>
                <td className="py-2 pr-4 text-right">
                  {g.max_speed_kmh ? `${g.max_speed_kmh.toFixed(1)}km/h` : '--'}
                </td>
                <td className="py-2 text-right">
                  {g.player_load?.toFixed(0) ?? '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
