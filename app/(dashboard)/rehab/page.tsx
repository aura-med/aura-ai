import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSquadIdParam } from '@/lib/squad-url'
import { RehabPlansClient } from './RehabPlansClient'

async function getData(squadId: string | null) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user?.id ?? '')
    .single()

  const orgId = profile?.org_id ?? ''

  // Athletes for the squad — also used to scope the plans/occurrences queries
  // and to populate the "Registar Plano" athlete picker.
  let athleteQuery = supabase
    .from('athletes')
    .select('id, name, shirt_number, photo_url, position')
    .eq('active', true)
    .order('shirt_number')
  if (squadId) athleteQuery = athleteQuery.eq('squad_id', squadId)
  const { data: athletes } = await athleteQuery
  const athleteIds = (athletes ?? []).map((a: { id: string }) => a.id)

  let plansQuery = supabase
    .from('rehab_plans')
    .select(`
      id, athlete_id, occurrence_id, title, start_date, expected_end_date,
      is_active, is_completed, closed_at, rtp_criteria, created_at, updated_at,
      athletes ( id, name, shirt_number, photo_url, position )
    `)
    .eq('org_id', orgId)
    .order('is_active', { ascending: false })
    .order('start_date', { ascending: false })

  if (squadId) {
    if (athleteIds.length) {
      plansQuery = plansQuery.in('athlete_id', athleteIds)
    } else {
      // Squad has no athletes — return empty set without leaking other squads' data.
      plansQuery = plansQuery.is('athlete_id', null)
    }
  }
  const { data: plans } = await plansQuery

  // Active occurrences, for the "ligar a ocorrência" picker inside the plan
  // create/edit modal — same table this page's plans can optionally link to.
  let occQuery = supabase
    .from('occurrences')
    .select('id, athlete_id, title, occurrence_type, occurrence_date')
    .eq('org_id', orgId)
    .eq('is_resolved', false)
  if (squadId) {
    if (athleteIds.length) {
      occQuery = occQuery.in('athlete_id', athleteIds)
    } else {
      occQuery = occQuery.is('athlete_id', null)
    }
  }
  const { data: occurrences } = await occQuery

  // Supabase infers the to-one `athletes` relation as an array — normalise to
  // a single object so the runtime shape matches the client component's types.
  type RawPlan = Omit<
    Parameters<typeof RehabPlansClient>[0]['plans'][number], 'athletes'
  > & {
    athletes:
      | Parameters<typeof RehabPlansClient>[0]['plans'][number]['athletes']
      | Array<Parameters<typeof RehabPlansClient>[0]['plans'][number]['athletes']>
  }

  const normalisedPlans = ((plans ?? []) as unknown as RawPlan[]).map((p) => ({
    ...p,
    athletes: Array.isArray(p.athletes) ? p.athletes[0] : p.athletes,
    rtp_criteria: Array.isArray(p.rtp_criteria) ? p.rtp_criteria : [],
  })) as Parameters<typeof RehabPlansClient>[0]['plans']

  return {
    plans: normalisedPlans,
    athletes: (athletes ?? []) as Parameters<typeof RehabPlansClient>[0]['athletes'],
    occurrences: (occurrences ?? []) as Parameters<typeof RehabPlansClient>[0]['occurrences'],
    role: (profile?.role ?? 'physio') as Parameters<typeof RehabPlansClient>[0]['role'],
  }
}

export default async function RehabPlansPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  // Opt out of the cached/prerendered shell (Next.js Cache Components) so
  // plan/phase/day writes show up immediately, not a stale snapshot.
  await connection()
  const params = searchParams ? await searchParams : {}
  const squadId = getSquadIdParam(params)

  const { plans, athletes, occurrences, role } = await getData(squadId)

  return (
    <RehabPlansClient
      plans={plans}
      athletes={athletes}
      occurrences={occurrences}
      role={role}
      squadId={squadId}
    />
  )
}
