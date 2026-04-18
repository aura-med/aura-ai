import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function LoadPage() {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  const { data: sessions } = await supabase
    .from('gps_sessions')
    .select('athlete_id, hsr_distance_m, sprint_distance_m, decel_high_count, player_load, max_speed_kmh, athletes(name, shirt_number, position)')
    .eq('session_date', today)
    .order('hsr_distance_m', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
        >
          Carga & GPS
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--aura-text2)' }}>
          Dados da sessão de hoje · {today}
        </p>
      </div>

      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--aura-border)' }}>
              {['Atleta', 'HSR (m)', 'Sprint (m)', 'Dec. Alta Int.', 'Player Load', 'Vmax (km/h)'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium"
                  style={{ color: 'var(--aura-text3)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions?.map((s, i) => {
              const athlete = s.athletes as unknown as { name: string; shirt_number: number; position: string } | null
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--aura-border)' }}
                  className="hover:bg-[var(--aura-bg3)] transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium" style={{ color: 'var(--aura-text)' }}>
                      {athlete?.name ?? '—'}
                    </span>
                    <span className="text-xs ml-2" style={{ color: 'var(--aura-text3)' }}>
                      {athlete?.position}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--aura-blue)' }}>
                    {s.hsr_distance_m?.toFixed(0) ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--aura-warn)' }}>
                    {s.sprint_distance_m?.toFixed(0) ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--aura-purple)' }}>
                    {s.decel_high_count ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--aura-text2)' }}>
                    {s.player_load?.toFixed(1) ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--aura-green)' }}>
                    {s.max_speed_kmh?.toFixed(1) ?? '—'}
                  </td>
                </tr>
              )
            })}
            {(!sessions || sessions.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm"
                  style={{ color: 'var(--aura-text3)' }}>
                  Sem dados GPS para hoje. Importe dados Catapult ou insira via API.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
