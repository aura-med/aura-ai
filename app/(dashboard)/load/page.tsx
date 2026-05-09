import { connection } from 'next/server'
import Link from 'next/link'
import { getLoadPageDTO } from '@/lib/data/load'
import { getSquadIdParam, withSquadParam } from '@/lib/squad-url'

export default async function LoadPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const dto = await getLoadPageDTO(squadId)

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Carga & GPS</div>
        <div className="sec-sub">Sessoes GPS importadas · Dados por atleta</div>
      </div>

      {dto.rows.length === 0 ? (
        <div className="alert alert-b">
          <div className="adot ad-b" />
          <div style={{ fontSize: 12 }}>
            <strong>Sem dados GPS carregados.</strong> Para importar dados, exporte um CSV do STATSports/Catapult e use a API de importacao.
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="ctitle">Sessoes recentes por atleta</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Atleta</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Distancia (m)</th>
                  <th scope="col" style={{ textAlign: 'right' }}>HSR (m)</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Sprint (m)</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Vmax (km/h)</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Decel</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Player Load</th>
                  <th scope="col" style={{ textAlign: 'center' }}>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {dto.rows.map(({ athlete, latest }) => (
                  <tr key={athlete.id}>
                    <td>
                      <Link href={withSquadParam(`/athletes/${athlete.id}`, squadId)} style={{ textDecoration: 'none' }}>
                        <strong>{athlete.name}</strong>
                        <br /><span style={{ fontSize: 11, color: 'var(--text2)' }}>{athlete.position ?? '-'}</span>
                      </Link>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {latest.totalDistanceM?.toFixed(0) ?? '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {latest.hsrDistanceM?.toFixed(0) ?? '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {latest.sprintDistanceM?.toFixed(0) ?? '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--blue)' }}>
                      {latest.maxSpeedKmh?.toFixed(1) ?? '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {latest.decelHighCount ?? '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {latest.playerLoad?.toFixed(1) ?? '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: 10, fontFamily: 'var(--mono)', padding: '3px 8px', borderRadius: 4,
                        background: latest.sessionType === 'match' ? 'var(--danger2)' : 'var(--blue2)',
                        color: latest.sessionType === 'match' ? 'var(--danger)' : 'var(--blue)',
                      }}>
                        {latest.sessionType ?? '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
