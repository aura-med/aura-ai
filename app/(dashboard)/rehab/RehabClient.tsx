'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { toggleRtpCriterion, updateRehabClinicalValue } from '@/lib/data/actions'
import type { RehabPageDTO, RehabSessionDTO } from '@/lib/data/types'

function currentPhase(session: RehabSessionDTO) {
  const phases = session.protocol?.phases ?? []
  return phases.find((phase) => session.currentDay >= phase.d1 && session.currentDay <= phase.d2)
    ?? phases[phases.length - 1]
}

function protocolProgress(session: RehabSessionDTO) {
  const phase = currentPhase(session)
  if (!phase) return 0
  return Math.max(0, Math.min(100, Math.round(((session.currentDay - phase.d1) / (phase.d2 - phase.d1 + 1)) * 100)))
}

function RehabClinicalControl({ session }: { session: RehabSessionDTO }) {
  const [isPending, startTransition] = useTransition()
  const clinical = session.clinicalData
  const protocolKey = session.protocol?.key

  function update(field: string, value: number | boolean) {
    startTransition(async () => {
      await updateRehabClinicalValue(session.id, field, value)
    })
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div className="ctitle">Avaliacao clinica</div>
      <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14, opacity: isPending ? 0.7 : 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Dor (EVA 0-10)</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: (clinical.pain_vas ?? 5) <= 2 ? 'var(--green2)' : (clinical.pain_vas ?? 5) <= 5 ? 'var(--warn)' : 'var(--danger)' }}>
                {clinical.pain_vas ?? '-'}/10
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              defaultValue={clinical.pain_vas ?? 5}
              onChange={(e) => update('pain_vas', parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--green2)', minHeight: 32 }}
            />
          </label>

          {protocolKey === 'hamstring' && (
            <SegmentedNumberControl
              label="Forca exc. (%)"
              values={[60, 70, 80, 90, 100]}
              current={clinical.strength_pct}
              onChange={(value) => update('strength_pct', value)}
            />
          )}

          {protocolKey === 'hamstring' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Askling H-test</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: false, label: 'Positivo' }, { v: true, label: 'Negativo' }].map((opt) => (
                  <button
                    key={String(opt.v)}
                    onClick={() => update('test_ok', opt.v)}
                    aria-pressed={clinical.test_ok === opt.v}
                    style={{
                      flex: 1, minHeight: 40, padding: 6, borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      border: `1px solid ${clinical.test_ok === opt.v ? (opt.v ? 'var(--green2)' : 'var(--danger)') : 'var(--border)'}`,
                      background: clinical.test_ok === opt.v ? (opt.v ? 'var(--green3)' : 'var(--danger2)') : 'var(--bg4)',
                      color: clinical.test_ok === opt.v ? (opt.v ? 'var(--green2)' : 'var(--danger)') : 'var(--text2)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {protocolKey === 'ankle' && (
            <SegmentedNumberControl
              label="Equilibrio (s)"
              values={[10, 15, 20, 25, 30]}
              current={clinical.balance_s}
              onChange={(value) => update('balance_s', value)}
            />
          )}

          {protocolKey === 'ankle' && (
            <SegmentedNumberControl
              label="Hop test (%)"
              values={[70, 75, 80, 85, 90, 95]}
              current={clinical.hop_pct}
              onChange={(value) => update('hop_pct', value)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SegmentedNumberControl({
  label,
  values,
  current,
  onChange,
}: {
  label: string
  values: number[]
  current?: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {values.map((value) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            aria-pressed={current === value}
            style={{
              minHeight: 36,
              padding: '3px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              border: `1px solid ${current === value ? 'var(--green2)' : 'var(--border)'}`,
              background: current === value ? 'var(--green3)' : 'var(--bg4)',
              color: current === value ? 'var(--green2)' : 'var(--text2)',
            }}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  )
}

function RtpChecklist({ session }: { session: RehabSessionDTO }) {
  const [isPending, startTransition] = useTransition()
  const done = session.rtpCriteria.filter((criterion) => criterion.done).length

  return (
    <div>
      <div className="ctitle">Criterios de RTP ({done}/{session.rtpCriteria.length})</div>
      {session.rtpCriteria.map((criterion, index) => (
        <label key={`${session.id}-${criterion.label}`} className="rtp-item" style={{ minHeight: 40, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={criterion.done}
            disabled={isPending}
            onChange={() => {
              startTransition(async () => {
                await toggleRtpCriterion(session.id, index, session.rtpCriteria)
              })
            }}
            style={{ width: 18, height: 18, accentColor: 'var(--green2)' }}
          />
          <span style={{ color: criterion.done ? 'var(--green2)' : 'var(--text2)' }}>{criterion.label}</span>
        </label>
      ))}
      <div style={{ marginTop: 10, height: 5, background: 'var(--bg5)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.round((done / Math.max(session.rtpCriteria.length, 1)) * 100)}%`, height: 5, background: 'var(--green2)', borderRadius: 3, transition: 'width .3s' }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 5 }}>
        {done} de {session.rtpCriteria.length} criterios cumpridos
      </div>
    </div>
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

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Reabilitacao activa</div>
        <div className="sec-sub">
          {dto.sessions.length} atleta{dto.sessions.length > 1 ? 's' : ''} em protocolo · RTP adaptativo
        </div>
      </div>

      {dto.sessions.map((session) => {
        if (session.noSession) {
          return (
            <div key={session.id} className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <Link href={`/athletes/${session.athleteId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{session.athleteName}</div>
                  </Link>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                    {session.position ?? '-'} · {session.club ?? '-'}
                  </div>
                </div>
                <div className="alert alert-w" style={{ margin: 0 }}>
                  <div className="adot ad-w" />
                  <div style={{ fontSize: 12 }}>{session.status.label}</div>
                </div>
              </div>
            </div>
          )
        }

        const phase = currentPhase(session)
        const phasePct = protocolProgress(session)

        return (
          <div key={session.id} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div>
                <Link href={`/rehab/${session.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{session.athleteName}</div>
                </Link>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                  {session.protocol?.name} · Dia {session.currentDay}/{session.protocol?.totalDays ?? '-'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {session.protocol?.evidence}
                </div>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--mono)',
                background: session.status.key === 'green' ? 'var(--green3)' : 'var(--blue2)',
                color: session.status.key === 'green' ? 'var(--green2)' : 'var(--blue)',
                border: '1px solid rgba(77,154,255,0.25)',
              }}>
                {session.status.label}
              </div>
            </div>

            <div className="ctitle">Protocolo - fases</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto' }}>
              {(session.protocol?.phases ?? []).map((phaseItem, i) => {
                const isDone = session.currentDay > phaseItem.d2
                const isActive = session.currentDay >= phaseItem.d1 && session.currentDay <= phaseItem.d2
                return (
                  <div key={`${phaseItem.name}-${i}`} style={{
                    flex: '0 0 auto', padding: '10px 14px', borderRadius: 8,
                    border: `1px solid ${isActive ? phaseItem.color : 'var(--border)'}`,
                    background: isActive ? `${phaseItem.color}15` : 'var(--bg3)',
                    minWidth: 140,
                  }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 3 }}>
                      {phaseItem.range}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isDone ? 'var(--green2)' : isActive ? phaseItem.color : 'var(--text3)' }}>
                      {isDone ? 'Completa: ' : ''}{phaseItem.name}
                    </div>
                    {isActive && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ height: 3, background: 'var(--bg5)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${phasePct}%`, height: 3, background: phaseItem.color, borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                          Dia {session.currentDay} - {phasePct}% da fase
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="g2">
              {phase && (
                <div>
                  <div className="ctitle">Exercicios prescritos - {phase.name}</div>
                  {phase.ex.map((exercise) => (
                    <div key={exercise} style={{ fontSize: 12, color: 'var(--text2)', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      {exercise}
                    </div>
                  ))}
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
                    Criterio de progressao: {phase.criteria}
                  </div>
                </div>
              )}

              <RtpChecklist session={session} />
            </div>

            <RehabClinicalControl session={session} />
          </div>
        )
      })}
    </div>
  )
}
