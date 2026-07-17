'use server'

// Server actions for clinical writes whose author/audit fields must be derived
// from the authenticated session, never trusted from the browser payload
// (which a tampered request could forge to impersonate another clinician).
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type Avail = 'available' | 'evaluation' | 'unavailable' | 'rtp'
const SEVERITY: Record<Avail, number> = { available: 0, evaluation: 1, rtp: 2, unavailable: 3 }

// Most-restrictive of the athlete's open occurrences/diagnoses, with active
// legacy rehab (status='rehab') acting as an 'rtp' floor.
async function recomputeAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  fallback: Avail,
): Promise<Avail> {
  const [{ data: occ }, { data: diag }, { data: inActiveRehab }] = await Promise.all([
    supabase.from('occurrences').select('availability_status').eq('athlete_id', athleteId).eq('is_resolved', false),
    supabase.from('diagnoses').select('availability_status').eq('athlete_id', athleteId).eq('is_resolved', false),
    // SECURITY DEFINER RPC so the rehab floor is seen regardless of role.
    supabase.rpc('athlete_in_active_rehab', { p_athlete_id: athleteId }),
  ])
  const statuses = [...(occ ?? []), ...(diag ?? [])]
    .map((r) => r.availability_status as Avail | null)
    .filter((s): s is Avail => s != null && s in SEVERITY)
  if (inActiveRehab === true) statuses.push('rtp')
  if (statuses.length === 0) return fallback
  return statuses.reduce((worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst))
}

export interface CreateDiagnosisInput {
  athleteId: string
  osiicsCode: string | null
  osiicsDescription: string | null
  diagnosisType: 'injury' | 'disease'
  customDescription: string | null
  availabilityStatus: Avail
  occurrenceId: string | null
}

export async function createDiagnosis(input: CreateDiagnosisInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: prof } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user?.id ?? '')
    .single()

  const { error } = await supabase.from('diagnoses').insert({
    athlete_id:          input.athleteId,
    org_id:              prof?.org_id ?? null,
    osiics_code:         input.osiicsCode,
    osiics_description:  input.osiicsDescription,
    diagnosis_type:      input.diagnosisType,
    custom_description:  input.customDescription,
    availability_status: input.availabilityStatus,
    diagnosed_by:        user?.id ?? null, // authoritative author, not client-supplied
    occurrence_id:       input.occurrenceId,
  })
  if (error) throw new Error(error.message)

  const next = await recomputeAvailability(supabase, input.athleteId, input.availabilityStatus)
  await supabase.rpc('update_athlete_availability', { p_athlete_id: input.athleteId, p_status: next })

  revalidatePath(`/athletes/${input.athleteId}`)
  revalidatePath('/')
}

export async function resolveDiagnosis(diagnosisId: string, athleteId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // resolved_by derived from the session, not the client payload. Guard on
  // is_resolved=false so a stale/double resolve doesn't overwrite the original
  // resolved_at/resolved_by on an already-resolved diagnosis.
  const { data: resolved, error } = await supabase
    .from('diagnoses')
    .update({ is_resolved: true, resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
    .eq('id', diagnosisId)
    .eq('is_resolved', false)
    .select('athlete_id')
    .maybeSingle()
  if (error || !resolved?.athlete_id) throw new Error(error?.message ?? 'Diagnóstico já resolvido ou inexistente')

  // Recompute for the diagnosis row's own athlete, not the client-supplied id.
  // 'available' fallback: with this diagnosis now resolved, nothing else open
  // means the athlete is available (rehab floor still applies inside the helper).
  const targetAthleteId = resolved.athlete_id
  const next = await recomputeAvailability(supabase, targetAthleteId, 'available')
  await supabase.rpc('update_athlete_availability', { p_athlete_id: targetAthleteId, p_status: next })

  revalidatePath(`/athletes/${targetAthleteId}`)
  revalidatePath('/')
}

export interface AdministerMedicationInput {
  athleteId: string
  medicationName: string
  dose: string | null
  route: string
  notes: string | null
  administeredAt: string // ISO
}

export async function administerMedication(input: AdministerMedicationInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: prof } = await supabase
    .from('profiles')
    .select('org_id, full_name')
    .eq('id', user?.id ?? '')
    .single()

  const { data, error } = await supabase.from('medication_administrations').insert({
    athlete_id:           input.athleteId,
    org_id:               prof?.org_id ?? null,
    medication_name:      input.medicationName,
    dose:                 input.dose,
    route:                input.route,
    notes:                input.notes,
    administered_by:      user?.id ?? null,          // authoritative administrator
    administered_by_name: prof?.full_name ?? null,   // derived, not client-supplied
    administered_at:      input.administeredAt,
  }).select().single()
  if (error) throw new Error(error.message)

  revalidatePath(`/athletes/${input.athleteId}`)
  return data
}

export interface RegisterOrthosisInput {
  athleteId: string
  orthosisType: string
  bodyPart: string | null
  appliedByName: string | null
  applicationDate: string // local YYYY-MM-DD
  requiresDailyApplication: boolean
  notes: string | null
}

export async function registerOrthosis(input: RegisterOrthosisInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: prof } = await supabase
    .from('profiles')
    .select('org_id, full_name')
    .eq('id', user?.id ?? '')
    .single()

  const { data, error } = await supabase.from('orthosis_records').insert({
    athlete_id:                 input.athleteId,
    org_id:                     prof?.org_id ?? null,
    orthosis_type:              input.orthosisType,
    body_part:                  input.bodyPart,
    registered_by_name:         prof?.full_name ?? null, // derived, not client-supplied
    applied_by_name:            input.appliedByName,
    application_date:           input.applicationDate,
    requires_daily_application: input.requiresDailyApplication,
    notes:                      input.notes,
    is_active:                  true,
  }).select().single()
  if (error) throw new Error(error.message)

  revalidatePath(`/athletes/${input.athleteId}`)
  return data
}
