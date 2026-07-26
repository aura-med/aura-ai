import { createClient } from '@/lib/supabase/server'
import { getSquadIdParam } from '@/lib/squad-url'
import { calcScore, riskColor, riskLabel } from '@/lib/scoring'
import { calculateMDStatus, todayStr, addDays } from '@/lib/utils/microcycle'
import { DashboardClient } from './DashboardClient'

async function getData(squadId: string | null, date: string) {
  const supabase = await createClient()

  let athleteQuery = supabase
    .from('athletes')
    .select(`
      id, name, shirt_number, photo_url, position, club, status,
      availability_status,
      wellness_checkins(*), injury_events(*), score_history(*)
    `)
    .eq('active', true)
    .order('shirt_number')

  if (squadId) athleteQuery = athleteQuery.eq('squad_id', squadId)

  const { data: athletes } = await athleteQuery

  // Fetch match days for microcycle calculation
  let matchQuery = supabase
    .from('calendar_events')
    .select('event_date')
    .eq('is_match_day', true)
    .order('event_date')

  if (squadId) matchQuery = matchQuery.eq('squad_id', squadId)

  const { data: matchEvents } = await matchQuery

  const matchDays = (matchEvents ?? []).map((e: { event_date: string }) => e.event_date)
  const microcycle = calculateMDStatus(date, matchDays)

  // Calendar events for the dashboard month view — a wide window so the
  // client can flip months without refetching (season calendars are small).
  let eventsQuery = supabase
    .from('calendar_events')
    .select('id, event_date, event_type, label, is_match_day, opponent, venue')
    .gte('event_date', addDays(date, -90))
    .lte('event_date', addDays(date, 180))
    .order('event_date')
    .limit(500)
  if (squadId) eventsQuery = eventsQuery.eq('squad_id', squadId)
  const { data: calendarEvents } = await eventsQuery

  return { athletes: athletes ?? [], microcycle, calendarEvents: calendarEvents ?? [] }
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const squadId = getSquadIdParam(params)
  const today = todayStr()
  const rawDate = params?.date
  // Only accept a well-formed, parseable YYYY-MM-DD — a malformed ?date= would
  // make addDays() throw on an Invalid Date and 500 the dashboard.
  const currentDate =
    typeof rawDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(rawDate) &&
    !Number.isNaN(new Date(`${rawDate}T00:00:00`).getTime())
      ? rawDate
      : today
  const isToday = currentDate === today

  const { athletes, microcycle, calendarEvents } = await getData(squadId, currentDate)

  const withScores = athletes.map((a) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkins: any[] = a.wellness_checkins ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const injuries: any[] = a.injury_events ?? []

    // Use the latest check-in that is not newer than the displayed day, so a
    // historical date (previous/next-day controls) shows that day's readiness
    // rather than a future check-in. checkin_date is ISO YYYY-MM-DD, so string
    // comparison orders correctly.
    const latest = checkins
      .filter((c: { checkin_date: string }) => c.checkin_date <= currentDate)
      .sort((x: { checkin_date: string }, y: { checkin_date: string }) =>
        new Date(y.checkin_date).getTime() - new Date(x.checkin_date).getTime()
      )[0]

    // Compute injury history as of the displayed day: only injuries that had
    // occurred by then, treated as open if they had no return date yet on that
    // day. Otherwise a historical date (or its PDF) would count a future injury
    // or use an injury's present open/closed state instead of the day's.
    const injuriesAsOf = injuries.filter(
      (i: { injury_date?: string | null }) => !i.injury_date || i.injury_date <= currentDate
    )
    const openAsOf = injuriesAsOf.filter(
      (i: { return_date: string | null }) => !i.return_date || i.return_date > currentDate
    )

    const inputs = {
      history: openAsOf.length >= 2 ? 2
        : injuriesAsOf.length >= 1 ? 1 : 0,
      acwr: null,
      hrv: null,
      fatigue: latest?.fatigue ?? null,
      sleep: latest?.sleep_hours ?? null,
      tqr: latest?.tqr ?? null,
      stress: latest?.stress ?? null,
      decel: null,
      md: null,
    }

    const result = calcScore(inputs)
    const availabilityStatus = (a.availability_status as string) ?? 'available'

    return {
      id: a.id as string,
      name: a.name as string,
      shirt_number: a.shirt_number as number | null,
      photo_url: (a as { photo_url?: string | null }).photo_url ?? null,
      position: a.position as string | null,
      club: a.club as string | null,
      status: a.status as string,
      availability_status: (availabilityStatus as 'available' | 'evaluation' | 'unavailable' | 'rtp'),
      score: result.score,
      scoreColor: riskColor(result.score),
      scoreLabel: riskLabel(result.score),
    }
  })

  return (
    <DashboardClient
      athletes={withScores}
      squadId={squadId}
      currentDate={currentDate}
      microcycle={microcycle}
      isToday={isToday}
      calendarEvents={calendarEvents}
    />
  )
}
