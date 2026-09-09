'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Sun, Sunset, Moon, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AthleteAvatar } from '@/components/ui/AthleteAvatar'
import { addDays, todayStr } from '@/lib/utils/microcycle'
import type { RehabPlanDay, RehabPlanPeriod } from '@/types/athlete-profile'

interface PlanRow {
  planId: string
  athleteId: string
  athleteName: string
  shirtNumber: number | null
  photoUrl: string | null
  position: string | null
  title: string
}

interface WeeklyCalendarViewProps {
  plans: PlanRow[]
  canEdit: boolean
  onCellClick?: (planId: string, date: string, period: RehabPlanPeriod) => void
}

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const PERIOD_ICONS = {
  morning:   <Sun size={9} />,
  afternoon: <Sunset size={9} />,
  night:     <Moon size={9} />,
} as const

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const day = d.getDay() // 0=Sun,1=Mon,...
  const diff = (day === 0 ? -6 : 1 - day)
  return addDays(dateStr, diff)
}

function formatHeader(dateStr: string): { dow: string; day: string; isToday: boolean } {
  const today = todayStr()
  const d = new Date(`${dateStr}T00:00:00`)
  return {
    dow: DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1],
    day: String(d.getDate()).padStart(2, '0'),
    isToday: dateStr === today,
  }
}

function CellContent({ entry }: { entry: RehabPlanDay | undefined }) {
  if (!entry) {
    return <div style={{ height: 20 }} />
  }
  if (entry.is_rest_day) {
    return (
      <div style={{
        fontSize: 9, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)',
        textAlign: 'center', padding: '2px 0',
      }}>
        Folga
      </div>
    )
  }
  return (
    <div style={{ fontSize: 10, color: 'var(--sophi-text)', lineHeight: 1.35 }}>
      {(entry.content ?? '').slice(0, 40)}{(entry.content ?? '').length > 40 ? '…' : ''}
    </div>
  )
}

export function WeeklyCalendarView({ plans, canEdit, onCellClick }: WeeklyCalendarViewProps) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayStr()))
  const [dayMap, setDayMap] = useState<Map<string, RehabPlanDay>>(new Map())
  const [loading, setLoading] = useState(false)

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = weekDates[6]

  useEffect(() => {
    if (!plans.length) { setDayMap(new Map()); return }
    let cancelled = false
    setLoading(true)
    const planIds = plans.map((p) => p.planId)
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('rehab_plan_days')
        .select('*')
        .in('plan_id', planIds)
        .gte('entry_date', weekStart)
        .lte('entry_date', weekEnd)
      if (cancelled) return
      const map = new Map<string, RehabPlanDay>()
      ;(data ?? []).forEach((d: RehabPlanDay) => { map.set(`${d.plan_id}|${d.entry_date}|${d.period}`, d) })
      setDayMap(map)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [weekStart, plans, weekEnd])

  function prevWeek() { setWeekStart((w) => addDays(w, -7)) }
  function nextWeek() { setWeekStart((w) => addDays(w, 7)) }

  const PERIODS: RehabPlanPeriod[] = ['morning', 'afternoon']

  if (!plans.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--sophi-text3)', fontSize: 12, fontFamily: 'var(--font-dm-mono)' }}>
        Sem planos activos para mostrar no calendário
      </div>
    )
  }

  return (
    <div>
      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={prevWeek} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: '1px solid var(--sophi-border2)', background: 'var(--sophi-bg3)', color: 'var(--sophi-text2)', cursor: 'pointer' }}>
          <ChevronLeft size={13} />
        </button>
        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 12, color: 'var(--sophi-text)' }}>
          {weekDates[0].slice(5).replace('-', '/')} — {weekDates[6].slice(5).replace('-', '/')}
        </span>
        <button onClick={nextWeek} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: '1px solid var(--sophi-border2)', background: 'var(--sophi-bg3)', color: 'var(--sophi-text2)', cursor: 'pointer' }}>
          <ChevronRight size={13} />
        </button>
        <button
          onClick={() => setWeekStart(mondayOf(todayStr()))}
          style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-green)', cursor: 'pointer', marginLeft: 4 }}
        >
          Esta semana
        </button>
        {loading && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--sophi-text3)', marginLeft: 'auto' }} />}
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
          <thead>
            <tr>
              {/* Athlete column header */}
              <th style={{
                width: 140, minWidth: 120, padding: '8px 12px', textAlign: 'left',
                fontSize: 9, fontFamily: 'var(--font-dm-mono)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'var(--sophi-text3)', borderBottom: '1px solid var(--sophi-border)',
                background: 'var(--sophi-bg2)',
              }}>
                Atleta
              </th>
              {weekDates.map((date) => {
                const h = formatHeader(date)
                return (
                  <th key={date} style={{
                    padding: '6px 4px', textAlign: 'center',
                    borderBottom: '1px solid var(--sophi-border)',
                    background: h.isToday ? 'rgba(0,229,160,0.05)' : 'var(--sophi-bg2)',
                    borderLeft: '1px solid var(--sophi-border)',
                  }}>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: h.isToday ? 'var(--sophi-green)' : 'var(--sophi-text3)' }}>{h.dow}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: h.isToday ? 'var(--sophi-green)' : 'var(--sophi-text)', marginTop: 1 }}>{h.day}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan, idx) => (
              <tr key={plan.planId} style={{ background: idx % 2 === 0 ? 'var(--sophi-bg)' : 'var(--sophi-bg2)' }}>
                {/* Athlete cell */}
                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--sophi-border)', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AthleteAvatar photoUrl={plan.photoUrl} shirtNumber={plan.shirtNumber} name={plan.athleteName} size={28} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sophi-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>{plan.athleteName}</div>
                      <div style={{ fontSize: 9, color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}>{plan.position}</div>
                    </div>
                  </div>
                </td>

                {/* Day cells */}
                {weekDates.map((date) => {
                  const h = formatHeader(date)
                  const entries = PERIODS.map((period) => ({
                    period,
                    entry: dayMap.get(`${plan.planId}|${date}|${period}`),
                  }))
                  const hasAny = entries.some((e) => e.entry)

                  return (
                    <td key={date} style={{
                      padding: 0, verticalAlign: 'top',
                      borderBottom: '1px solid var(--sophi-border)',
                      borderLeft: '1px solid var(--sophi-border)',
                      background: h.isToday ? 'rgba(0,229,160,0.03)' : undefined,
                      minWidth: 80,
                    }}>
                      {PERIODS.map((period) => {
                        const entry = dayMap.get(`${plan.planId}|${date}|${period}`)
                        const isEmpty = !entry
                        const isRestDay = entry?.is_rest_day

                        return (
                          <div
                            key={period}
                            onClick={() => canEdit && onCellClick?.(plan.planId, date, period)}
                            style={{
                              padding: '4px 6px',
                              minHeight: 30,
                              borderBottom: period === 'morning' ? '1px dashed var(--sophi-border)' : 'none',
                              cursor: canEdit ? 'pointer' : 'default',
                              background: isRestDay ? 'rgba(246,173,85,0.05)' : isEmpty ? undefined : 'rgba(0,229,160,0.04)',
                            }}
                            className={canEdit ? 'hover:bg-white/5 transition-colors' : ''}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                              <span style={{ color: period === 'morning' ? 'var(--sophi-warn)' : 'var(--sophi-purple)', opacity: 0.7, flexShrink: 0, marginTop: 1 }}>
                                {PERIOD_ICONS[period]}
                              </span>
                              <CellContent entry={entry} />
                            </div>
                          </div>
                        )
                      })}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 9, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Sun size={9} style={{ color: 'var(--sophi-warn)' }} /> Manhã
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Sunset size={9} style={{ color: 'var(--sophi-purple)' }} /> Tarde
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'rgba(246,173,85,0.3)' }} /> Folga
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'rgba(0,229,160,0.2)' }} /> Sessão planificada
        </span>
      </div>
    </div>
  )
}
