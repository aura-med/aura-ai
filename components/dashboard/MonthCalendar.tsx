'use client'

// Google-style month view for the dashboard: today is highlighted, past days
// are dimmed, and each day lists its calendar_events as coloured chips.
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { todayStr } from '@/lib/utils/microcycle'

export interface MonthCalendarEvent {
  event_date: string
  event_type: string
  label: string | null
  is_match_day: boolean | null
  opponent: string | null
}

const TYPE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  match:    { bg: 'rgba(246,173,85,0.14)', color: 'var(--aura-warn)',   border: 'rgba(246,173,85,0.35)' },
  training: { bg: 'rgba(77,154,255,0.12)', color: 'var(--aura-blue)',   border: 'rgba(77,154,255,0.30)' },
  recovery: { bg: 'rgba(0,229,160,0.10)',  color: 'var(--aura-green)',  border: 'rgba(0,229,160,0.28)' },
  travel:   { bg: 'rgba(180,141,252,0.12)', color: 'var(--aura-purple)', border: 'rgba(180,141,252,0.30)' },
  rest:     { bg: 'rgba(255,255,255,0.05)', color: 'var(--aura-text3)', border: 'var(--aura-border)' },
}

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function MonthCalendar({ events }: { events: MonthCalendarEvent[] }) {
  const today = todayStr()
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1]
  const [year, setYear] = useState(ty)
  const [month, setMonth] = useState(tm) // 0-based

  function navigate(delta: number) {
    const next = new Date(year, month + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
  }

  // Group events by date for O(1) cell lookups.
  const byDate = new Map<string, MonthCalendarEvent[]>()
  for (const e of events) {
    const list = byDate.get(e.event_date)
    if (list) list.push(e)
    else byDate.set(e.event_date, [e])
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Monday-first offset: JS getDay() is 0=Sunday.
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  const cells: Array<{ day: number | null; key: string | null }> = []
  for (let i = 0; i < totalCells; i++) {
    const day = i - firstWeekday + 1
    if (day < 1 || day > daysInMonth) cells.push({ day: null, key: null })
    else cells.push({ day, key: dateKey(year, month, day) })
  }

  return (
    <div style={{ marginTop: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}>
          Calendário
        </span>
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
              {dayEvents.slice(0, 3).map((e, j) => {
                const s = TYPE_STYLES[e.event_type] ?? TYPE_STYLES.training
                const text = e.label ?? (e.opponent ? `vs ${e.opponent}` : e.event_type)
                return (
                  <div
                    key={j}
                    title={text}
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
        {[['match', 'Jogo'], ['training', 'Treino'], ['recovery', 'Recovery'], ['travel', 'Viagem'], ['rest', 'Folga']].map(([type, label]) => {
          const s = TYPE_STYLES[type]
          return (
            <span key={type} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-text3)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.bg, border: `1px solid ${s.border}`, display: 'inline-block' }} />
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
