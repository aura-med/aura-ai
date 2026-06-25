'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Trash2, Plus, Trophy, Dumbbell } from 'lucide-react'
import { formatDisplayDate } from '@/lib/utils/microcycle'

interface CalendarEvent {
  id: string
  event_date: string
  event_type: string
  label: string | null
  is_match_day: boolean | null
  opponent: string | null
  venue: string | null
}

const VENUE_LABELS: Record<string, string> = {
  home: 'Casa',
  away: 'Fora',
  neutral: 'Neutro',
}

export default function CalendarSettingsPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [showAddTraining, setShowAddTraining] = useState(false)
  const router = useRouter()

  const [matchForm, setMatchForm] = useState({
    event_date: '',
    opponent: '',
    venue: 'home' as 'home' | 'away' | 'neutral',
  })

  const [trainingForm, setTrainingForm] = useState({
    event_date: '',
    event_type: 'training' as 'training' | 'recovery' | 'rest' | 'travel',
    label: '',
  })

  async function fetchEvents() {
    const supabase = createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .single()

    if (!profile?.org_id) return

    const { data } = await supabase
      .from('calendar_events')
      .select('id, event_date, event_type, label, is_match_day, opponent, venue')
      .order('event_date', { ascending: false })
      .limit(60)

    setEvents(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchEvents() }, [])

  function handleAddMatch() {
    if (!matchForm.event_date) return
    startTransition(async () => {
      const supabase = createClient()
      await supabase.from('calendar_events').insert({
        event_date: matchForm.event_date,
        event_type: 'match',
        label: matchForm.opponent ? `vs ${matchForm.opponent}` : 'Jogo',
        is_match_day: true,
        opponent: matchForm.opponent || null,
        venue: matchForm.venue,
      })
      setMatchForm({ event_date: '', opponent: '', venue: 'home' })
      setShowAddMatch(false)
      await fetchEvents()
      router.refresh()
    })
  }

  function handleAddTraining() {
    if (!trainingForm.event_date) return
    startTransition(async () => {
      const supabase = createClient()
      await supabase.from('calendar_events').insert({
        event_date: trainingForm.event_date,
        event_type: trainingForm.event_type,
        label: trainingForm.label || null,
        is_match_day: false,
      })
      setTrainingForm({ event_date: '', event_type: 'training', label: '' })
      setShowAddTraining(false)
      await fetchEvents()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const supabase = createClient()
      await supabase.from('calendar_events').delete().eq('id', id)
      setEvents((prev) => prev.filter((e) => e.id !== id))
      router.refresh()
    })
  }

  const matchDays = events.filter((e) => e.is_match_day)
  const trainings = events.filter((e) => !e.is_match_day)

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--aura-text)', fontFamily: 'var(--font-syne)', marginBottom: 4 }}>
          Calendário da Temporada
        </h2>
        <p style={{ fontSize: 13, color: 'var(--aura-text3)' }}>
          Gere os jogos e treinos. Os dias de jogo são usados para calcular o microciclo e a posição MD no dashboard.
        </p>
      </div>

      {/* Match days section */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={15} style={{ color: 'var(--aura-warn)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
              Dias de Jogo
            </span>
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-dm-mono)', fontWeight: 700,
              padding: '1px 7px', borderRadius: 999,
              background: 'rgba(246,173,85,0.12)', color: 'var(--aura-warn)',
            }}>
              {matchDays.length}
            </span>
          </div>
          <button
            onClick={() => { setShowAddMatch(true); setShowAddTraining(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, padding: '5px 10px', borderRadius: 6,
              border: '1px solid rgba(246,173,85,0.3)', background: 'rgba(246,173,85,0.06)',
              color: 'var(--aura-warn)', cursor: 'pointer', fontWeight: 600,
            }}
          >
            <Plus size={11} />
            Adicionar Jogo
          </button>
        </div>

        {/* Add match form */}
        {showAddMatch && (
          <div style={{ background: 'var(--aura-bg3)', border: '1px solid var(--aura-border)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text3)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Data do Jogo</label>
                <input
                  type="date"
                  value={matchForm.event_date}
                  onChange={(e) => setMatchForm((f) => ({ ...f, event_date: e.target.value }))}
                  style={{ width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12, background: 'var(--aura-bg2)', border: '1px solid var(--aura-border)', color: 'var(--aura-text)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text3)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Adversário</label>
                <input
                  type="text"
                  placeholder="Ex: Benfica"
                  value={matchForm.opponent}
                  onChange={(e) => setMatchForm((f) => ({ ...f, opponent: e.target.value }))}
                  style={{ width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12, background: 'var(--aura-bg2)', border: '1px solid var(--aura-border)', color: 'var(--aura-text)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text3)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Local</label>
                <select
                  value={matchForm.venue}
                  onChange={(e) => setMatchForm((f) => ({ ...f, venue: e.target.value as typeof matchForm.venue }))}
                  style={{ width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12, background: 'var(--aura-bg2)', border: '1px solid var(--aura-border)', color: 'var(--aura-text)' }}
                >
                  <option value="home">Casa</option>
                  <option value="away">Fora</option>
                  <option value="neutral">Neutro</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleAddMatch}
                disabled={isPending || !matchForm.event_date}
                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--aura-warn)', color: '#000', fontWeight: 700, cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}
              >
                {isPending ? 'A guardar...' : 'Guardar Jogo'}
              </button>
              <button
                onClick={() => setShowAddMatch(false)}
                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--aura-border)', background: 'transparent', color: 'var(--aura-text2)', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--aura-text3)', padding: '12px 0' }}>A carregar...</div>
        ) : matchDays.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)', padding: '16px 0', textAlign: 'center' }}>
            Nenhum jogo registado. Adiciona o primeiro jogo para activar os microciclos no dashboard.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {matchDays.map((e) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--aura-bg2)', border: '1px solid var(--aura-border)' }}>
                <Trophy size={13} style={{ color: 'var(--aura-warn)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--aura-text)', fontFamily: 'var(--font-dm-mono)', flexShrink: 0 }}>
                  {e.event_date}
                </span>
                <span style={{ fontSize: 11, color: 'var(--aura-text2)' }}>
                  {formatDisplayDate(e.event_date)}
                </span>
                {e.opponent && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--aura-text)' }}>
                    vs {e.opponent}
                  </span>
                )}
                {e.venue && (
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text3)', background: 'var(--aura-bg3)', padding: '1px 6px', borderRadius: 4 }}>
                    {VENUE_LABELS[e.venue] ?? e.venue}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(e.id)}
                  disabled={isPending}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--aura-text3)', display: 'flex', alignItems: 'center' }}
                  aria-label="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Training sessions section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Dumbbell size={15} style={{ color: 'var(--aura-blue)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
              Sessões de Treino
            </span>
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-dm-mono)', fontWeight: 700,
              padding: '1px 7px', borderRadius: 999,
              background: 'rgba(77,154,255,0.12)', color: 'var(--aura-blue)',
            }}>
              {trainings.length}
            </span>
          </div>
          <button
            onClick={() => { setShowAddTraining(true); setShowAddMatch(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, padding: '5px 10px', borderRadius: 6,
              border: '1px solid rgba(77,154,255,0.3)', background: 'rgba(77,154,255,0.06)',
              color: 'var(--aura-blue)', cursor: 'pointer', fontWeight: 600,
            }}
          >
            <Plus size={11} />
            Adicionar Sessão
          </button>
        </div>

        {/* Add training form */}
        {showAddTraining && (
          <div style={{ background: 'var(--aura-bg3)', border: '1px solid var(--aura-border)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text3)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Data</label>
                <input
                  type="date"
                  value={trainingForm.event_date}
                  onChange={(e) => setTrainingForm((f) => ({ ...f, event_date: e.target.value }))}
                  style={{ width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12, background: 'var(--aura-bg2)', border: '1px solid var(--aura-border)', color: 'var(--aura-text)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text3)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Tipo</label>
                <select
                  value={trainingForm.event_type}
                  onChange={(e) => setTrainingForm((f) => ({ ...f, event_type: e.target.value as typeof trainingForm.event_type }))}
                  style={{ width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12, background: 'var(--aura-bg2)', border: '1px solid var(--aura-border)', color: 'var(--aura-text)' }}
                >
                  <option value="training">Unidade de Treino (UT)</option>
                  <option value="recovery">Recovery</option>
                  <option value="rest">Folga</option>
                  <option value="travel">Viagem</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text3)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Etiqueta (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Ativação pré-jogo"
                  value={trainingForm.label}
                  onChange={(e) => setTrainingForm((f) => ({ ...f, label: e.target.value }))}
                  style={{ width: '100%', borderRadius: 6, padding: '6px 8px', fontSize: 12, background: 'var(--aura-bg2)', border: '1px solid var(--aura-border)', color: 'var(--aura-text)' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleAddTraining}
                disabled={isPending || !trainingForm.event_date}
                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--aura-blue)', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}
              >
                {isPending ? 'A guardar...' : 'Guardar Sessão'}
              </button>
              <button
                onClick={() => setShowAddTraining(false)}
                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--aura-border)', background: 'transparent', color: 'var(--aura-text2)', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {!loading && trainings.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)', padding: '16px 0', textAlign: 'center' }}>
            Nenhuma sessão de treino registada.
          </div>
        )}

        {trainings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {trainings.slice(0, 20).map((e) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--aura-bg2)', border: '1px solid var(--aura-border)' }}>
                <Calendar size={13} style={{ color: 'var(--aura-text3)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--aura-text)', fontFamily: 'var(--font-dm-mono)', flexShrink: 0 }}>
                  {e.event_date}
                </span>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text3)', background: 'var(--aura-bg3)', padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
                  {e.event_type}
                </span>
                {e.label && (
                  <span style={{ fontSize: 12, color: 'var(--aura-text2)' }}>{e.label}</span>
                )}
                <button
                  onClick={() => handleDelete(e.id)}
                  disabled={isPending}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--aura-text3)', display: 'flex', alignItems: 'center' }}
                  aria-label="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, padding: '12px 16px', borderRadius: 8, background: 'rgba(0,229,160,0.04)', border: '1px solid rgba(0,229,160,0.15)' }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-green)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Como funciona o cálculo do Microciclo
        </div>
        <div style={{ fontSize: 12, color: 'var(--aura-text2)', lineHeight: 1.5 }}>
          O dashboard calcula automaticamente a posição MD (Match Day) para cada dia.
          Se o próximo jogo é daqui a 3 dias → <strong>MD-3</strong>.
          Se o último jogo foi há 1 dia → <strong>MD+1</strong>.
          O número do microciclo (MC) é a sequência de jogos da temporada.
        </div>
      </div>
    </div>
  )
}
