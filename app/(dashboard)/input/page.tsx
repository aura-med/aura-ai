'use client'
import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { calcScore, riskColor, riskLabel, VAR_ICONS, VAR_LABELS } from '@/lib/scoring'
import { DecompositionBars, ConfBadge, AlertBox } from '@/components/ui/aura'
import { supabase } from '@/lib/supabase'
import { getSquadIdParam } from '@/lib/squad-url'
import type { AthleteScore } from '@/types'

const SLIDERS = [
  { k: 'fatigue', label: 'Fadiga (Hooper)',      min: 1,   max: 7,   step: 1,   dec: 0, suffix: '/7',  ref: 'Hooper 1995' },
  { k: 'sleep',   label: 'Sono (horas)',           min: 3,   max: 10,  step: 0.5, dec: 1, suffix: 'h',   ref: 'Meta-análise 2025' },
  { k: 'tqr',     label: 'TQR',                   min: 6,   max: 20,  step: 1,   dec: 0, suffix: '/20', ref: 'Kenttä 1998' },
  { k: 'stress',  label: 'Stress percebido',       min: 0,   max: 10,  step: 1,   dec: 0, suffix: '/10', ref: 'Borato 2022' },
  { k: 'acwr',    label: 'ACWR GPS',               min: 0.5, max: 2.5, step: 0.01,dec: 2, suffix: '',    ref: 'Gabbett 2016' },
  { k: 'hrv',     label: 'HRV Δ baseline (%)',     min: -40, max: 10,  step: 1,   dec: 0, suffix: '%',   ref: 'Plews 2013' },
  { k: 'decel',   label: 'Desacelerações ACWR',    min: 0.5, max: 2.5, step: 0.01,dec: 2, suffix: '',    ref: 'Saberisani 2025' },
  { k: 'md',      label: 'Dias desde jogo',        min: 0,   max: 5,   step: 1,   dec: 0, suffix: 'd',   ref: 'Chang 2024' },
]

export default function InputPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /><span>A carregar dados...</span></div>}>
      <InputContent />
    </Suspense>
  )
}

function InputContent() {
  const searchParams = useSearchParams()
  const squadId = getSquadIdParam(searchParams)
  const [athletes, setAthletes] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [values, setValues] = useState<Record<string, number | null>>({})
  const [history, setHistory] = useState<number>(-1)
  const [score, setScore] = useState<AthleteScore | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let query = supabase.from('athletes').select('id,name,shirt_number,position,status,injury_events(*)')
      .eq('active', true).eq('status', 'available').order('shirt_number')

    if (squadId) query = query.eq('squad_id', squadId)

    query.then(({ data }) => {
        setAthletes(data ?? [])
        if (data?.[0]) {
          setSelectedId(data[0].id)
          const histCount = (data[0].injury_events ?? []).length
          setHistory(histCount >= 2 ? 2 : histCount >= 1 ? 1 : 0)
        } else {
          setSelectedId('')
          setHistory(-1)
        }
      })
  }, [squadId])

  useEffect(() => {
    const inputs = {
      history: history >= 0 ? history : null,
      acwr: values.acwr ?? null,
      hrv: values.hrv ?? null,
      fatigue: values.fatigue ?? null,
      sleep: values.sleep ?? null,
      tqr: values.tqr ?? null,
      stress: values.stress ?? null,
      decel: values.decel ?? null,
      md: values.md ?? null,
    }
    setScore(calcScore(inputs))
  }, [values, history])

  async function handleSave() {
    if (!selectedId) return
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('wellness_checkins').upsert({
      athlete_id: selectedId,
      checkin_date: today,
      checkin_type: 'morning',
      fatigue: values.fatigue ?? null,
      sleep_hours: values.sleep ?? null,
      tqr: values.tqr ?? null,
      stress: values.stress ?? null,
    }, { onConflict: 'athlete_id,checkin_date' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const NORM_COLOR = (k: string, v: number | null) => {
    if (v == null) return 'var(--text3)'
    const map: Record<string, (v: number) => string> = {
      fatigue: v => v <= 3 ? 'var(--green2)' : v <= 5 ? 'var(--warn)' : 'var(--danger)',
      sleep:   v => v >= 8 ? 'var(--green2)' : v >= 6 ? 'var(--warn)' : 'var(--danger)',
      tqr:     v => v >= 14 ? 'var(--green2)' : v >= 10 ? 'var(--warn)' : 'var(--danger)',
      stress:  v => v <= 3 ? 'var(--green2)' : v <= 6 ? 'var(--warn)' : 'var(--danger)',
      acwr:    v => v < 1.3 ? 'var(--green2)' : v < 1.5 ? 'var(--warn)' : 'var(--danger)',
      hrv:     v => v >= -5 ? 'var(--green2)' : v >= -15 ? 'var(--warn)' : 'var(--danger)',
      decel:   v => v < 1.3 ? 'var(--green2)' : v < 1.5 ? 'var(--warn)' : 'var(--danger)',
      md:      v => v >= 4 ? 'var(--green2)' : v >= 2 ? 'var(--warn)' : 'var(--danger)',
    }
    return map[k]?.(v) ?? 'var(--text2)'
  }

  return (
    <div>
      {/* Header with athlete selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700 }}>✏️ Inserir dados</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Score recalculado em tempo real</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Atleta:</div>
          <select
            value={selectedId}
            onChange={e => {
              setSelectedId(e.target.value)
              setValues({})
            }}
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 8, padding: '6px 10px', color: 'var(--text)',
              fontFamily: 'var(--body)', fontSize: 13, cursor: 'pointer', outline: 'none',
            }}
          >
            {athletes.map(a => (
              <option key={a.id} value={a.id}>{a.shirt_number}. {a.name} ({a.position})</option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: saved ? 'var(--green)' : 'var(--green2)',
              color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {saving ? 'A guardar...' : saved ? 'Guardado ✓' : 'Guardar ✓'}
          </button>
        </div>
      </div>

      <div className="g2">
        {/* Inputs */}
        <div>
          {/* History */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="ctitle">Historial de lesões</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(v => (
                <button
                  key={v}
                  onClick={() => setHistory(v)}
                  style={{
                    flex: 1, padding: 8, borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'var(--mono)', fontSize: 11, transition: 'all .15s',
                    border: `1px solid ${history === v ? 'var(--green2)' : 'var(--border)'}`,
                    background: history === v ? 'var(--green3)' : 'var(--bg3)',
                    color: history === v ? 'var(--green2)' : 'var(--text2)',
                  }}
                >
                  {v === 0 ? '0 lesões' : v === 1 ? '1 lesão' : '≥2 mesmo seg.'}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="card">
            <div className="ctitle">Variáveis de monitorização</div>
            {SLIDERS.map(s => {
              const cur = values[s.k] ?? ((s.min + s.max) / 2)
              const col = NORM_COLOR(s.k, values[s.k] ?? null)
              return (
                <div key={s.k} className="slider-row">
                  <div className="slider-label">{VAR_ICONS[s.k]} {s.label}</div>
                  <input
                    type="range" min={s.min} max={s.max} step={s.step}
                    value={values[s.k] ?? cur}
                    onChange={e => setValues(v => ({ ...v, [s.k]: parseFloat(e.target.value) }))}
                    style={{ flex: 1, accentColor: 'var(--green2)', cursor: 'pointer' }}
                  />
                  <div className="slider-val" style={{ color: col }}>
                    {(values[s.k] ?? cur).toFixed(s.dec)}{s.suffix}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Live score */}
        {score && (
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
                  Variável dominante: <strong style={{ color: riskColor(score.score) }}>
                    {VAR_ICONS[score.dominant_variable]} {VAR_LABELS[score.dominant_variable]}
                  </strong>
                </div>
              )}
            </div>
            <div className="card">
              <div className="ctitle">Decomposição</div>
              <DecompositionBars calc={score} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
