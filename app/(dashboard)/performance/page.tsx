import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const METRICS = [
  { key: 'vmax',           label: 'Vmax (km/h)',      icon: '🏃', hi: 36, lo: 28 },
  { key: 'dist_max',       label: 'Dist. máx. (km)',  icon: '📏', hi: 13, lo: 7  },
  { key: 'hsr_max',        label: 'HSR máx. (m)',     icon: '⚡', hi: 2500, lo: 350 },
  { key: 'sprint_max',     label: 'Sprint máx. (m)',  icon: '💨', hi: 1100, lo: 70 },
  { key: 'n_sprints_max',  label: 'Nº sprints',       icon: '🔢', hi: 35, lo: 3  },
  { key: 'accel_max',      label: 'Acelerações',      icon: '📈', hi: 56, lo: 18 },
  { key: 'decel_max',      label: 'Desacelerações',   icon: '📉', hi: 52, lo: 16 },
  { key: 'player_load_max',label: 'Player Load',      icon: '🔋', hi: 1360, lo: 780 },
]

export default async function PerformancePage() {
  const supabase = await createClient()
  const { data: perfData } = await supabase
    .from('performance_data')
    .select(`*, athletes(id, name, position, shirt_number, club)`)
    .order('session_date', { ascending: false })

  // Latest record per athlete
  const byAthlete: Record<string, any> = {}
  ;(perfData ?? []).forEach((p: any) => {
    if (!p.athletes) return
    const id = p.athletes.id
    if (!byAthlete[id]) byAthlete[id] = { ...p, athlete: p.athletes }
  })

  const rows = Object.values(byAthlete)
    .sort((a: any, b: any) => (b.vmax ?? 0) - (a.vmax ?? 0))

  function barColor(val: number, lo: number, hi: number) {
    const pct = Math.max(0, Math.min(100, ((val - lo) / (hi - lo)) * 100))
    return pct > 75 ? 'var(--green2)' : pct > 40 ? 'var(--warn)' : 'var(--text3)'
  }

  function vmaxColor(pct: number | null) {
    if (!pct) return 'var(--text3)'
    if (pct >= 95) return 'var(--green2)'
    if (pct >= 85) return 'var(--warn)'
    if (pct >= 70) return 'var(--orange)'
    return 'var(--danger)'
  }

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">⚡ Máximos & Perfil de Performance</div>
        <div className="sec-sub">Valores de referência individuais · Base de comparação para RTP</div>
      </div>

      {rows.length === 0 ? (
        <div className="alert alert-b">
          <div className="adot ad-b" />
          <div style={{ fontSize: 12 }}>
            Sem dados de performance. Corre o seed SQL para carregar os dados da demo,
            ou importa sessões GPS reais via CSV.
          </div>
        </div>
      ) : (
        <>
          {/* Vmax% today ranking */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="ctitle">🏃 Vmax% do plantel — sessão mais recente</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12, fontFamily: 'var(--mono)' }}>
              % da velocidade máxima pessoal atingida. Critério RTP: ≥95%
            </div>
            {rows.sort((a, b) => (b.vmax_today_pct ?? 0) - (a.vmax_today_pct ?? 0)).map((r: any) => (
              <div key={r.athlete.id} className="bar-row" style={{ marginBottom: 9 }}>
                <div className="bar-name" style={{ width: 160 }}>
                  <Link href={`/athlete?id=${r.athlete.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {r.athlete.name}{' '}
                    <span style={{ color: 'var(--text3)', fontSize: 10 }}>({r.athlete.position})</span>
                  </Link>
                </div>
                <div className="bar-track" style={{ position: 'relative' }}>
                  <div className="bar-fill" style={{ width: `${r.vmax_today_pct ?? 0}%`, background: vmaxColor(r.vmax_today_pct) }} />
                  <div style={{ position: 'absolute', left: '95%', top: 0, bottom: 0, width: 1, background: 'var(--green2)', opacity: 0.4 }} />
                </div>
                <div className="bar-val" style={{ color: vmaxColor(r.vmax_today_pct) }}>
                  {r.vmax_today_pct ?? '—'}%
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, width: 60, textAlign: 'right', color: vmaxColor(r.vmax_today_pct) }}>
                  {r.vmax ? `${((r.vmax ?? 0) * (r.vmax_today_pct ?? 0) / 100).toFixed(1)} km/h` : '—'}
                </div>
              </div>
            ))}
          </div>

          {/* Full table */}
          <div className="card">
            <div className="ctitle">Tabela completa de máximos</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Atleta</th>
                    {METRICS.map(m => <th key={m.key} style={{ textAlign: 'center' }}>{m.icon} {m.label}</th>)}
                    <th style={{ textAlign: 'center' }}>Vmax hoje</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.athlete.id}>
                      <td>
                        <Link href={`/athlete?id=${r.athlete.id}`} style={{ textDecoration: 'none' }}>
                          <strong>{r.athlete.name}</strong>
                          <br /><span style={{ fontSize: 10, color: 'var(--text2)' }}>{r.athlete.position}</span>
                        </Link>
                      </td>
                      {METRICS.map(m => (
                        <td key={m.key} style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 500 }}>
                          {r[m.key] ?? '—'}
                        </td>
                      ))}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: vmaxColor(r.vmax_today_pct) }}>
                            {r.vmax_today_pct ?? '—'}%
                          </span>
                          {r.vmax_today_pct && (
                            <div style={{ width: 56, height: 3, background: 'var(--bg4)', borderRadius: 2 }}>
                              <div style={{ width: `${r.vmax_today_pct}%`, height: 3, background: vmaxColor(r.vmax_today_pct), borderRadius: 2 }} />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
