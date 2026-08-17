import { createClient } from '@/lib/supabase/server'
import { getSquadIdParam } from '@/lib/squad-url'
import { MedicationClient } from './MedicationClient'

export interface TeamMedicationRecord {
  id: string
  athlete_id: string
  medication_name: string
  dose: string | null
  route: string | null
  administered_by_name: string | null
  administered_at: string
  notes: string | null
  athletes: { id: string; name: string; shirt_number: number | null; photo_url: string | null; position: string | null } | null
}

export interface MedicationAthlete {
  id: string
  name: string
  shirt_number: number | null
  position: string | null
}

async function getData(squadId: string | null) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user?.id ?? '')
    .single()

  // Athletes for the squad — used by the "add entry" athlete picker. RLS already
  // scopes what the viewer can see; the squad filter narrows the picker.
  let athleteQuery = supabase
    .from('athletes')
    .select('id, name, shirt_number, position')
    .eq('active', true)
    .order('shirt_number')
  if (squadId) athleteQuery = athleteQuery.eq('squad_id', squadId)
  const { data: athletes } = await athleteQuery

  // Team-wide administration history. RLS (org_read_med_admin) already restricts
  // this to the viewer's org and — for non-owners — their assigned squads, so it
  // stays in sync with the same rows shown in the athlete clinical file.
  let recordQuery = supabase
    .from('medication_administrations')
    .select(`
      id, athlete_id, medication_name, dose, route, administered_by_name, administered_at, notes,
      athletes ( id, name, shirt_number, photo_url, position )
    `)
    .order('administered_at', { ascending: false })
    .limit(500)

  if (squadId) {
    const athleteIds = (athletes ?? []).map((a: { id: string }) => a.id)
    if (athleteIds.length) {
      recordQuery = recordQuery.in('athlete_id', athleteIds)
    } else {
      // Squad has no athletes — return an empty set rather than the whole org.
      recordQuery = recordQuery.is('athlete_id', null)
    }
  }

  const { data: records } = await recordQuery

  return {
    role: (profile?.role as string) ?? null,
    athletes: (athletes ?? []) as MedicationAthlete[],
    records: (records ?? []) as unknown as TeamMedicationRecord[],
  }
}

export default async function MedicationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const { role, athletes, records } = await getData(squadId)
  return <MedicationClient role={role} athletes={athletes} records={records} />
}
