'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RehabSession, RehabProtocol, RtpCriterion } from '@/types'
import { AlertBox } from '@/components/ui/aura'

function phaseColor(phaseIndex: number): string {
  const colors = ['#ff4d6d', '#ffb347', '#4d9aff', '#00e5a0']
  return colors[phaseIndex] ?? '#7a8399'
}

export default function RehabPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      .from('rehab_sessions')
      .select(`*, athletes(*), rehab_protocols(*)`)
      .eq('athletes.active', true)
    setSessions(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleRTP(sessionId: string, idx: number, criteria: RtpCriterion[]) {
    const updated = criteria.map((c, i) => i === idx ? { ...c, done: !c.done } : c)
    await supabase.from('rehab_sessions')
      .update({ rtp_criteria: updated, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
    load()
  }

  async function updateClinical(sessionId: string, field: string, value: any, clinicalData: any) {
    const updated = { ...clinicalData, [field]: value }
    await supabase.from('rehab_sessions')
      .update({ clinical_data: updated, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
    load()
  }

  if (loading) return (
    <div className="loading"><div className="spinner" /><span>A carregar protocolos...</span></div>
  )

  if (sessions.length === 0) return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">🦴 Reabilitação activa</div>
      </div>
      <div className="empty-state">
        <h3>Sem atletas em reabilitação</h3>
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>Todos os atletas estão disponíveis.</p>
      </div>
    </div>
  )

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">🦴 Reabilitação activa</div>
        <div className="sec-sub">
          {sessions.length} atleta{sessions.length > 1 ? 's' : ''} em protocolo · RTP adaptativo
        </div>
      </div>

      {sessions.map((session: any) => {
        const protocol: RehabProtocol = session.rehab_protocols
        const athlete = session.athletes
        const rtp: RtpCriterion[] = session.rtp_criteria ?? []
        const clinical = session.clinical_data ?? {}
        const phases: any[] = protocol?.phases ?? []
        const currentPhase = phases.find((p: any) => session.current_day >= p.d1 && session.current_day <= p.d2)
          ?? phases[phases.length - 1]
        const rtpDone = rtp.filter(r => r.done).length
        const phasePct = currentPhase
          ? Math.round(((session.current_day - currentPhase.d1) / (currentPhase.d2 - currentPhase.d1 + 1)) * 100)
          : 0
        const isHamstring = protocol?.key === 'hamstring'
        const isAnkle = protocol?.key === 'ankle'

        return (
          <div key={session.id} className="card" style={{ marginBottom: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{athlete?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                  {protocol?.name} · Dia {session.current_day}/{protocol?.total_days}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {protocol?.evidence}
                </div>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--mono)',
                background: 'var(--blue2)', color: 'var(--blue)', border: '1px solid rgba(77,154,255,0.25)',
              }}>
                {athlete?.position} · {athlete?.club}
              </div>
            </div>

            {/* Phase timeline */}
            <div className="ctitle">Protocolo — fases</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto' }}>
              {phases.map((phase: any, i: number) => {
                const isDone = session.current_day > phase.d2
                const isActive = session.current_day >= phase.d1 && session.current_day <= phase.d2
                return (
                  <div key={i} style={{
                    flex: '0 0 auto', padding: '10px 14px', borderRadius: 8,
                    border: `1px solid ${isActive ? phase.color : 'var(--border)'}`,
                    background: isActive ? `${phase.color}15` : 'var(--bg3)',
                    minWidth: 140,
                  }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 3 }}>
                      {phase.range}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isDone ? 'var(--green2)' : isActive ? phase.color : 'var(--text3)' }}>
                      {isDone ? '✓ ' : ''}{phase.name}
                    </div>
                    {isActive && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ height: 3, background: 'var(--bg5)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${phasePct}%`, height: 3, background: phase.color, borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                          Dia {session.current_day} — {phasePct}% da fase
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="g2">
              {/* Exercises */}
              {currentPhase && (
                <div>
                  <div className="ctitle">Exercícios prescritos — {currentPhase.name}</div>
                  {currentPhase.ex.map((ex: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text2)', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      • {ex}
                    </div>
                  ))}
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
                    Critério de progressão: {currentPhase.criteria}
                  </div>
                </div>
              )}

              {/* RTP criteria */}
              <div>
                <div className="ctitle">Critérios de RTP ({rtpDone}/{rtp.length})</div>
                {rtp.map((r, i) => (
                  <div key={i} className="rtp-item">
                    <div
                      className={`rtp-check${r.done ? ' done' : ''}`}
                      onClick={() => toggleRTP(session.id, i, rtp)}
                    />
                    <div style={{ color: r.done ? 'var(--green2)' : 'var(--text2)' }}>{r.label}</div>
                  </div>
                ))}
                <div style={{ marginTop: 10, height: 5, background: 'var(--bg5)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((rtpDone / Math.max(rtp.length, 1)) * 100)}%`, height: 5, background: 'var(--green2)', borderRadius: 3, transition: 'width .3s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5 }}>
                  {rtpDone} de {rtp.length} critérios cumpridos
                </div>
              </div>
            </div>

            {/* Clinical input */}
            <div style={{ marginTop: 14 }}>
              <div className="ctitle">Avaliação clínica</div>
              <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {/* EVA */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text2)' }}>Dor (EVA 0-10)</span>
                      <span style={{
                        fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                        color: (clinical.pain_vas ?? 5) <= 2 ? 'var(--green2)' : (clinical.pain_vas ?? 5) <= 5 ? 'var(--warn)' : 'var(--danger)',
                      }}>
                        {clinical.pain_vas ?? '—'}/10
                      </span>
                    </div>
                    <input
                      type="range" min={0} max={10} step={1}
                      value={clinical.pain_vas ?? 5}
                      onChange={e => updateClinical(session.id, 'pain_vas', parseInt(e.target.value), clinical)}
                      style={{ width: '100%', accentColor: 'var(--green2)' }}
                    />
                  </div>

                  {/* Hamstring specific */}
                  {isHamstring && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>Força exc. (%)</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {[60, 70, 80, 90, 100].map(v => (
                          <button
                            key={v}
                            data-aid={session.id}
                            onClick={() => updateClinical(session.id, 'strength_pct', v, clinical)}
                            style={{
                              padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                              fontFamily: 'var(--mono)', fontSize: 10,
                              border: `1px solid ${clinical.strength_pct === v ? 'var(--green2)' : 'var(--border)'}`,
                              background: clinical.strength_pct === v ? 'var(--green3)' : 'var(--bg4)',
                              color: clinical.strength_pct === v ? 'var(--green2)' : 'var(--text2)',
                            }}
                          >{v}%</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {isHamstring && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>Askling H-test</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[{ v: false, label: '+ Positivo' }, { v: true, label: '- Negativo' }].map(opt => (
                          <button
                            key={String(opt.v)}
                            onClick={() => updateClinical(session.id, 'test_ok', opt.v, clinical)}
                            style={{
                              flex: 1, padding: 6, borderRadius: 6, fontSize: 11, cursor: 'pointer',
                              border: `1px solid ${clinical.test_ok === opt.v ? (opt.v ? 'var(--green2)' : 'var(--danger)') : 'var(--border)'}`,
                              background: clinical.test_ok === opt.v ? (opt.v ? 'var(--green3)' : 'var(--danger2)') : 'var(--bg4)',
                              color: clinical.test_ok === opt.v ? (opt.v ? 'var(--green2)' : 'var(--danger)') : 'var(--text2)',
                            }}
                          >{opt.label}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {isAnkle && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>Equilíbrio (s)</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {[10, 15, 20, 25, 30].map(v => (
                          <button
                            key={v}
                            onClick={() => updateClinical(session.id, 'balance_s', v, clinical)}
                            style={{
                              padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                              fontFamily: 'var(--mono)', fontSize: 10,
                              border: `1px solid ${clinical.balance_s === v ? 'var(--green2)' : 'var(--border)'}`,
                              background: clinical.balance_s === v ? 'var(--green3)' : 'var(--bg4)',
                              color: clinical.balance_s === v ? 'var(--green2)' : 'var(--text2)',
                            }}
                          >{v}s</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {isAnkle && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>Hop test (%)</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {[70, 75, 80, 85, 90, 95].map(v => (
                          <button
                            key={v}
                            onClick={() => updateClinical(session.id, 'hop_pct', v, clinical)}
                            style={{
                              padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                              fontFamily: 'var(--mono)', fontSize: 10,
                              border: `1px solid ${clinical.hop_pct === v ? 'var(--green2)' : 'var(--border)'}`,
                              background: clinical.hop_pct === v ? 'var(--green3)' : 'var(--bg4)',
                              color: clinical.hop_pct === v ? 'var(--green2)' : 'var(--text2)',
                            }}
                          >{v}%</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
