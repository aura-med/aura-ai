'use client'

// Google-style month view for the dashboard: today is highlighted, past days
// are dimmed, and each day lists its calendar_events as coloured chips.
// Owner/coach users (the calendar_write RLS roles) can click a day to add an
// event or click a chip to edit/delete it; changes write to calendar_events —
// the same rows that drive the microcycle/MD badge and the occurrences page.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, X, Plus, Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUiStore } from '@/stores/uiStore'
import { todayStr, formatDisplayDate, addDays, clubMidnightUTC } from '@/lib/utils/microcycle'
import { isOwner, CLINICAL_ROLES } from '@/lib/roles'
import { STATUS_CONFIG } from '@/components/occurrences/OccurrenceRow'
import { withSquadParam } from '@/lib/squad-url'
import type { AthleteAvailabilityStatus } from '@/types'

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
  match:    { bg: 'rgba(246,173,85,0.14)', color: 'var(--sophi-warn)',   border: 'rgba(246,173,85,0.35)' },
  training: { bg: 'rgba(77,154,255,0.12)', color: 'var(--sophi-blue)',   border: 'rgba(77,154,255,0.30)' },
  recovery: { bg: 'rgba(0,229,160,0.10)',  color: 'var(--sophi-green)',  border: 'rgba(0,229,160,0.28)' },
  travel:   { bg: 'rgba(180,141,252,0.12)', color: 'var(--sophi-purple)', border: 'rgba(180,141,252,0.30)' },
  rest:     { bg: 'rgba(255,255,255,0.05)', color: 'var(--sophi-text3)', border: 'var(--sophi-border)' },
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
  const canManage = isOwner(role) || role === 'coach'
  // Only roles the occurrences/occurrence_records/diagnoses RLS policies
  // (018) actually grant SELECT to — offering the history panel to anyone
  // else would just show a misleading "no activity" on days that do have it.
  const canReadClinical = isOwner(role) || CLINICAL_ROLES.includes(role)

  // Local copy so edits reflect immediately without waiting for a full reload.
  const [items, setItems] = useState<MonthCalendarEvent[]>(events)
  const [editor, setEditor] = useState<{ date: string; event: MonthCalendarEvent | null } | null>(null)
  const [historyDate, setHistoryDate] = useState<string | null>(null)

  // The server only preloads a fixed window (-90/+180 days from today — see
  // app/(dashboard)/page.tsx's own eventsQuery, mirrored here since both call
  // the same addDays/todayStr helpers) — flipping months with the arrows is
  // otherwise unrestricted and never refetches, so a month outside that
  // window would silently render with no events even when some genuinely
  // exist. Fetch a month's events on demand the first time it's navigated
  // to; loadedMonths avoids re-fetching a month (e.g. one already covered by
  // the initial window) more than once per mount.
  const [loadedMonths] = useState(() => new Set<string>())
  const serverWindowStart = addDays(today, -90)
  const serverWindowEnd = addDays(today, 180)

  // Re-sync when the source events change (squad switch, date-range refresh, or
  // router.refresh() after a write) — but MERGE rather than replace: a blind
  // replace would also discard any on-demand-fetched out-of-window events
  // (including one just saved/deleted in a month outside the server's own
  // window), even though loadedMonths still thinks that month is loaded, so
  // it wouldn't be refetched until the component remounts. Keep whatever the
  // fresh server props say about the window and preserve on-demand items
  // outside it — UNLESS the squad itself changed: those out-of-window items
  // were fetched under the *previous* squad's filter (ensureMonthLoaded
  // closes over effectiveSquadId), so merging them forward would leak one
  // squad's schedule into another's view and — worse — let an edit on one
  // of them submit the new squad's squad_id, silently moving the event.
  // loadedMonths isn't squad-scoped either, so it must be cleared too or a
  // revisited out-of-window month would wrongly look "already loaded" and
  // never get refetched for the new squad. Adjusted during render (React's
  // recommended prop->state sync pattern) rather than in an effect, which
  // would trigger an extra render pass.
  const [prevEvents, setPrevEvents] = useState(events)
  const [prevSquadId, setPrevSquadId] = useState(effectiveSquadId)
  // Bumped whenever the squad changes so an ensureMonthLoaded fetch already
  // in flight for the previous squad can tell, once it resolves, that it's
  // stale — the synchronous reset below only clears what's already in state,
  // it can't cancel a pending network request. Plain mutable object (like
  // loadedMonths below) rather than useRef — the lint rule against reading/
  // writing refs during render doesn't apply to state-held plain objects.
  const [squadEpoch] = useState(() => ({ current: 0, bump() { this.current += 1 } }))
  if (effectiveSquadId !== prevSquadId) {
    setPrevSquadId(effectiveSquadId)
    setPrevEvents(events)
    squadEpoch.bump()
    loadedMonths.clear()
    // Clear rather than seed from `events` — at this exact render, `events`
    // is still the OLD squad's server-fetched data; the parent Server
    // Component only refetches it after the squad-switch navigation
    // completes, which can't happen within this synchronous render. Seeding
    // items from it would republish the old squad's event chips under the
    // new squad's context — a coach who clicks one before that navigation
    // resolves would open an editor stamped with the NEW squadId for an
    // event that actually belongs to the OLD one, silently moving it on
    // save. Leaving items empty until either ensureMonthLoaded below (for
    // the currently displayed month) or the genuinely-fresh `events` prop
    // (via the events !== prevEvents branch, once navigation completes)
    // repopulates it is safe: an empty calendar is a stale-data risk to no
    // one, unlike showing the wrong squad's data as if it belonged here.
    setItems([])
    // The editor form caches the event/date it was opened for, but its
    // squadId prop always tracks the current squad — saving after a squad
    // switch would submit the NEW squad's id for an event that belongs to
    // the OLD one, silently moving it. Close it; the day-history panel
    // doesn't need the same treatment since it re-fetches by squadId itself.
    setEditor(null)
    // The currently displayed month may be outside the server's preload
    // window (e.g. the user navigated forward before switching squads) —
    // the reset above cleared it from `items`/`loadedMonths`, but nothing
    // else re-fetches it for the new squad until the user navigates away
    // and back. Queue it now.
    void ensureMonthLoaded(year, month)
  } else if (events !== prevEvents) {
    setPrevEvents(events)
    setItems((prev) => [
      ...events,
      ...prev.filter((e) => (e.event_date < serverWindowStart || e.event_date > serverWindowEnd) && !events.some((fresh) => fresh.id === e.id)),
    ])
  }

  async function ensureMonthLoaded(y: number, m: number) {
    const key = `${y}-${m}`
    if (loadedMonths.has(key)) return
    const requestSquadEpoch = squadEpoch.current
    const supabase = createClient()
    const start = dateKey(y, m, 1)
    const end = dateKey(y, m, new Date(y, m + 1, 0).getDate())
    let q = supabase
      .from('calendar_events')
      .select('id, event_date, event_type, label, is_match_day, opponent, venue')
      .gte('event_date', start)
      .lte('event_date', end)
    if (effectiveSquadId) q = q.eq('squad_id', effectiveSquadId)
    const { data, error } = await q
    // Discard a response that resolved after the user switched squads — it
    // was fetched under the squad this closure captured at call time, which
    // may no longer be the current one, and the render-time reset above has
    // no way to cancel an in-flight request.
    if (requestSquadEpoch !== squadEpoch.current) return
    // Only mark the month loaded once the fetch actually succeeds — a
    // transient DB/network failure must not permanently block retrying it;
    // marking it upfront (before the request completed) would leave the
    // month showing an empty calendar for the rest of the session even
    // after the failure clears.
    if (error || !data) return
    loadedMonths.add(key)
    setItems((prev) => {
      const ids = new Set(prev.map((e) => e.id))
      const fresh = data.filter((e) => !ids.has(e.id))
      return fresh.length ? [...prev, ...fresh] : prev
    })
  }

  function navigate(delta: number) {
    const next = new Date(year, month + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
    void ensureMonthLoaded(next.getFullYear(), next.getMonth())
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
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}>
          Calendário
        </span>
        {canManage && (
          <button
            onClick={() => { if (effectiveSquadId) setEditor({ date: today, event: null }) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
              padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--sophi-border2)', background: 'var(--sophi-bg3)', color: 'var(--sophi-text2)',
            }}
          >
            <Plus size={12} /> Adicionar
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <button
            onClick={() => navigate(-1)}
            aria-label="Mês anterior"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: '1px solid var(--sophi-border2)', background: 'var(--sophi-bg3)', color: 'var(--sophi-text2)', cursor: 'pointer' }}
          >
            <ChevronLeft size={13} />
          </button>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text)', minWidth: 120, textAlign: 'center' }}>
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={() => navigate(1)}
            aria-label="Próximo mês"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: '1px solid var(--sophi-border2)', background: 'var(--sophi-bg3)', color: 'var(--sophi-text2)', cursor: 'pointer' }}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ fontSize: 9, fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--sophi-text3)', textAlign: 'center', padding: '2px 0' }}>
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
              onClick={canReadClinical ? () => setHistoryDate(cell.key!) : undefined}
              style={{
                minHeight: 84,
                borderRadius: 8,
                padding: '6px 6px 4px',
                background: isToday ? 'rgba(0,229,160,0.07)' : isPast ? 'var(--sophi-bg)' : 'var(--sophi-bg2)',
                border: isToday ? '1px solid var(--sophi-green)' : '1px solid var(--sophi-border)',
                opacity: isPast ? 0.5 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                overflow: 'hidden',
                cursor: canReadClinical ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {canManage && effectiveSquadId ? (
                  <button
                    onClick={(ev) => { ev.stopPropagation(); setEditor({ date: cell.key!, event: null }) }}
                    aria-label="Adicionar evento"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16,
                      borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--sophi-text3)', cursor: 'pointer',
                    }}
                  >
                    <Plus size={11} />
                  </button>
                ) : <span />}
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-dm-mono)',
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? '#000' : 'var(--sophi-text3)',
                    background: isToday ? 'var(--sophi-green)' : 'transparent',
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
                <div style={{ fontSize: 8, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', paddingLeft: 2 }}>
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
            <span key={value} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.bg, border: `1px solid ${s.border}`, display: 'inline-block' }} />
              {label}
            </span>
          )
        })}
        {canReadClinical && (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', marginLeft: 'auto' }}>
            {canManage
              ? 'Clica num dia para ver o histórico · no + para adicionar evento'
              : 'Clica num dia para ver o histórico'}
          </span>
        )}
      </div>

      {historyDate && canReadClinical && (
        <DayHistoryPanel date={historyDate} squadId={effectiveSquadId} onClose={() => setHistoryDate(null)} />
      )}

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
    background: 'var(--sophi-bg3)', border: '1px solid var(--sophi-border2)', color: 'var(--sophi-text)',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)',
    textTransform: 'uppercase', display: 'block', marginBottom: 4, letterSpacing: '0.06em',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)', borderRadius: 14, padding: 20, width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}>
            {event ? 'Editar evento' : 'Adicionar evento'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sophi-text3)' }}>
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
            <div style={{ fontSize: 12, color: 'var(--sophi-danger)' }}>{error}</div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleSave}
              disabled={saving || !eventDate}
              style={{ fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 7, border: 'none', background: 'var(--sophi-green)', color: '#000', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'A guardar…' : 'Guardar'}
            </button>
            <button
              onClick={onClose}
              style={{ fontSize: 12, padding: '7px 14px', borderRadius: 7, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-text2)', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            {event && (
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,77,109,0.3)', background: 'rgba(255,77,109,0.06)', color: 'var(--sophi-danger)', cursor: 'pointer' }}
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

// ── Day history panel ─────────────────────────────────────────────────────
// Clicking a day shows what actually happened clinically that day: new
// occurrences opened, reassessments logged, and diagnoses made — each with
// the availability decision recorded at the time. Not a reconstruction of
// "everyone's status as of that day" (the app has no reliable status-history
// source for that — see app/(dashboard)/page.tsx's own note on this), just
// the dated clinical events themselves.

interface DayHistoryRow {
  id: string
  athleteId: string
  athleteName: string
  kind: 'occurrence' | 'reassessment' | 'diagnosis'
  description: string
  status: AthleteAvailabilityStatus | null
}

function DayHistoryPanel({ date, squadId, onClose }: { date: string; squadId: string | null; onClose: () => void }) {
  const [rows, setRows] = useState<DayHistoryRow[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  // Reset immediately when date/squadId change, before the fetch below even
  // starts — otherwise switching squads (or reopening for a different date)
  // keeps showing the previous squad's athlete names/rows, or a stale
  // error, until the new request resolves. Adjusted during render (same
  // prop->state sync pattern MonthCalendar's own squad-change reset uses)
  // rather than at the top of the effect, which a request to synchronize
  // external state, not to reset local state as a side effect of a prop
  // change.
  const [prevKey, setPrevKey] = useState(`${date}:${squadId}`)
  const key = `${date}:${squadId}`
  if (key !== prevKey) {
    setPrevKey(key)
    setRows(null)
    setLoadError(false)
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const supabase = createClient()

      // occurrences.squad_id is frozen at creation (016) — filtering on it
      // directly would miss (or wrongly include) an athlete's occurrences
      // after a later squad transfer. Filter through the athletes relation
      // instead, same as the reassessment/diagnosis queries below, so all
      // three rely on the one authoritative, current squad_id.
      const occQuery = supabase
        .from('occurrences')
        .select('id, athlete_id, title, occurrence_type, athletes ( name, squad_id )')
        .eq('occurrence_date', date)

      const recQuery = supabase
        .from('occurrence_records')
        .select('id, athlete_id, assessment, athletes ( name, squad_id )')
        .eq('record_date', date)

      // `date` is a CLUB-calendar day (todayStr()/the calendar grid are both
      // built from NEXT_PUBLIC_CLUB_TIMEZONE, not the viewer's own) — bounds
      // must be that day's midnight-to-midnight window in the CLUB's
      // timezone, not the viewer's browser timezone (which can differ: a
      // clinician traveling, or just a misconfigured OS clock). A plain
      // `new Date("YYYY-MM-DDTHH:mm:ss")` parses in the VIEWER's local time,
      // which would misplace a diagnosis logged near either boundary under
      // the adjacent day whenever the two timezones don't match. Naive
      // "YYYY-MM-DDT00:00:00" strings sent directly to PostgREST have the
      // same problem in the database's own timezone. clubMidnightUTC pins
      // both bounds to the club's configured timezone specifically.
      const dayStart = clubMidnightUTC(date)
      const dayEnd = clubMidnightUTC(addDays(date, 1))

      const diagQuery = supabase
        .from('diagnoses')
        .select('id, athlete_id, osiics_description, custom_description, athletes ( name, squad_id )')
        .gte('diagnosed_at', dayStart.toISOString())
        .lt('diagnosed_at', dayEnd.toISOString())

      const [{ data: occ, error: occErr }, { data: rec, error: recErr }, { data: diag, error: diagErr }] =
        await Promise.all([occQuery, recQuery, diagQuery])
      if (cancelled) return

      // A transient DB/network failure resolves as { data: null, error }, not
      // a rejection — treating it as "no data" would render the empty state
      // ("Sem ocorrências...") for a day that may well have real history.
      if (occErr || recErr || diagErr) {
        setLoadError(true)
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const athleteOf = (a: any): { name: string; squad_id?: string | null } | null => (Array.isArray(a) ? a[0] ?? null : a ?? null)

      const occRows: DayHistoryRow[] = (occ ?? [])
        .filter((o) => !squadId || athleteOf(o.athletes)?.squad_id === squadId)
        .map((o) => ({
          id: o.id, athleteId: o.athlete_id,
          athleteName: athleteOf(o.athletes)?.name ?? '—',
          kind: 'occurrence',
          description: o.title || o.occurrence_type || '—',
          // Unlike a reassessment/diagnosis row (each an immutable snapshot
          // of what was decided that day), an occurrence's own
          // availability_status gets overwritten by any LATER reassessment
          // or diagnosis — so it can no longer be trusted to reflect what
          // was actually decided on this occurrence's opening day. Omit
          // rather than show a possibly much later status as if it were
          // recorded here.
          status: null,
        }))
      const recRows: DayHistoryRow[] = (rec ?? [])
        .filter((r) => !squadId || athleteOf(r.athletes)?.squad_id === squadId)
        .map((r) => ({
          id: r.id, athleteId: r.athlete_id,
          athleteName: athleteOf(r.athletes)?.name ?? '—',
          kind: 'reassessment',
          description: r.assessment || '—',
          // updateOccurrenceRecord can edit both this record's own status and
          // its record_date after the fact, independent of each other — so,
          // like the occurrence row above, this is not a reliable point-in-
          // time snapshot of what was decided on this specific day.
          status: null,
        }))
      const diagRows: DayHistoryRow[] = (diag ?? [])
        .filter((d) => !squadId || athleteOf(d.athletes)?.squad_id === squadId)
        .map((d) => ({
          id: d.id, athleteId: d.athlete_id,
          athleteName: athleteOf(d.athletes)?.name ?? '—',
          kind: 'diagnosis',
          description: d.osiics_description || d.custom_description || '—',
          // updateDiagnosis can change availability_status well after
          // diagnosed_at (the immutable creation day used to select this
          // row) — showing it here would attribute a later decision to the
          // original day.
          status: null,
        }))

      setRows([...occRows, ...recRows, ...diagRows])
    }
    load()
    return () => { cancelled = true }
  }, [date, squadId])

  const KIND_LABELS: Record<DayHistoryRow['kind'], string> = {
    occurrence: 'Nova ocorrência', reassessment: 'Reavaliação', diagnosis: 'Diagnóstico',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)', borderRadius: 14, padding: 20, width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}>
            {formatDisplayDate(date)}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sophi-text3)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loadError ? (
            <p style={{ fontSize: 12, color: 'var(--sophi-danger)', textAlign: 'center', padding: '16px 0' }}>
              Não foi possível carregar o histórico deste dia. Tenta novamente.
            </p>
          ) : rows === null ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--sophi-text3)' }} />
            </div>
          ) : rows.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--sophi-text3)', textAlign: 'center', padding: '16px 0' }}>
              Sem ocorrências, reavaliações ou diagnósticos registados neste dia
            </p>
          ) : (
            rows.map((r) => {
              const cfg = r.status ? STATUS_CONFIG[r.status] : null
              return (
                <Link key={`${r.kind}-${r.id}`} href={withSquadParam(`/athletes/${r.athleteId}`, squadId)} style={{ textDecoration: 'none' }}>
                  <div style={{ borderRadius: 8, border: '1px solid var(--sophi-border)', background: 'var(--sophi-bg3)', padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sophi-text)' }}>{r.athleteName}</span>
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {KIND_LABELS[r.kind]}
                      </span>
                      {cfg && (
                        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--sophi-text2)' }}>{r.description}</p>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
