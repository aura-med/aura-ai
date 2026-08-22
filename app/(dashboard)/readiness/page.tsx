import { connection } from 'next/server'
import Link from 'next/link'
import { ScoreBadge } from '@/components/ui/sophi'
import { getReadinessPageDTO } from '@/lib/data/readiness'
import { getSquadIdParam, withSquadParam } from '@/lib/squad-url'

const STATUS_COLORS = {
  green: 'var(--green2)',
  amber: 'var(--warn)',
  red: 'var(--danger)',
  grey: 'var(--text3)',
}

export default async function ReadinessPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const dto = await getReadinessPageDTO(squadId)

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Prontidao de Performance</div>
        <div className="sec-sub">Semaforo de 4 indicadores · Indicativo, nao preditivo</div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-num" style={{ color: 'var(--green2)' }}>{dto.summary.green}</div><div className="kpi-label">Prontos</div></div>
        <div className="kpi"><div className="kpi-num" style={{ color: 'var(--warn)' }}>{dto.summary.amber}</div><div className="kpi-label">Precaucao</div></div>
        <div className="kpi"><div className="kpi-num" style={{ color: 'var(--danger)' }}>{dto.summary.red}</div><div className="kpi-label">Limitados</div></div>
        <div className="kpi"><div className="kpi-num" style={{ color: 'var(--text)' }}>{dto.summary.total}</div><div className="kpi-label">Total disponiveis</div></div>
      </div>

      <div className="alert alert-b" style={{ marginBottom: 16 }}>
        <div className="adot ad-b" />
        <div style={{ fontSize: 12 }}>
          <strong>Nota metodologica:</strong> O painel de prontidao sintetiza 4 indicadores de recuperacao.
          Usar como apoio a decisao, nao como substituto do julgamento clinico.
        </div>
      </div>

      <div className="card">
        <div className="ctitle">Estado do plantel - hoje</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Atleta</th>
                <th scope="col" style={{ textAlign: 'center' }}>Risco lesao</th>
                <th scope="col" style={{ textAlign: 'center' }}>Prontidao</th>
                <th scope="col">Indicadores</th>
              </tr>
            </thead>
            <tbody>
              {dto.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={withSquadParam(`/athletes/${row.id}`, squadId)} style={{ textDecoration: 'none' }}>
                      <strong>{row.name}</strong>
                      <br />
                      <span style={{ fontSize: 11, color: 'var(--text2)' }}>{row.position ?? '-'} · {row.club ?? '-'}</span>
                    </Link>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <ScoreBadge score={row.score.score} />
                    <div style={{ marginTop: 4, fontFamily: 'var(--mono)', fontSize: 10, color: STATUS_COLORS[row.scoreStatus.key] }}>
                      {row.scoreStatus.label}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div
                      style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: STATUS_COLORS[row.readiness.overall.key], lineHeight: 1 }}
                      aria-label={row.readiness.overall.ariaLabel}
                    >
                      {row.readinessScore.score}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: STATUS_COLORS[row.readiness.overall.key], marginTop: 2 }}>
                      {row.readiness.overall.label}
                    </div>
                    {row.readinessScore.confidence !== 'high' && (
                      <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>
                        {row.readinessScore.confidence === 'low' ? '⚠ dados insuf.' : '~ indicativo'}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
                      {row.readiness.indicators.map((indicator) => (
                        <div key={indicator.label} style={{ minWidth: 72, padding: '6px 8px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)' }}>{indicator.label}</div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: STATUS_COLORS[indicator.status.key] }}>{indicator.value}</div>
                          <div style={{ fontSize: 10, color: STATUS_COLORS[indicator.status.key] }}>{indicator.status.label}</div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
