import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSquadIdParam } from '@/lib/squad-url'
import { SKINFOLD_FIELDS } from '@/types/athlete-profile'
import { NutritionClient } from './NutritionClient'

export interface NutritionAthlete {
  id: string
  name: string
  shirt_number: number | null
  position: string | null
  photo_url: string | null
  skinfold_limit_mm: number | null
}

export interface TeamDailyWeight {
  id: string
  athlete_id: string
  measurement_date: string
  weight_kg: number
  recorded_by_name: string | null
  athletes: { id: string; name: string; shirt_number: number | null; photo_url: string | null; position: string | null } | null
}

export interface TeamNutritionAssessment {
  id: string
  athlete_id: string
  assessment_date: string
  skinfold_tricep_mm: number | null
  skinfold_subscapular_mm: number | null
  skinfold_bicep_mm: number | null
  skinfold_iliac_mm: number | null
  skinfold_supraspinal_mm: number | null
  skinfold_abdominal_mm: number | null
  skinfold_thigh_mm: number | null
  skinfold_calf_mm: number | null
  urine_specific_gravity: number | null
  athletes: { id: string; name: string; shirt_number: number | null; photo_url: string | null; position: string | null } | null
}

async function getData(squadId: string | null) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user?.id ?? '')
    .single()

  let athleteQuery = supabase
    .from('athletes')
    .select('id, name, shirt_number, position, photo_url')
    .eq('active', true)
    .order('shirt_number')
  if (squadId) athleteQuery = athleteQuery.eq('squad_id', squadId)
  const { data: athletes } = await athleteQuery
  const athleteIds = (athletes ?? []).map((a: { id: string }) => a.id)

  const { data: medHistories } = athleteIds.length
    ? await supabase.from('athletes_medical_history').select('athlete_id, skinfold_limit_mm').in('athlete_id', athleteIds)
    : { data: [] as { athlete_id: string; skinfold_limit_mm: number | null }[] }
  const limitByAthlete = new Map((medHistories ?? []).map((m) => [m.athlete_id, m.skinfold_limit_mm]))

  const nutritionAthletes: NutritionAthlete[] = (athletes ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    shirt_number: a.shirt_number,
    position: a.position,
    photo_url: a.photo_url,
    skinfold_limit_mm: limitByAthlete.get(a.id) ?? null,
  }))

  let weightQuery = supabase
    .from('athlete_daily_weight')
    .select('id, athlete_id, measurement_date, weight_kg, recorded_by_name, athletes ( id, name, shirt_number, photo_url, position )')
    .order('measurement_date', { ascending: false })
    .limit(500)
  if (squadId) {
    weightQuery = athleteIds.length ? weightQuery.in('athlete_id', athleteIds) : weightQuery.is('athlete_id', null)
  }
  const { data: weights } = await weightQuery

  let assessmentQuery = supabase
    .from('nutrition_assessments')
    .select(`
      id, athlete_id, assessment_date, urine_specific_gravity,
      ${SKINFOLD_FIELDS.map((f) => f.key).join(', ')},
      athletes ( id, name, shirt_number, photo_url, position )
    `)
    .order('assessment_date', { ascending: false })
    .limit(500)
  if (squadId) {
    assessmentQuery = athleteIds.length ? assessmentQuery.in('athlete_id', athleteIds) : assessmentQuery.is('athlete_id', null)
  }
  const { data: assessments } = await assessmentQuery

  type RawRelated<T> = Omit<T, 'athletes'> & { athletes: TeamDailyWeight['athletes'] | TeamDailyWeight['athletes'][] }
  const normalise = <T extends { athletes: unknown }>(rows: RawRelated<T>[] | null) =>
    ((rows ?? []) as RawRelated<T>[]).map((r) => ({
      ...r,
      athletes: Array.isArray(r.athletes) ? r.athletes[0] ?? null : r.athletes,
    }))

  return {
    role: (profile?.role as string) ?? null,
    athletes: nutritionAthletes,
    weights: normalise<TeamDailyWeight>(weights as never) as unknown as TeamDailyWeight[],
    assessments: normalise<TeamNutritionAssessment>(assessments as never) as unknown as TeamNutritionAssessment[],
  }
}

export default async function NutritionPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  // Opt out of the cached/prerendered shell (Next.js Cache Components) so new
  // weigh-ins/assessments show up immediately, not a stale snapshot.
  await connection()
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const { role, athletes, weights, assessments } = await getData(squadId)
  return <NutritionClient role={role} athletes={athletes} weights={weights} assessments={assessments} />
}
