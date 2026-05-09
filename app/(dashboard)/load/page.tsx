import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getSquadIdParam, withSquadParam } from '@/lib/squad-url'

interface GpsRow {
  athlete: { id: string; name: string; position: string | null; shirt_number: number | null }
  sessions: Array<{
    session_date: string; session_type: string | null; total_distance_m: number | null
    hsr_distance_m: number | null; sprint_distance_m: number | null; max_speed_kmh: number | null
    decel_high_count: number | null; player_load: number | null
  }>
}

export default async function LoadPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const supabase = await createClient()
  let query = supabase
    .from('gps_sessions')
    .select(`*, athletes!inner(id, name, position, shirt_number, squad_id)`)
    .order('session_date', { ascending: false })
    .limit(100)

  if (squadId) query = query.eq('athletes.squad_id', squadId)

  const { data: sessions } = await query

  const byAthlete: Record<string, GpsRow> = {}
  ;(sessions ?? []).forEach((s) => {
    const sessionWithAthlete = s as typeof s & { athletes: { id: string; name: string; position: string | null; shirt_number: number | null } }
    if (!sessionWithAthlete.athletes) return
    const id = sessionWithAthlete.athletes.id
    if (!byAthlete[id]) byAthlete[id] = { athlete: sessionWithAthlete.athletes, sessions: [] }
    byAthlete[id].sessions.push(s)
  })

  const rows: GpsRow[] = Object.values(byAthlete)
    .sort((a, b) => (a.athlete.shirt_number ?? 99) - (b.athlete.shirt_number ?? 99))

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">📡 Carga & GPS</div>
        <div className="sec-sub">Sessões GPS importadas · Dados por atleta</div>
      </div>

      {rows.length === 0 ? (
        <div className="alert alert-b">
          <div className="adot ad-b" />
          <div style={{ fontSize: 12 }}>
            <strong>Sem dados GPS carregados.</strong> Para importar dados, vai ao botão de upload
            ou exporta um CSV do STATSports/Catapult e usa a API de importação.
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="ctitle">Sessões recentes por atleta</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Atleta</th>
                <th style={{ textAlign: 'right' }}>Distância (m)</th>
                <th style={{ textAlign: 'right' }}>HSR (m)</th>
                <th style={{ textAlign: 'right' }}>Sprint (m)</th>
                <th style={{ textAlign: 'right' }}>Vmax (km/h)</th>
                <th style={{ textAlign: 'right' }}>Decel</th>
                <th style={{ textAlign: 'right' }}>Player Load</th>
                <th style={{ textAlign: 'center' }}>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ athlete, sessions }) => {
                const latest = sessions[0]
                return (
                  <tr key={athlete.id}>
                    <td>
                      <Link href={withSquadParam(`/athletes/${athlete.id}`, squadId)} style={{ textDecoration: 'none' }}>
                        <strong>{athlete.name}</strong>
                        <br /><span style={{ fontSize: 10, color: 'var(--text2)' }}>{athlete.position}</span>
                      </Link>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {latest?.total_distance_m?.toFixed(0) ?? '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {latest?.hsr_distance_m?.toFixed(0) ?? '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {latest?.sprint_distance_m?.toFixed(0) ?? '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--blue)' }}>
                      {latest?.max_speed_kmh?.toFixed(1) ?? '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {latest?.decel_high_count ?? '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {latest?.player_load?.toFixed(1) ?? '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--mono)', padding: '2px 7px', borderRadius: 4,
                        background: latest?.session_type === 'match' ? 'var(--danger2)' : 'var(--blue2)',
                        color: latest?.session_type === 'match' ? 'var(--danger)' : 'var(--blue)',
                      }}>
                        {latest?.session_type ?? '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
