import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSquadIdParam } from '@/lib/squad-url'
import { calculateMDStatus, todayStr } from '@/lib/utils/microcycle'
import { OccurrencesClient } from './OccurrencesClient'

async function getData(squadId: string | null, date: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get viewer's profile for clinician name/role
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, org_id')
    .eq('id', user?.id ?? '')
    .single()

  const orgId = profile?.org_id ?? ''

  // Get athletes for the squad
  let athleteQuery = supabase
    .from('athletes')
    .select('id, name, shirt_number, photo_url, position, availability_status')
    .eq('active', true)
    .order('shirt_number')
  if (squadId) athleteQuery = athleteQuery.eq('squad_id', squadId)
  const { data: athletes } = await athleteQuery

  // Get occurrences for this org (with athletes and records)
  let occQuery = supabase
    .from('occurrences')
    .select(`
      id, athlete_id, title, occurrence_date, occurrence_type,
      subjective, objective, assessment, plan,
      availability_status, clinician_name, clinician_role,
      is_resolved, resolved_at, microcycle_number,
      athletes ( id, name, shirt_number, photo_url, position, availability_status ),
      occurrence_records ( id, record_date, subjective, objective, assessment, plan, availability_status, clinician_name, created_at ),
      diagnoses ( id, osiics_description, custom_description, availability_status, is_resolved )
    `)
    .eq('org_id', orgId)
    .order('is_resolved', { ascending: true })
    .order('occurrence_date', { ascending: false })

  if (squadId) {
    const athleteIds = (athletes ?? []).map((a: { id: string }) => a.id)
    if (athleteIds.length) {
      occQuery = occQuery.in('athlete_id', athleteIds)
    } else {
      // Squad has no athletes — return empty set without leaking other squads' data.
      occQuery = occQuery.is('athlete_id', null)
    }
  }

  const { data: occurrences } = await occQuery

  // Get match days for microcycle
  let matchQuery = supabase
    .from('calendar_events')
    .select('event_date')
    .eq('is_match_day', true)
    .order('event_date')
  if (squadId) matchQuery = matchQuery.eq('squad_id', squadId)
  const { data: matchEvents } = await matchQuery

  const matchDays = (matchEvents ?? []).map((e: { event_date: string }) => e.event_date)
  const microcycle = calculateMDStatus(date, matchDays)

  // Supabase infers the to-one `athletes` relation as an array — normalise to
  // a single object so the runtime shape matches the client component's types.
  type RawOccurrence = Omit<
    Parameters<typeof OccurrencesClient>[0]['occurrences'][number],
    'athletes'
  > & { athletes: Parameters<typeof OccurrencesClient>[0]['athletes'][number] | Array<Parameters<typeof OccurrencesClient>[0]['athletes'][number]> }

  const normalisedOccurrences = ((occurrences ?? []) as unknown as RawOccurrence[]).map((o) => ({
    ...o,
    athletes: Array.isArray(o.athletes) ? o.athletes[0] : o.athletes,
  })) as Parameters<typeof OccurrencesClient>[0]['occurrences']

  return {
    occurrences: normalisedOccurrences,
    athletes: (athletes ?? []) as Parameters<typeof OccurrencesClient>[0]['athletes'],
    orgId,
    clinicianName: profile?.full_name ?? '',
    clinicianRole: profile?.role ?? '',
    microcycle,
    matchDays,
  }
}

export default async function OccurrencesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  // Opt out of the cached/prerendered shell (Next.js Cache Components) so
  // occurrence/diagnosis writes show up immediately, not a stale snapshot.
  await connection()
  const params = searchParams ? await searchParams : {}
  const squadId = getSquadIdParam(params)
  const today = todayStr()

  const { occurrences, athletes, orgId, clinicianName, clinicianRole, microcycle, matchDays } = await getData(squadId, today)

  return (
    <OccurrencesClient
      occurrences={occurrences}
      athletes={athletes}
      orgId={orgId}
      squadId={squadId}
      microcycle={microcycle}
      matchDays={matchDays}
      currentDate={today}
      clinicianName={clinicianName}
      clinicianRole={clinicianRole}
    />
  )
}
