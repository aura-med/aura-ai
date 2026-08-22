'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { calcScore, riskColor, VAR_ICONS, VAR_LABELS } from '@/lib/scoring'
import { DecompositionBars, ConfBadge } from '@/components/ui/sophi'
import { upsertWellnessCheckin } from '@/lib/data/actions'
import { useUiStore } from '@/stores/uiStore'
import { isOwner, REHAB_ROLES } from '@/lib/roles'
import type { AthleteScore } from '@/types'
import type { InputPageDTO } from '@/lib/data/types'

const SLIDERS = [
  { k: 'fatigue', label: 'Fadiga (Hooper)', min: 1, max: 7, step: 1, dec: 0, suffix: '/7', ref: 'Hooper 1995' },
  { k: 'sleep', label: 'Sono (horas)', min: 3, max: 10, step: 0.5, dec: 1, suffix: 'h', ref: 'Meta-analise 2025' },
  { k: 'tqr', label: 'TQR', min: 6, max: 20, step: 1, dec: 0, suffix: '/20', ref: 'Kentta 1998' },
  { k: 'stress', label: 'Stress percebido', min: 0, max: 10, step: 1, dec: 0, suffix: '/10', ref: 'Borato 2022' },
  { k: 'acwr', label: 'ACWR GPS', min: 0.5, max: 2.5, step: 0.01, dec: 2, suffix: '', ref: 'Gabbett 2016' },
  { k: 'hrv', label: 'HRV delta baseline (%)', min: -40, max: 10, step: 1, dec: 0, suffix: '%', ref: 'Plews 2013' },
  { k: 'decel', label: 'Desaceleracoes ACWR', min: 0.5, max: 2.5, step: 0.01, dec: 2, suffix: '', ref: 'Saberisani 2025' },
  { k: 'md', label: 'Dias desde jogo', min: 0, max: 5, step: 1, dec: 0, suffix: 'd', ref: 'Chang 2024' },
] as const

function normColor(k: string, v: number | null) {
  if (v == null) return 'var(--text3)'
  const map: Record<string, (value: number) => string> = {
    fatigue: (value) => value <= 3 ? 'var(--green2)' : value <= 5 ? 'var(--warn)' : 'var(--danger)',
    sleep: (value) => value >= 8 ? 'var(--green2)' : value >= 6 ? 'var(--warn)' : 'var(--danger)',
    tqr: (value) => value >= 14 ? 'var(--green2)' : value >= 10 ? 'var(--warn)' : 'var(--danger)',
    stress: (value) => value <= 3 ? 'var(--green2)' : value <= 6 ? 'var(--warn)' : 'var(--danger)',
    acwr: (value) => value < 1.3 ? 'var(--green2)' : value < 1.5 ? 'var(--warn)' : 'var(--danger)',
    hrv: (value) => value >= -5 ? 'var(--green2)' : value >= -15 ? 'var(--warn)' : 'var(--danger)',
    decel: (value) => value < 1.3 ? 'var(--green2)' : value < 1.5 ? 'var(--warn)' : 'var(--danger)',
    md: (value) => value >= 4 ? 'var(--green2)' : value >= 2 ? 'var(--warn)' : 'var(--danger)',
  }
  return map[k]?.(v) ?? 'var(--text2)'
}

export function InputClient({ dto }: { dto: InputPageDTO }) {
  const [selectedId, setSelectedId] = useState(dto.athletes[0]?.id ?? '')
  const selectedAthlete = dto.athletes.find((athlete) => athlete.id === selectedId)
  const [values, setValues] = useState<Record<string, number | null>>({})
  const [history, setHistory] = useState<number>(selectedAthlete?.historyLevel ?? -1)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Score recalculation is restricted to owner/doctor/physio server-side
  // (score_history RLS + the /score route role gate). Other roles that can
  // still enter a wellness check-in (coach, fitness_coach, …) must not have the
  // score POST turn a successful check-in into a visible failure.
  const role = useUiStore((s) => s.role)
  const canRecalcScore = isOwner(role) || REHAB_ROLES.includes(role)

  useEffect(() => {
    if (dto.athletes.some((athlete) => athlete.id === selectedId)) return

    const nextAthlete = dto.athletes[0]
    queueMicrotask(() => {
      setSelectedId(nextAthlete?.id ?? '')
      setHistory(nextAthlete?.historyLevel ?? -1)
      setValues({})
      setSaveError(null)
      setSaved(false)
    })
  }, [dto.athletes, selectedId])

  const score: AthleteScore = useMemo(() => calcScore({
    history: history >= 0 ? history : null,
    acwr: values.acwr ?? null,
    hrv: values.hrv ?? null,
    fatigue: values.fatigue ?? null,
    sleep: values.sleep ?? null,
    tqr: values.tqr ?? null,
    stress: values.stress ?? null,
    decel: values.decel ?? null,
    md: values.md ?? null,
  }), [values, history])

  function handleSave() {
    if (!selectedAthlete) return
    startTransition(async () => {
      setSaveError(null)
      try {
        await upsertWellnessCheckin({
          athleteId: selectedAthlete.id,
          fatigue: values.fatigue ?? null,
          sleepHours: values.sleep ?? null,
          tqr: values.tqr ?? null,
          stress: values.stress ?? null,
        })

        // Only score-writer roles can recalculate; for everyone else the
        // check-in is the deliverable and the score refreshes on the next
        // clinical recompute.
        if (canRecalcScore) {
          const scoreResponse = await fetch(`/api/athletes/${selectedAthlete.id}/score`, {
            method: 'POST',
          })

          if (!scoreResponse.ok && scoreResponse.status !== 403) {
            const payload = await scoreResponse.json().catch(() => null)
            throw new Error(payload?.error ?? 'Falha ao recalcular score')
          }
        }

        setSaved(true)
        window.setTimeout(() => setSaved(false), 2000)
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Erro ao guardar')
      }
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700 }}>Inserir dados</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Score recalculado em tempo real</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label htmlFor="athlete-input-select" style={{ fontSize: 12, color: 'var(--text2)' }}>Atleta:</label>
          <select
            id="athlete-input-select"
            value={selectedId}
            onChange={(e) => {
              const nextId = e.target.value
              const nextAthlete = dto.athletes.find((athlete) => athlete.id === nextId)
              setSelectedId(nextId)
              setHistory(nextAthlete?.historyLevel ?? -1)
              setValues({})
            }}
            style={{
              minHeight: 36,
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 8, padding: '6px 10px', color: 'var(--text)',
              fontFamily: 'var(--body)', fontSize: 13, cursor: 'pointer', outline: 'none',
            }}
          >
            {dto.athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>{athlete.label} ({athlete.position ?? '-'})</option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={isPending || !selectedAthlete}
            style={{
              minHeight: 40,
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: saved ? 'var(--green)' : 'var(--green2)',
              color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {isPending ? 'A guardar...' : saved ? 'Guardado' : 'Guardar'}
          </button>
          {saveError && (
            <div role="alert" style={{ flexBasis: '100%', fontSize: 12, color: 'var(--danger)', textAlign: 'right' }}>
              {saveError}
            </div>
          )}
        </div>
      </div>

      <div className="g2">
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="ctitle">Historial de lesoes</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map((v) => (
                <button
                  key={v}
                  onClick={() => setHistory(v)}
                  aria-pressed={history === v}
                  style={{
                    flex: 1, minHeight: 40, padding: 8, borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'var(--mono)', fontSize: 11, transition: 'all .15s',
                    border: `1px solid ${history === v ? 'var(--green2)' : 'var(--border)'}`,
                    background: history === v ? 'var(--green3)' : 'var(--bg3)',
                    color: history === v ? 'var(--green2)' : 'var(--text2)',
                  }}
                >
                  {v === 0 ? '0 lesoes' : v === 1 ? '1 lesao' : '2+ mesmo seg.'}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="ctitle">Variaveis de monitorizacao</div>
            {SLIDERS.map((s) => {
              const cur = values[s.k] ?? ((s.min + s.max) / 2)
              const col = normColor(s.k, values[s.k] ?? null)
              return (
                <label key={s.k} className="slider-row">
                  <span className="slider-label">{VAR_ICONS[s.k]} {s.label}</span>
                  <input
                    type="range" min={s.min} max={s.max} step={s.step}
                    value={values[s.k] ?? cur}
                    onChange={(e) => setValues((v) => ({ ...v, [s.k]: parseFloat(e.target.value) }))}
                    style={{ flex: 1, accentColor: 'var(--green2)', cursor: 'pointer' }}
                    aria-label={s.label}
                  />
                  <span className="slider-val" style={{ color: col }}>
                    {(values[s.k] ?? cur).toFixed(s.dec)}{s.suffix}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>
              Score calculado
            </div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 64, fontWeight: 900, color: riskColor(score.score), lineHeight: 1, marginBottom: 8 }}>
              {score.score}%
            </div>
            <ConfBadge confidence={score.confidence} reason={score.confidence_reason} missing={score.missing} />
            {score.dominant_variable && (
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
                Variavel dominante: <strong style={{ color: riskColor(score.score) }}>
                  {VAR_ICONS[score.dominant_variable]} {VAR_LABELS[score.dominant_variable]}
                </strong>
              </div>
            )}
          </div>
          <div className="card">
            <div className="ctitle">Decomposicao</div>
            <DecompositionBars calc={score} />
          </div>
        </div>
      </div>
    </div>
  )
}
