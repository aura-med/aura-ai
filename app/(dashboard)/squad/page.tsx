import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSquadIdParam } from '@/lib/squad-url'
import { calcScore, riskColor, riskLabel } from '@/lib/scoring'
import { todayStr } from '@/lib/utils/microcycle'
import { OWNER_ROLE, REHAB_ROLES, canManageAthletes } from '@/lib/roles'
import { getViewerContext } from '@/lib/data/auth'
import { listOrgClubs } from '@/lib/data/clubs'
import type { AthleteAvailabilityStatus, UserRole } from '@/types'
import { SquadClient } from './SquadClient'

// Own page for the roster view that used to be the Dashboard's "Plantel" tab
// (user feedback: wanted it as its own sidebar entry, not a dashboard tab).
// Data fetching mirrors app/(dashboard)/page.tsx's getData — same scoring
// inputs, same inactive/add-player gating — minus everything that page only
// needs for its own overview tab (occurrences/diagnoses/clinicalStaff/etc).
async function getData(squadId: string | null, date: string) {
  const supabase = await createClient()

  let athleteQuery = supabase
    .from('athletes')
    .select(`
      id, name, shirt_number, photo_url, position, club, date_of_birth,
      squad_id, nationality, menstrual_day, cycle_length,
      availability_status,
      wellness_checkins(*), injury_events(*)
    `)
    .eq('active', true)
    .order('shirt_number')
  if (squadId) athleteQuery = athleteQuery.eq('squad_id', squadId)
  const { data: athletes } = await athleteQuery

  const withScores = (athletes ?? []).map((a) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkins: any[] = a.wellness_checkins ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const injuries: any[] = a.injury_events ?? []
    const latest = checkins
      .filter((c: { checkin_date: string }) => c.checkin_date <= date)
      .sort((x: { checkin_date: string }, y: { checkin_date: string }) =>
        new Date(y.checkin_date).getTime() - new Date(x.checkin_date).getTime()
      )[0]
    const injuriesAsOf = injuries.filter((i: { injury_date?: string | null }) => !i.injury_date || i.injury_date <= date)
    const openAsOf = injuriesAsOf.filter((i: { return_date: string | null }) => !i.return_date || i.return_date > date)
    const inputs = {
      history: openAsOf.length >= 2 ? 2 : injuriesAsOf.length >= 1 ? 1 : 0,
      acwr: null, hrv: null,
      fatigue: latest?.fatigue ?? null, sleep: latest?.sleep_hours ?? null,
      tqr: latest?.tqr ?? null, stress: latest?.stress ?? null,
      decel: null, md: null,
    }
    const result = calcScore(inputs)
    return {
      id: a.id as string,
      name: a.name as string,
      shirt_number: a.shirt_number as number | null,
      photo_url: a.photo_url as string | null,
      position: a.position as string | null,
      club: a.club as string | null,
      date_of_birth: a.date_of_birth as string | null,
      squad_id: a.squad_id as string | null,
      nationality: a.nationality as string | null,
      menstrual_day: a.menstrual_day as number | null,
      cycle_length: a.cycle_length as number | null,
      availability_status: (a.availability_status as AthleteAvailabilityStatus | null) ?? 'available',
      score: result.score,
      scoreColor: riskColor(result.score),
      scoreLabel: riskLabel(result.score),
    }
  })

  // Disabled players (owner/doctor only) — shown via the "Inativos" toggle.
  let inactiveAthletes: {
    id: string; name: string; shirt_number: number | null; photo_url: string | null
    position: string | null; club: string | null
  }[] = []
  const { data: { user } } = await supabase.auth.getUser()
  const { data: viewerProfile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  const viewerRole = viewerProfile?.role ?? null
  if (canManageAthletes(viewerRole)) {
    let inactiveQuery = supabase
      .from('athletes')
      .select('id, name, shirt_number, photo_url, position, club')
      .eq('active', false)
      .order('shirt_number')
    if (squadId) inactiveQuery = inactiveQuery.eq('squad_id', squadId)
    const { data } = await inactiveQuery
    inactiveAthletes = data ?? []
  }

  return { athletes: withScores, inactiveAthletes }
}

export default async function SquadPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const params = searchParams ? await searchParams : {}
  const squadId = getSquadIdParam(params)
  const currentDate = todayStr()

  const { athletes, inactiveAthletes } = await getData(squadId, currentDate)

  // Mirrors athletes_insert RLS (018): owner, or doctor/physio on their own squads.
  const viewer = await getViewerContext()
  const canAddPlayer = viewer.role === OWNER_ROLE || REHAB_ROLES.includes(viewer.role as UserRole)
  const addPlayerSquads = canAddPlayer ? viewer.squads.map(({ id, name, type }) => ({ id, name, type })) : []
  const addPlayerOrg = canAddPlayer && viewer.org ? { type: viewer.org.type, name: viewer.org.name } : null
  const clubs = addPlayerOrg && addPlayerOrg.type !== 'club' && viewer.org
    ? await listOrgClubs(await createClient(), viewer.org.id)
    : []

  return (
    <SquadClient
      athletes={athletes}
      squadId={squadId}
      canAddPlayer={canAddPlayer}
      canManage={canManageAthletes(viewer.role)}
      inactiveAthletes={inactiveAthletes}
      addPlayerSquads={addPlayerSquads}
      addPlayerOrg={addPlayerOrg}
      clubs={clubs}
    />
  )
}
