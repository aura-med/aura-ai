import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSquadIdParam } from '@/lib/squad-url'
import { todayStr, addDays } from '@/lib/utils/microcycle'
import { MonthCalendar } from '@/components/dashboard/MonthCalendar'

// Own page for the month view that used to be the Dashboard's "Calendário"
// tab (user feedback: wanted it as its own sidebar entry). Not the same as
// the separate, still-in-development /calendar ("Calendar Intelligence")
// page — this is the real, working training/match calendar.
async function getData(squadId: string | null, date: string) {
  const supabase = await createClient()

  // Wide window so the client can flip months without refetching (season
  // calendars are small) — same range the Dashboard's own fetch used.
  let eventsQuery = supabase
    .from('calendar_events')
    .select('id, event_date, event_type, label, is_match_day, opponent, venue')
    .gte('event_date', addDays(date, -90))
    .lte('event_date', addDays(date, 180))
    .order('event_date')
    .limit(500)
  if (squadId) eventsQuery = eventsQuery.eq('squad_id', squadId)
  const { data: calendarEvents } = await eventsQuery

  return { calendarEvents: calendarEvents ?? [] }
}

export default async function TeamCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const params = searchParams ? await searchParams : {}
  const squadId = getSquadIdParam(params)
  const currentDate = todayStr()

  const { calendarEvents } = await getData(squadId, currentDate)

  // No extra page header here — MonthCalendar renders its own "Calendário"
  // label alongside the Adicionar control, so a sec-hdr would just repeat it.
  return (
    <MonthCalendar
      key={`${squadId ?? 'all'}-${currentDate.slice(0, 7)}`}
      events={calendarEvents}
      initialDate={currentDate}
    />
  )
}
