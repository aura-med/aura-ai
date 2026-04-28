'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSquadIdParam } from '@/lib/squad-url'

export default function PassportPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /><span>A carregar passaportes...</span></div>}>
      <PassportContent />
    </Suspense>
  )
}

function PassportContent() {
  const searchParams = useSearchParams()
  const squadId = getSquadIdParam(searchParams)
  const [athletes, setAthletes] = useState<any[]>([])
  const [selected, setSelected] = useState<string>('')
  const [shared, setShared] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    let query = supabase.from('athletes')
      .select(`*, injury_events(*), performance_data(*), athlete_passport(*), fatigue_profiles(*)`)
      .eq('active', true).order('shirt_number')

    if (squadId) query = query.eq('squad_id', squadId)

    query.then(({ data }) => {
        setAthletes(data ?? [])
        setSelected(data?.[0]?.id ?? '')
        setLoading(false)
      })
  }, [squadId])

  async function toggleShare(athleteId: string, current: boolean) {
    const passport = athletes.find(a => a.id === athleteId)?.athlete_passport?.[0]
    if (!passport) return
    await supabase.from('athlete_passport')
      .update({ is_shareable: !current, last_updated: new Date().toISOString() })
      .eq('athlete_id', athleteId)
    setShared(s => ({ ...s, [athleteId]: !current }))
  }

  if (loading) return <div className="loading"><div className="spinner" /><span>A carregar passaportes...</span></div>

  const athlete = athletes.find(a => a.id === selected)
  const passport = athlete?.athlete_passport?.[0]
  const perf = athlete?.performance_data?.[0]
  const profile = athlete?.fatigue_profiles?.[0]
  const injuries = (athlete?.injury_events ?? []).sort((a: any, b: any) =>
    new Date(b.injury_date).getTime() - new Date(a.injury_date).getTime()
  )
  const isShareable = passport?.is_shareable ?? shared[selected] ?? false
  const isShared = shared[selected] ?? false

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700 }}>🪪 Passaporte do Atleta</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Perfil clínico e de performance portátil · Segue o atleta ao longo da carreira</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <select value={selected} onChange={e => setSelected(e.target.value)}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontFamily: 'var(--body)', fontSize: 13, cursor: 'pointer', outline: 'none' }}>
            {athletes.map(a => <option key={a.id} value={a.id}>{a.shirt_number}. {a.name}</option>)}
          </select>
        </div>
      </div>

      {athlete && (
        <div className="g2">
          {/* Left: passport card */}
          <div>
            <div className="card" style={{ marginBottom: 12, borderColor: isShareable ? 'rgba(0,229,160,0.3)' : 'var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 900 }}>{athlete.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                    {athlete.position} · {athlete.club}
                  </div>
                </div>
                <button onClick={() => toggleShare(athlete.id, isShareable)}
                  style={{ padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontFamily: 'var(--mono)', border: `1px solid ${isShareable ? 'var(--green2)' : 'var(--border)'}`, background: isShareable ? 'var(--green3)' : 'var(--bg3)', color: isShareable ? 'var(--green2)' : 'var(--text2)' }}>
                  {isShareable ? '🔓 Portátil' : '🔒 Privado'}
                </button>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'VMAX REF.', value: perf?.vmax ? `${perf.vmax} km/h` : '—', color: 'var(--blue)' },
                  { label: 'HRV BASELINE', value: passport?.passport_data?.hrv_baseline_ms ? `${passport.passport_data.hrv_baseline_ms} ms` : '—', color: 'var(--purple)' },
                  { label: 'LESÕES HIST.', value: injuries.length.toString(), color: injuries.length > 1 ? 'var(--warn)' : 'var(--green2)' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)', marginBottom: 3 }}>{stat.label}</div>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Injury history */}
              <div className="slabel" style={{ marginBottom: 8 }}>Historial de lesões (carreira)</div>
              {injuries.length === 0 ? (
                <div className="alert alert-g"><div className="adot ad-g" /><div style={{ fontSize: 12 }}>Sem lesões registadas</div></div>
              ) : (
                injuries.slice(0, 5).map((inj: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    <div style={{ width: 80, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>
                      {new Date(inj.injury_date).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })}
                    </div>
                    <div style={{ color: inj.return_date ? 'var(--text2)' : 'var(--danger)' }}>
                      {inj.diagnosis}
                      {inj.days_absent ? ` — ${inj.days_absent} dias` : ' — ACTIVO'}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Fatigue profile */}
            {profile && (
              <div className="card">
                <div className="ctitle">Perfil de carga individual</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'RECUPERAÇÃO', val: profile.recovery_speed, good: profile.recovery_speed >= 1.0, desc: profile.recovery_speed >= 1.1 ? 'Rápida' : profile.recovery_speed >= 0.9 ? 'Média' : 'Lenta' },
                    { label: 'SENSIB. CONG.', val: profile.congestion_sensitivity, good: profile.congestion_sensitivity <= 1.0, desc: profile.congestion_sensitivity <= 0.9 ? 'Baixa' : profile.congestion_sensitivity <= 1.1 ? 'Média' : 'Alta' },
                  ].map(p => (
                    <div key={p.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>{p.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: p.good ? 'var(--green2)' : 'var(--danger)' }}>{p.desc}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>{p.val.toFixed(2)}x</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: sharing simulation */}
          <div>
            <div className="card">
              <div className="ctitle">Simulação — Novo clube recebe passaporte</div>
              <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, marginBottom: 10 }}>
                  CENÁRIO: TRANSFERÊNCIA PARA CLUBE CLIENTE AURA
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>🏟️</div>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{athlete.club}</div><div style={{ fontSize: 11, color: 'var(--text2)' }}>Clube actual</div></div>
                  <div style={{ fontSize: 20, color: 'var(--text3)' }}>→</div>
                  <div style={{ fontSize: 24 }}>🏟️</div>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>Novo Clube</div><div style={{ fontSize: 11, color: 'var(--text2)' }}>Cliente Aura</div></div>
                </div>
                <button onClick={() => setShared(s => ({ ...s, [selected]: !isShared }))}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', marginBottom: 10, cursor: 'pointer', fontWeight: 600, background: isShared ? 'var(--green2)' : 'var(--bg4)', color: isShared ? '#000' : 'var(--text2)', fontSize: 13 }}>
                  {isShared ? '✓ Passaporte partilhado' : 'Partilhar passaporte'}
                </button>

                {isShared ? (
                  <div style={{ background: 'var(--green4)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--green2)', letterSpacing: 1.5, marginBottom: 8 }}>NOVO CLUBE RECEBE:</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
                      ✓ Historial completo de lesões ({injuries.length} episódios)<br />
                      {perf?.vmax && <>✓ Vmax de referência: {perf.vmax} km/h<br /></>}
                      {passport?.passport_data?.hrv_baseline_ms && <>✓ HRV baseline: {passport.passport_data.hrv_baseline_ms} ms<br /></>}
                      {profile && <>✓ Perfil de recuperação calibrado<br /></>}
                      ✓ Verificado pela FPF
                    </div>
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,229,160,0.15)', fontSize: 11, color: 'var(--text3)' }}>
                      Tempo de onboarding: 0 dias. Baseline imediato.
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'var(--bg4)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text3)' }}>
                    Sem Aura: o novo clube começa do zero. Nenhum historial, nenhum baseline.
                  </div>
                )}
              </div>

              {/* Passport notes */}
              {passport?.passport_data?.notes && (
                <div className="alert alert-w">
                  <div className="adot ad-w" />
                  <div style={{ fontSize: 12 }}>{passport.passport_data.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
