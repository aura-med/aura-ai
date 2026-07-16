'use client'

import Link from 'next/link'
import { withSquadParam } from '@/lib/squad-url'
import type { RehabPageDTO, RehabSessionDTO } from '@/lib/data/types'

const SEV_COLOR: Record<string, string> = {
  minor:    'var(--warn)',
  moderate: 'var(--warn)',
  major:    'var(--danger)',
  severe:   'var(--danger)',
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div style={{ height: 4, background: 'var(--bg5)', borderRadius: 2, overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${pct}%`, height: 4, background: color, borderRadius: 2, transition: 'width .3s' }} />
    </div>
  )
}

function currentPhaseForSession(session: RehabSessionDTO) {
  return (session.protocol?.phases ?? []).find(
    (p) => session.currentDay >= p.d1 && session.currentDay <= p.d2
  ) ?? session.protocol?.phases?.[session.protocol.phases.length - 1] ?? null
}

function AthleteRow({ session, squadId }: { session: RehabSessionDTO; squadId: string | null }) {
  const phase = currentPhaseForSession(session)
  const phaseColor = phase?.color ?? 'var(--blue)'
  const totalDays = session.protocol?.totalDays ?? 0
  const detailHref = withSquadParam(`/rehab/${session.id}`, squadId)

  return (
    <tr>
      {/* Status dot + name */}
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: session.status.key === 'green' ? 'var(--green2)'
                : session.status.key === 'red' ? 'var(--danger)'
                : 'var(--warn)',
            }}
          />
          <div>
            {session.noSession ? (
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                {session.athleteName}
              </div>
            ) : (
              <Link
                href={detailHref}
                style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', textDecoration: 'none' }}
              >
                {session.athleteName}
              </Link>
            )}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
              {[session.position, session.club].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
      </td>

      {/* Diagnosis */}
      <td>
        {session.diagnosis ? (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>{session.diagnosis}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
              {session.injuryLocation && (
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                  {session.injuryLocation}
                </span>
              )}
              {session.severity && (
                <span style={{
                  fontSize: 9, fontFamily: 'var(--mono)',
                  color: SEV_COLOR[session.severity] ?? 'var(--text3)',
                  background: `${SEV_COLOR[session.severity] ?? 'var(--bg3)'}18`,
                  padding: '1px 5px', borderRadius: 3,
                }}>
                  {session.severity}
                </span>
              )}
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
        )}
      </td>

      {/* Protocol + day */}
      <td>
        {session.noSession ? (
          <span style={{ fontSize: 12, color: 'var(--warn)' }}>Sem protocolo</span>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
              {session.protocol?.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
              Dia {session.currentDay}/{session.protocol?.totalDays ?? '?'}
              {session.injuryDate && (
                <> · desde {new Date(session.injuryDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</>
              )}
            </div>
          </div>
        )}
      </td>

      {/* Progress */}
      <td style={{ minWidth: 120 }}>
        {!session.noSession && totalDays > 0 && (
          <div>
            <ProgressBar value={session.currentDay} total={totalDays} color={phaseColor} />
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 3 }}>
              {Math.min(100, Math.round((session.currentDay / totalDays) * 100))}%
            </div>
          </div>
        )}
      </td>

      {/* Current phase */}
      <td>
        {phase ? (
          <span style={{
            display: 'inline-block', fontSize: 10, fontFamily: 'var(--mono)',
            padding: '3px 8px', borderRadius: 4,
            background: `${phaseColor}18`, color: phaseColor,
            border: `1px solid ${phaseColor}40`,
          }}>
            {phase.name}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
        )}
      </td>

      {/* RTP status */}
      <td>
        {!session.noSession && session.rtpCriteria.length > 0 && (() => {
          const done = session.rtpCriteria.filter((c) => c.done).length
          const total = session.rtpCriteria.length
          return (
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: done === total ? 'var(--green2)' : 'var(--text3)' }}>
                RTP {done}/{total}
              </div>
              <ProgressBar value={done} total={total} color="var(--green2)" />
            </div>
          )
        })()}
      </td>

      {/* Action */}
      <td>
        {!session.noSession && (
          <Link
            href={detailHref}
            style={{
              display: 'inline-block', fontSize: 11, padding: '5px 10px',
              borderRadius: 6, border: '1px solid var(--border)',
              color: 'var(--text2)', textDecoration: 'none',
              fontFamily: 'var(--mono)',
            }}
          >
            Abrir →
          </Link>
        )}
      </td>
    </tr>
  )
}

export function RehabClient({ dto }: { dto: RehabPageDTO }) {
  if (dto.sessions.length === 0) {
    return (
      <div>
        <div className="sec-hdr">
          <div className="sec-title">Reabilitacao activa</div>
        </div>
        <div className="empty-state">
          <h3>Sem atletas em reabilitacao</h3>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>Todos os atletas estao disponiveis.</p>
        </div>
      </div>
    )
  }

  const withProtocol   = dto.sessions.filter((s) => !s.noSession)
  const rtpReady       = withProtocol.filter((s) => s.rtpCriteria.length > 0 && s.rtpCriteria.every((c) => c.done))

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Reabilitacao activa</div>
        <div className="sec-sub">
          {dto.sessions.length} atleta{dto.sessions.length > 1 ? 's' : ''} em protocolo · Seleciona para detalhe
        </div>
      </div>

      {/* KPI summary */}
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-num" style={{ color: 'var(--danger)' }}>{dto.sessions.length}</div>
          <div className="kpi-label">Em reabilitação</div>
        </div>
        <div className="kpi">
          <div className="kpi-num" style={{ color: 'var(--warn)' }}>{withProtocol.length}</div>
          <div className="kpi-label">Com protocolo</div>
        </div>
        <div className="kpi">
          <div className="kpi-num" style={{ color: 'var(--green2)' }}>{rtpReady.length}</div>
          <div className="kpi-label">Prontos RTP</div>
        </div>
        <div className="kpi">
          <div className="kpi-num" style={{ color: 'var(--text3)' }}>{dto.sessions.length - withProtocol.length}</div>
          <div className="kpi-label">Sem protocolo</div>
        </div>
      </div>

      {/* Athlete panel */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 680 }}>
            <thead>
              <tr>
                <th>Atleta</th>
                <th>Diagnóstico</th>
                <th>Protocolo</th>
                <th>Progresso</th>
                <th>Fase</th>
                <th>RTP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dto.sessions.map((session) => (
                <AthleteRow key={session.id} session={session} squadId={dto.squadId} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
