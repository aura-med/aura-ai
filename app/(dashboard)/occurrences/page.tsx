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
    .select('id, name, shirt_number, photo_url, position')
    .eq('active', true)
    .order('shirt_number')
  if (squadId) athleteQuery = athleteQuery.eq('squad_id', squadId)
  const { data: athletes } = await athleteQuery

  // Get occurrences for this org (with athletes and records)
  let occQuery = supabase
    .from('occurrences')
    .select(`
      id, athlete_id, occurrence_date, occurrence_type,
      subjective, objective, assessment, plan,
      availability_status, clinician_name, clinician_role,
      is_resolved, resolved_at, microcycle_number,
      athletes ( id, name, shirt_number, photo_url, position ),
      occurrence_records ( id, record_date, subjective, objective, assessment, plan, availability_status, clinician_name )
    `)
    .eq('org_id', orgId)
    .order('is_resolved', { ascending: true })
    .order('occurrence_date', { ascending: false })

  if (squadId) {
    const athleteIds = (athletes ?? []).map((a: { id: string }) => a.id)
    if (athleteIds.length) occQuery = occQuery.in('athlete_id', athleteIds)
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

  return {
    occurrences: (occurrences ?? []) as Parameters<typeof OccurrencesClient>[0]['occurrences'],
    athletes: (athletes ?? []) as Parameters<typeof OccurrencesClient>[0]['athletes'],
    orgId,
    clinicianName: profile?.full_name ?? '',
    clinicianRole: profile?.role ?? '',
    microcycle,
  }
}

export default async function OccurrencesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const squadId = getSquadIdParam(params)
  const today = todayStr()

  const { occurrences, athletes, orgId, clinicianName, clinicianRole, microcycle } = await getData(squadId, today)

  return (
    <OccurrencesClient
      occurrences={occurrences}
      athletes={athletes}
      orgId={orgId}
      squadId={squadId}
      microcycle={microcycle}
      currentDate={today}
      clinicianName={clinicianName}
      clinicianRole={clinicianRole}
    />
  )
}
