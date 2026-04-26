'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcScore, riskColor, projectScore } from '@/lib/scoring'
import type { CalendarSnapshot } from '@/types'

const TYPE_ICONS: Record<string, string>  = { match: '⚽', training: '🏃', rest: '😴', travel: '✈️' }
const TYPE_COLORS: Record<string, string> = { match: 'var(--danger)', training: 'var(--blue)', rest: 'var(--green2)', travel: 'var(--warn)' }
const INT_COLORS: Record<string, string>  = { max: 'var(--danger)', high: 'var(--orange)', medium: 'var(--warn)', low: 'var(--green2)' }
const TYPES = ['rest', 'training', 'match']
const INTENSITIES = ['low', 'medium', 'high', 'max']

export default function CalendarPage() {
  const [athletes, setAthletes] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [snapshots, setSnapshots] = useState<CalendarSnapshot[]>([])

  useEffect(() => {
    Promise.all([
      supabase.from('athletes').select(`*, wellness_checkins(*), injury_events(*), fatigue_profiles(*)`).eq('active', true).eq('status', 'available').order('shirt_number'),
      supabase.from('calendar_events').select('*').order('event_date'),
    ]).then(([{ data: aths }, { data: evs }]) => {
      const a = aths ?? []
      setAthletes(a)
      if (a[0]) setSelectedId(a[0].id)
      setEvents(evs ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const athlete = athletes.find(a => a.id === selectedId)
    if (!athlete) return
    const latest = (athlete.wellness_checkins ?? [])
      .sort((a: any, b: any) => new Date(b.checkin_date).getTime() - new Date(a.checkin_date).getTime())[0]
    const inputs = {
      history: (athlete.injury_events ?? []).length >= 2 ? 2 : (athlete.injury_events ?? []).length >= 1 ? 1 : 0,
      acwr: null, hrv: null, fatigue: latest?.fatigue ?? null, sleep: latest?.sleep_hours ?? null,
      tqr: latest?.tqr ?? null, stress: latest?.stress ?? null, decel: null, md: null,
    }
    const currentScore = calcScore(inputs).score
    const profile = athlete.fatigue_profiles?.[0]
    setSnapshots(projectScore(currentScore, events, profile))
  }, [selectedId, athletes, events])

  function changeEvent(idx: number, dir: 'prev' | 'next') {
    setEvents(prev => prev.map((ev, i) => {
      if (i !== idx) return ev
      const ev2 = { ...ev }
      if (dir === 'next') {
        if (ev2.event_type === 'training') {
          const iIdx = INTENSITIES.indexOf(ev2.intensity ?? 'low')
          if (iIdx < INTENSITIES.length - 1) ev2.intensity = INTENSITIES[iIdx + 1]
          else { ev2.event_type = 'match'; ev2.intensity = 'max'; ev2.label = 'Jogo' }
        } else if (ev2.event_type === 'match') {
          ev2.event_type = 'rest'; ev2.intensity = 'low'; ev2.label = 'Repouso'
        } else {
          ev2.event_type = 'training'; ev2.intensity = 'low'; ev2.label = 'Treino leve'
        }
      } else {
        if (ev2.event_type === 'rest') {
          ev2.event_type = 'match'; ev2.intensity = 'max'; ev2.label = 'Jogo'
        } else if (ev2.event_type === 'match') {
          ev2.event_type = 'training'; ev2.intensity = 'max'; ev2.label = 'Treino max'
        } else {
          const iIdx = INTENSITIES.indexOf(ev2.intensity ?? 'medium')
          if (iIdx > 0) { ev2.intensity = INTENSITIES[iIdx - 1]; ev2.label = 'Treino ' + INTENSITIES[iIdx - 1] }
          else { ev2.event_type = 'rest'; ev2.intensity = 'low'; ev2.label = 'Repouso' }
        }
      }
      return ev2
    }))
  }

  if (loading) return <div className="loading"><div className="spinner" /><span>A carregar calendário...</span></div>

  const athlete = athletes.find(a => a.id === selectedId)
  const profile = athlete?.fatigue_profiles?.[0]
  const currentScore = snapshots[0]?.post ?? 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700 }}>📅 Calendar Intelligence</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Score projectado · Simula o impacto das decisões de carga</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontFamily: 'var(--body)', fontSize: 13, cursor: 'pointer', outline: 'none' }}>
            {athletes.map(a => <option key={a.id} value={a.id}>{a.shirt_number}. {a.name}</option>)}
          </select>
        </div>
      </div>

      {/* Fatigue profile */}
      {profile && (
        <div className="g2" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="ctitle">Perfil de recuperação — {athlete?.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'VEL. RECUPERAÇÃO', val: `${profile.recovery_speed.toFixed(2)}x`, col: profile.recovery_speed >= 1.1 ? 'var(--green2)' : profile.recovery_speed >= 0.9 ? 'var(--warn)' : 'var(--danger)' },
                { label: 'SENS. CONG.', val: `${profile.congestion_sensitivity.toFixed(2)}x`, col: profile.congestion_sensitivity <= 0.9 ? 'var(--green2)' : profile.congestion_sensitivity <= 1.1 ? 'var(--warn)' : 'var(--danger)' },
                { label: 'QUEDA MD+1', val: `-${profile.typical_md1_drop}pp`, col: 'var(--danger)' },
                { label: 'QUEDA MD+2', val: `-${profile.typical_md2_drop}pp`, col: 'var(--warn)' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)', marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700, color: s.col }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="card">
            <div className="ctitle">Score projectado — próximos {events.length} dias</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, marginBottom: 8, padding: '0 4px' }}>
              {snapshots.map((snap, i) => {
                const isMatch = i > 0 && events[i - 1]?.event_type === 'match'
                const s = isMatch ? snap.pre : snap.post
                const col = riskColor(s)
                const h = Math.round((s / 100) * 70)
                const label = i === 0 ? 'Hoje' : `D+${i}`
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 600, color: col }}>{s}</div>
                    <div style={{ width: '100%', height: h, background: col, borderRadius: '2px 2px 0 0', opacity: isMatch ? 1 : 0.7, position: 'relative' }}>
                      {isMatch && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 10 }}>⚽</div>}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)' }}>{label}</div>
                  </div>
                )
              })}
            </div>
            <div className="alert alert-b" style={{ marginBottom: 0 }}>
              <div className="adot ad-b" />
              <div style={{ fontSize: 12 }}>
                Usa os botões <strong>◀ ▶</strong> em cada dia do calendário para mudar o tipo de sessão.
                O gráfico actualiza em tempo real.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 16 }}>
        {events.map((ev, idx) => {
          const snap = snapshots[idx + 1] ?? { pre: currentScore, post: currentScore }
          const isMatch = ev.event_type === 'match'
          const displayScore = isMatch ? snap.pre : snap.post
          const scoreCol = riskColor(displayScore)
          const tCol = TYPE_COLORS[ev.event_type ?? 'rest'] ?? 'var(--text2)'

          return (
            <div key={ev.id ?? idx} style={{
              background: 'var(--bg3)', borderRadius: 8, padding: '12px 10px', position: 'relative',
              border: isMatch ? '2px solid rgba(255,77,109,0.5)' : '1px solid var(--border)',
            }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', marginBottom: 6 }}>
                D+{idx + 1}
              </div>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{TYPE_ICONS[ev.event_type ?? 'rest'] ?? '•'}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: tCol, marginBottom: 3 }}>{ev.label ?? ev.event_type}</div>
              {ev.intensity && <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: INT_COLORS[ev.intensity] ?? 'var(--text2)' }}>{ev.intensity.toUpperCase()}</div>}

              <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)', marginBottom: 1 }}>
                  {isMatch ? 'Risco entrada' : 'Score proj.'}
                </div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700, color: scoreCol }}>{displayScore}%</div>
                {isMatch && (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)', marginTop: 4 }}>
                    Pós-jogo: <span style={{ color: riskColor(snap.post) }}>{snap.post}%</span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 3 }}>
                {(['prev', 'next'] as const).map(dir => (
                  <button key={dir} onClick={() => changeEvent(idx, dir)}
                    style={{ width: 16, height: 16, background: 'var(--bg4)', border: 'none', borderRadius: 3, color: 'var(--text3)', fontSize: 9, cursor: 'pointer' }}>
                    {dir === 'prev' ? '◀' : '▶'}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Squad table */}
      <div className="card">
        <div className="ctitle">Impacto no plantel completo</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Atleta</th>
                <th style={{ textAlign: 'center' }}>Agora</th>
                <th style={{ textAlign: 'center' }}>Jogo 1</th>
                <th style={{ textAlign: 'center' }}>Jogo 2</th>
                <th style={{ textAlign: 'center' }}>Final</th>
                <th style={{ textAlign: 'center' }}>Tendência</th>
              </tr>
            </thead>
            <tbody>
              {athletes.slice(0, 10).map(a => {
                const latest = (a.wellness_checkins ?? []).sort((x: any, y: any) => new Date(y.checkin_date).getTime() - new Date(x.checkin_date).getTime())[0]
                const inputs = {
                  history: (a.injury_events ?? []).length >= 2 ? 2 : (a.injury_events ?? []).length >= 1 ? 1 : 0,
                  acwr: null, hrv: null, fatigue: latest?.fatigue ?? null, sleep: latest?.sleep_hours ?? null,
                  tqr: latest?.tqr ?? null, stress: latest?.stress ?? null, decel: null, md: null,
                }
                const current = calcScore(inputs).score
                const ps = projectScore(current, events, a.fatigue_profiles?.[0])
                const s0 = ps[0].post
                const s4 = ps[Math.min(4, ps.length - 1)].post
                const s11 = ps[Math.min(11, ps.length - 1)].post
                const sLast = ps[ps.length - 1].post
                const trend = sLast > s0 + 10 ? '↑ Sobe' : sLast < s0 - 5 ? '↓ Melhora' : '→ Estável'
                const tCol = sLast > s0 + 10 ? 'var(--danger)' : sLast < s0 - 5 ? 'var(--green2)' : 'var(--warn)'

                return (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong> <span style={{ fontSize: 10, color: 'var(--text3)' }}>({a.position})</span></td>
                    {[s0, s4, s11, sLast].map((s, i) => (
                      <td key={i} style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: riskColor(s) }}>{s}%</td>
                    ))}
                    <td style={{ textAlign: 'center', fontSize: 12, color: tCol }}>{trend}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
