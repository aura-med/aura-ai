'use client'

import { useMemo, useState } from 'react'
import { projectScore, riskColor } from '@/lib/scoring'
import type { CalendarEvent, CalendarSnapshot } from '@/types'
import type { CalendarPageDTO } from '@/lib/data/types'

const TYPE_LABELS: Record<string, string> = { match: 'Jogo', training: 'Treino', rest: 'Repouso', travel: 'Viagem' }
const TYPE_COLORS: Record<string, string> = { match: 'var(--danger)', training: 'var(--blue)', rest: 'var(--green2)', travel: 'var(--warn)' }
const INT_COLORS: Record<string, string> = { max: 'var(--danger)', high: 'var(--orange)', medium: 'var(--warn)', low: 'var(--green2)' }
const INTENSITIES = ['low', 'medium', 'high', 'max'] as const

function nextEvent(ev: CalendarEvent, dir: 'prev' | 'next'): CalendarEvent {
  const next = { ...ev }
  if (dir === 'next') {
    if (next.event_type === 'training') {
      const iIdx = INTENSITIES.indexOf((next.intensity ?? 'low') as typeof INTENSITIES[number])
      if (iIdx < INTENSITIES.length - 1) next.intensity = INTENSITIES[iIdx + 1]
      else { next.event_type = 'match'; next.intensity = 'max'; next.label = 'Jogo' }
    } else if (next.event_type === 'match') {
      next.event_type = 'rest'; next.intensity = 'low'; next.label = 'Repouso'
    } else {
      next.event_type = 'training'; next.intensity = 'low'; next.label = 'Treino leve'
    }
  } else if (next.event_type === 'rest') {
    next.event_type = 'match'; next.intensity = 'max'; next.label = 'Jogo'
  } else if (next.event_type === 'match') {
    next.event_type = 'training'; next.intensity = 'max'; next.label = 'Treino max'
  } else {
    const iIdx = INTENSITIES.indexOf((next.intensity ?? 'medium') as typeof INTENSITIES[number])
    if (iIdx > 0) { next.intensity = INTENSITIES[iIdx - 1]; next.label = `Treino ${INTENSITIES[iIdx - 1]}` }
    else { next.event_type = 'rest'; next.intensity = 'low'; next.label = 'Repouso' }
  }
  return next
}

function projectionProfile(profile: CalendarPageDTO['athletes'][number]['profile']) {
  if (!profile) return {}
  return {
    recovery_speed: profile.recovery_speed ?? undefined,
    congestion_sensitivity: profile.congestion_sensitivity ?? undefined,
    typical_md1_drop: profile.typical_md1_drop ?? undefined,
    typical_md2_drop: profile.typical_md2_drop ?? undefined,
  }
}

export function CalendarClient({ dto }: { dto: CalendarPageDTO }) {
  const [selectedId, setSelectedId] = useState(dto.athletes[0]?.id ?? '')
  const [events, setEvents] = useState(dto.events)
  const athlete = dto.athletes.find((item) => item.id === selectedId) ?? dto.athletes[0]
  const snapshots: CalendarSnapshot[] = useMemo(
    () => athlete ? projectScore(athlete.currentScore, events, projectionProfile(athlete.profile)) : [],
    [athlete, events]
  )
  const currentScore = snapshots[0]?.post ?? athlete?.currentScore ?? 0

  function changeEvent(idx: number, dir: 'prev' | 'next') {
    setEvents((prev) => prev.map((ev, i) => i === idx ? nextEvent(ev, dir) : ev))
  }

  if (!athlete) {
    return (
      <div>
        <div className="sec-hdr">
          <div className="sec-title">Calendar Intelligence</div>
          <div className="sec-sub">Sem atletas disponiveis para o filtro atual</div>
        </div>
        <div className="empty-state"><h3>Sem dados</h3></div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700 }}>Calendar Intelligence</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Score projectado · Simula o impacto das decisoes de carga</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <label className="sr-only" htmlFor="calendar-athlete">Atleta</label>
          <select
            id="calendar-athlete"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{ minHeight: 38, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontFamily: 'var(--body)', fontSize: 13, cursor: 'pointer', outline: 'none' }}
          >
            {dto.athletes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
      </div>

      {athlete.profile && (
        <div className="g2" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="ctitle">Perfil de recuperacao - {athlete.label}</div>
            <div className="stat-grid-4">
              {[
                { label: 'VEL. RECUP.', val: `${(athlete.profile.recovery_speed ?? 1).toFixed(2)}x`, col: (athlete.profile.recovery_speed ?? 1) >= 1.1 ? 'var(--green2)' : (athlete.profile.recovery_speed ?? 1) >= 0.9 ? 'var(--warn)' : 'var(--danger)' },
                { label: 'SENS. CONG.', val: `${(athlete.profile.congestion_sensitivity ?? 1).toFixed(2)}x`, col: (athlete.profile.congestion_sensitivity ?? 1) <= 0.9 ? 'var(--green2)' : (athlete.profile.congestion_sensitivity ?? 1) <= 1.1 ? 'var(--warn)' : 'var(--danger)' },
                { label: 'QUEDA MD+1', val: `-${athlete.profile.typical_md1_drop ?? 12}pp`, col: 'var(--danger)' },
                { label: 'QUEDA MD+2', val: `-${athlete.profile.typical_md2_drop ?? 7}pp`, col: 'var(--warn)' },
              ].map((stat) => (
                <div key={stat.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', marginBottom: 3 }}>{stat.label}</div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700, color: stat.col }}>{stat.val}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="ctitle">Score projectado - proximos {events.length} dias</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, marginBottom: 8, padding: '0 4px' }}>
              {snapshots.map((snap, i) => {
                const isMatch = i > 0 && events[i - 1]?.event_type === 'match'
                const score = isMatch ? snap.pre : snap.post
                const col = riskColor(score)
                const height = Math.round((score / 100) * 70)
                const label = i === 0 ? 'Hoje' : `D+${i}`
                return (
                  <div key={`${label}-${i}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600, color: col }}>{score}</div>
                    <div aria-label={`Score ${label}: ${score}%`} style={{ width: '100%', height, background: col, borderRadius: '2px 2px 0 0', opacity: isMatch ? 1 : 0.7 }} />
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)' }}>{label}</div>
                  </div>
                )
              })}
            </div>
            <div className="alert alert-b" style={{ marginBottom: 0 }}>
              <div className="adot ad-b" />
              <div style={{ fontSize: 12 }}>
                Use os botoes em cada dia para mudar o tipo de sessao. O grafico actualiza em tempo real.
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
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
              minWidth: 110,
            }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>
                D+{idx + 1}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: tCol, marginBottom: 3 }}>{ev.label ?? TYPE_LABELS[ev.event_type ?? 'rest'] ?? 'Evento'}</div>
              {ev.intensity && <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: INT_COLORS[ev.intensity] ?? 'var(--text2)' }}>{ev.intensity.toUpperCase()}</div>}

              <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', marginBottom: 1 }}>
                  {isMatch ? 'Risco entrada' : 'Score proj.'}
                </div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700, color: scoreCol }}>{displayScore}%</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: scoreCol }}>
                  {displayScore < 40 ? 'Baixo' : displayScore < 65 ? 'Moderado' : displayScore < 85 ? 'Alto' : 'Critico'}
                </div>
              </div>

              <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                {(['prev', 'next'] as const).map((dir) => (
                  <button
                    key={dir}
                    onClick={() => changeEvent(idx, dir)}
                    aria-label={`${dir === 'prev' ? 'Reduzir' : 'Aumentar'} carga do dia ${idx + 1}`}
                    style={{ width: 40, height: 40, background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}
                  >
                    {dir === 'prev' ? '<' : '>'}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
