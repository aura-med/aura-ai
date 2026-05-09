'use client'

import { useMemo, useState, useTransition } from 'react'
import { updatePassportShare } from '@/lib/data/actions'
import type { PassportPageDTO } from '@/lib/data/types'

export function PassportClient({ dto }: { dto: PassportPageDTO }) {
  const [selected, setSelected] = useState(dto.selectedAthleteId ?? '')
  const [shared, setShared] = useState<Record<string, boolean>>({})
  const [isPending, startTransition] = useTransition()
  const athlete = useMemo(
    () => dto.athletes.find((item) => item.id === selected) ?? dto.athletes[0],
    [dto.athletes, selected]
  )

  function handleShare(athleteId: string, current: boolean) {
    startTransition(async () => {
      const next = !current
      await updatePassportShare(athleteId, next)
      setShared((state) => ({ ...state, [athleteId]: next }))
    })
  }

  if (!athlete) {
    return (
      <div>
        <div className="sec-hdr">
          <div className="sec-title">Passaporte do Atleta</div>
          <div className="sec-sub">Sem atletas disponiveis para o filtro atual</div>
        </div>
        <div className="empty-state">
          <h3>Sem passaportes</h3>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>Escolha outro plantel.</p>
        </div>
      </div>
    )
  }

  const isShareable = shared[athlete.id] ?? athlete.isShareable
  const isShared = shared[athlete.id] ?? false

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700 }}>Passaporte do Atleta</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Perfil clinico e de performance portatil</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <label className="sr-only" htmlFor="passport-athlete">Atleta</label>
          <select
            id="passport-athlete"
            value={athlete.id}
            onChange={(e) => setSelected(e.target.value)}
            style={{ minHeight: 38, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontFamily: 'var(--body)', fontSize: 13, cursor: 'pointer', outline: 'none' }}
          >
            {dto.athletes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
      </div>

      <div className="g2">
        <div>
          <div className="card" style={{ marginBottom: 12, borderColor: isShareable ? 'rgba(0,229,160,0.3)' : 'var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 900 }}>{athlete.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                  {athlete.position ?? '-'} · {athlete.club ?? '-'}
                </div>
              </div>
              <button
                onClick={() => handleShare(athlete.id, isShareable)}
                disabled={isPending}
                aria-pressed={isShareable}
                style={{ minHeight: 40, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontFamily: 'var(--mono)', border: `1px solid ${isShareable ? 'var(--green2)' : 'var(--border)'}`, background: isShareable ? 'var(--green3)' : 'var(--bg3)', color: isShareable ? 'var(--green2)' : 'var(--text2)' }}
              >
                {isPending ? 'A atualizar...' : isShareable ? 'Portatil' : 'Privado'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'VMAX REF.', value: athlete.performance.vmax ? `${athlete.performance.vmax} km/h` : '-', color: 'var(--blue)' },
                { label: 'HRV BASELINE', value: athlete.passport.hrvBaselineMs ? `${athlete.passport.hrvBaselineMs} ms` : '-', color: 'var(--purple)' },
                { label: 'LESOES HIST.', value: athlete.injuries.length.toString(), color: athlete.injuries.length > 1 ? 'var(--warn)' : 'var(--green2)' },
              ].map((stat) => (
                <div key={stat.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', marginBottom: 3 }}>{stat.label}</div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="slabel" style={{ marginBottom: 8 }}>Historial de lesoes</div>
            {athlete.injuries.length === 0 ? (
              <div className="alert alert-g"><div className="adot ad-g" /><div style={{ fontSize: 12 }}>Sem lesoes registadas</div></div>
            ) : (
              athlete.injuries.slice(0, 5).map((injury) => (
                <div key={injury.id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <div style={{ width: 80, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>
                    {new Date(injury.injuryDate).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })}
                  </div>
                  <div>
                    <span style={{ color: injury.status.key === 'red' ? 'var(--danger)' : 'var(--text2)' }}>
                      {injury.diagnosis ?? 'Lesao nao especificada'}
                      {injury.daysAbsent ? ` - ${injury.daysAbsent} dias` : injury.returnDate ? '' : ' - ATIVA'}
                    </span>
                    <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-mono" style={{ background: 'var(--bg3)', color: injury.status.key === 'red' ? 'var(--danger)' : 'var(--green2)' }}>
                      {injury.status.label}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {athlete.fatigueProfile && (
            <div className="card">
              <div className="ctitle">Perfil de carga individual</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'RECUPERACAO', val: athlete.fatigueProfile.recoverySpeed, good: (athlete.fatigueProfile.recoverySpeed ?? 1) >= 1.0, desc: (athlete.fatigueProfile.recoverySpeed ?? 1) >= 1.1 ? 'Rapida' : (athlete.fatigueProfile.recoverySpeed ?? 1) >= 0.9 ? 'Media' : 'Lenta' },
                  { label: 'SENSIB. CONG.', val: athlete.fatigueProfile.congestionSensitivity, good: (athlete.fatigueProfile.congestionSensitivity ?? 1) <= 1.0, desc: (athlete.fatigueProfile.congestionSensitivity ?? 1) <= 0.9 ? 'Baixa' : (athlete.fatigueProfile.congestionSensitivity ?? 1) <= 1.1 ? 'Media' : 'Alta' },
                ].map((profile) => (
                  <div key={profile.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>{profile.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: profile.good ? 'var(--green2)' : 'var(--danger)' }}>{profile.desc}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>{profile.val?.toFixed(2) ?? '-'}x</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <div className="ctitle">Simulacao - Novo clube recebe passaporte</div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, marginBottom: 10 }}>
                CENARIO: TRANSFERENCIA PARA CLUBE CLIENTE AURA
              </div>
              <button
                onClick={() => setShared((state) => ({ ...state, [athlete.id]: !isShared }))}
                style={{ width: '100%', minHeight: 42, padding: 10, borderRadius: 8, border: 'none', marginBottom: 10, cursor: 'pointer', fontWeight: 600, background: isShared ? 'var(--green2)' : 'var(--bg4)', color: isShared ? '#000' : 'var(--text2)', fontSize: 13 }}
              >
                {isShared ? 'Passaporte partilhado' : 'Partilhar passaporte'}
              </button>

              {isShared ? (
                <div style={{ background: 'var(--green4)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--green2)', letterSpacing: 1.5, marginBottom: 8 }}>NOVO CLUBE RECEBE:</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
                    Historial completo de lesoes ({athlete.injuries.length} episodios)<br />
                    {athlete.performance.vmax && <>Vmax de referencia: {athlete.performance.vmax} km/h<br /></>}
                    {athlete.passport.hrvBaselineMs && <>HRV baseline: {athlete.passport.hrvBaselineMs} ms<br /></>}
                    {athlete.fatigueProfile && <>Perfil de recuperacao calibrado<br /></>}
                    Verificado pela FPF
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--bg4)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text3)' }}>
                  Sem Aura: o novo clube comeca do zero. Nenhum historial, nenhum baseline.
                </div>
              )}
            </div>

            {athlete.passport.notes && (
              <div className="alert alert-w">
                <div className="adot ad-w" />
                <div style={{ fontSize: 12 }}>{athlete.passport.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
