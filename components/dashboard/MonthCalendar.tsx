'use client'

// Google-style month view for the dashboard: today is highlighted, past days
// are dimmed, and each day lists its calendar_events as coloured chips.
// Admin/coach users (the calendar_write RLS roles) can click a day to add an
// event or click a chip to edit/delete it; changes write to calendar_events —
// the same rows that drive the microcycle/MD badge and the occurrences page.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUiStore } from '@/stores/uiStore'
import { todayStr } from '@/lib/utils/microcycle'

export interface MonthCalendarEvent {
  id: string
  event_date: string
  event_type: string
  label: string | null
  is_match_day: boolean | null
  opponent: string | null
  venue: string | null
}

const TYPE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  match:    { bg: 'rgba(246,173,85,0.14)', color: 'var(--aura-warn)',   border: 'rgba(246,173,85,0.35)' },
  training: { bg: 'rgba(77,154,255,0.12)', color: 'var(--aura-blue)',   border: 'rgba(77,154,255,0.30)' },
  recovery: { bg: 'rgba(0,229,160,0.10)',  color: 'var(--aura-green)',  border: 'rgba(0,229,160,0.28)' },
  travel:   { bg: 'rgba(180,141,252,0.12)', color: 'var(--aura-purple)', border: 'rgba(180,141,252,0.30)' },
  rest:     { bg: 'rgba(255,255,255,0.05)', color: 'var(--aura-text3)', border: 'var(--aura-border)' },
}

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'match',    label: 'Jogo' },
  { value: 'training', label: 'Treino' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'travel',   label: 'Viagem' },
  { value: 'rest',     label: 'Folga' },
]

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function chipText(e: MonthCalendarEvent): string {
  return e.label ?? (e.opponent ? `vs ${e.opponent}` : e.event_type)
}

export function MonthCalendar({ events, initialDate }: { events: MonthCalendarEvent[]; initialDate?: string }) {
  const today = todayStr()
  const seed = initialDate ?? today
  const [year, setYear] = useState(Number(seed.slice(0, 4)))
  const [month, setMonth] = useState(Number(seed.slice(5, 7)) - 1) // 0-based

  const router = useRouter()
  const role = useUiStore((s) => s.role)
  const squads = useUiStore((s) => s.squads)
  const selectedSquadId = useUiStore((s) => s.selectedSquadId)
  const effectiveSquadId = selectedSquadId ?? squads[0]?.id ?? null
  const canManage = role === 'admin' || role === 'coach'

  // Local copy so edits reflect immediately without waiting for a full reload.
  const [items, setItems] = useState<MonthCalendarEvent[]>(events)
  const [editor, setEditor] = useState<{ date: string; event: MonthCalendarEvent | null } | null>(null)

  function navigate(delta: number) {
    const next = new Date(year, month + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
  }

  function handleSaved(saved: MonthCalendarEvent) {
    setItems((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id)
      if (idx === -1) return [...prev, saved]
      const copy = [...prev]
      copy[idx] = saved
      return copy
    })
    setEditor(null)
    router.refresh() // keep the microcycle/MD badge and other pages in sync
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((e) => e.id !== id))
    setEditor(null)
    router.refresh()
  }

  // Group events by date for O(1) cell lookups.
  const byDate = new Map<string, MonthCalendarEvent[]>()
  for (const e of items) {
    const list = byDate.get(e.event_date)
    if (list) list.push(e)
    else byDate.set(e.event_date, [e])
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7 // Monday-first
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  const cells: Array<{ day: number | null; key: string | null }> = []
  for (let i = 0; i < totalCells; i++) {
    const day = i - firstWeekday + 1
    if (day < 1 || day > daysInMonth) cells.push({ day: null, key: null })
    else cells.push({ day, key: dateKey(year, month, day) })
  }

  return (
    <div style={{ marginTop: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
          Calendário
        </span>
        {canManage && (
          <button
            onClick={() => { if (effectiveSquadId) setEditor({ date: today, event: null }) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
              padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--aura-border2)', background: 'var(--aura-bg3)', color: 'var(--aura-text2)',
            }}
          >
            <Plus size={12} /> Adicionar
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <button
            onClick={() => navigate(-1)}
            aria-label="Mês anterior"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: '1px solid var(--aura-border2)', background: 'var(--aura-bg3)', color: 'var(--aura-text2)', cursor: 'pointer' }}
          >
            <ChevronLeft size={13} />
          </button>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text)', minWidth: 120, textAlign: 'center' }}>
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={() => navigate(1)}
            aria-label="Próximo mês"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: '1px solid var(--aura-border2)', background: 'var(--aura-bg3)', color: 'var(--aura-text2)', cursor: 'pointer' }}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ fontSize: 9, fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--aura-text3)', textAlign: 'center', padding: '2px 0' }}>
            {w}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((cell, i) => {
          if (cell.day === null) {
            return <div key={`empty-${i}`} style={{ minHeight: 84, borderRadius: 8, background: 'transparent' }} />
          }
          const isToday = cell.key === today
          const isPast = cell.key! < today
          const dayEvents = byDate.get(cell.key!) ?? []
          return (
            <div
              key={cell.key}
              onClick={canManage && effectiveSquadId ? () => setEditor({ date: cell.key!, event: null }) : undefined}
              style={{
                minHeight: 84,
                borderRadius: 8,
                padding: '6px 6px 4px',
                background: isToday ? 'rgba(0,229,160,0.07)' : isPast ? 'var(--aura-bg)' : 'var(--aura-bg2)',
                border: isToday ? '1px solid var(--aura-green)' : '1px solid var(--aura-border)',
                opacity: isPast ? 0.5 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                overflow: 'hidden',
                cursor: canManage && effectiveSquadId ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-dm-mono)',
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? '#000' : 'var(--aura-text3)',
                    background: isToday ? 'var(--aura-green)' : 'transparent',
                    borderRadius: 999,
                    minWidth: 18,
                    height: 18,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  {cell.day}
                </span>
              </div>
              {dayEvents.slice(0, 3).map((e) => {
                const s = TYPE_STYLES[e.event_type] ?? TYPE_STYLES.training
                const text = chipText(e)
                return (
                  <div
                    key={e.id}
                    title={text}
                    onClick={canManage ? (ev) => { ev.stopPropagation(); setEditor({ date: e.event_date, event: e }) } : undefined}
                    style={{
                      fontSize: 9,
                      fontFamily: 'var(--font-dm-mono)',
                      lineHeight: 1.25,
                      padding: '2px 5px',
                      borderRadius: 4,
                      background: s.bg,
                      color: s.color,
                      border: `1px solid ${s.border}`,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: e.is_match_day ? 700 : 400,
                      cursor: canManage ? 'pointer' : 'default',
                    }}
                  >
                    {text}
                  </div>
                )
              })}
              {dayEvents.length > 3 && (
                <div style={{ fontSize: 8, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text3)', paddingLeft: 2 }}>
                  +{dayEvents.length - 3}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
        {TYPE_OPTIONS.map(({ value, label }) => {
          const s = TYPE_STYLES[value]
          return (
            <span key={value} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text3)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.bg, border: `1px solid ${s.border}`, display: 'inline-block' }} />
              {label}
            </span>
          )
        })}
        {canManage && (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text3)', marginLeft: 'auto' }}>
            Clica num dia para adicionar · num evento para editar
          </span>
        )}
      </div>

      {editor && effectiveSquadId && (
        <EventEditor
          date={editor.date}
          event={editor.event}
          squadId={effectiveSquadId}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}

function EventEditor({
  date, event, squadId, onClose, onSaved, onDeleted,
}: {
  date: string
  event: MonthCalendarEvent | null
  squadId: string
  onClose: () => void
  onSaved: (e: MonthCalendarEvent) => void
  onDeleted: (id: string) => void
}) {
  const [eventDate, setEventDate] = useState(event?.event_date ?? date)
  const [type, setType] = useState(event?.event_type ?? 'training')
  const [label, setLabel] = useState(event?.label ?? '')
  const [opponent, setOpponent] = useState(event?.opponent ?? '')
  const [venue, setVenue] = useState(event?.venue ?? 'home')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMatch = type === 'match'

  async function handleSave() {
    if (!eventDate) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const row = {
      event_date: eventDate,
      event_type: type,
      label: label.trim() || (isMatch ? (opponent ? `vs ${opponent}` : 'Jogo') : null),
      is_match_day: isMatch,
      opponent: isMatch ? (opponent.trim() || null) : null,
      venue: isMatch ? venue : null,
      squad_id: squadId,
    }
    const query = event
      ? supabase.from('calendar_events').update(row).eq('id', event.id).select('id, event_date, event_type, label, is_match_day, opponent, venue').single()
      : supabase.from('calendar_events').insert(row).select('id, event_date, event_type, label, is_match_day, opponent, venue').single()
    const { data, error: err } = await query
    setSaving(false)
    if (err || !data) {
      setError('Não foi possível guardar. Sem permissões ou erro de rede.')
      return
    }
    onSaved(data as MonthCalendarEvent)
  }

  async function handleDelete() {
    if (!event) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from('calendar_events').delete().eq('id', event.id)
    setSaving(false)
    if (err) {
      setError('Não foi possível eliminar. Sem permissões ou erro de rede.')
      return
    }
    onDeleted(event.id)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', borderRadius: 6, padding: '7px 9px', fontSize: 12,
    background: 'var(--aura-bg3)', border: '1px solid var(--aura-border2)', color: 'var(--aura-text)',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text3)',
    textTransform: 'uppercase', display: 'block', marginBottom: 4, letterSpacing: '0.06em',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--aura-bg2)', border: '1px solid var(--aura-border)', borderRadius: 14, padding: 20, width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
            {event ? 'Editar evento' : 'Adicionar evento'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--aura-text3)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Data</label>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {isMatch && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Adversário</label>
                <input type="text" placeholder="Ex: Benfica" value={opponent} onChange={(e) => setOpponent(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Local</label>
                <select value={venue} onChange={(e) => setVenue(e.target.value)} style={inputStyle}>
                  <option value="home">Casa</option>
                  <option value="away">Fora</option>
                  <option value="neutral">Neutro</option>
                </select>
              </div>
            </div>
          )}
          <div>
            <label style={labelStyle}>Etiqueta (opcional)</label>
            <input type="text" placeholder={isMatch ? 'Auto: vs adversário' : 'Ex: UT 12 (Estádio)'} value={label} onChange={(e) => setLabel(e.target.value)} style={inputStyle} />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--aura-danger)' }}>{error}</div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleSave}
              disabled={saving || !eventDate}
              style={{ fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 7, border: 'none', background: 'var(--aura-green)', color: '#000', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'A guardar…' : 'Guardar'}
            </button>
            <button
              onClick={onClose}
              style={{ fontSize: 12, padding: '7px 14px', borderRadius: 7, border: '1px solid var(--aura-border)', background: 'transparent', color: 'var(--aura-text2)', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            {event && (
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,77,109,0.3)', background: 'rgba(255,77,109,0.06)', color: 'var(--aura-danger)', cursor: 'pointer' }}
              >
                <Trash2 size={12} /> Eliminar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
