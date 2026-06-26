import { createClient } from '@/lib/supabase/server'
import { getSquadIdParam } from '@/lib/squad-url'
import { calcScore, riskColor, riskLabel } from '@/lib/scoring'
import { calculateMDStatus, todayStr } from '@/lib/utils/microcycle'
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

  return { athletes: athletes ?? [], microcycle }
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
  const currentDate = typeof rawDate === 'string' ? rawDate : today
  const isToday = currentDate === today

  const { athletes, microcycle } = await getData(squadId, currentDate)

  const withScores = athletes.map((a) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkins: any[] = a.wellness_checkins ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const injuries: any[] = a.injury_events ?? []

    const latest = checkins
      .sort((x: { checkin_date: string }, y: { checkin_date: string }) =>
        new Date(y.checkin_date).getTime() - new Date(x.checkin_date).getTime()
      )[0]

    const inputs = {
      history: injuries.filter((i: { return_date: string | null }) => !i.return_date).length >= 2 ? 2
        : injuries.length >= 1 ? 1 : 0,
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
    />
  )
}
