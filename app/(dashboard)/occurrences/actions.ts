'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface RegisterOccurrenceInput {
  athleteId: string
  orgId: string
  squadId: string | null
  microcycleNumber: number | null
  occurrenceDate: string
  occurrenceType: 'complaint' | 'trauma' | 'disease' | 'other'
  subjective: string
  objective: string
  assessment: string
  plan: string
  availabilityStatus: 'available' | 'evaluation' | 'unavailable' | 'rtp'
  clinicianName: string
  clinicianRole: string
}

export async function registerOccurrence(input: RegisterOccurrenceInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('occurrences').insert({
    athlete_id: input.athleteId,
    org_id: input.orgId,
    squad_id: input.squadId,
    microcycle_number: input.microcycleNumber,
    occurrence_date: input.occurrenceDate,
    occurrence_type: input.occurrenceType,
    subjective: input.subjective,
    objective: input.objective,
    assessment: input.assessment,
    plan: input.plan,
    availability_status: input.availabilityStatus,
    created_by: user?.id,
    clinician_name: input.clinicianName,
    clinician_role: input.clinicianRole,
    is_resolved: false,
  })

  if (error) throw new Error(error.message)

  // Update athlete availability_status
  await supabase
    .from('athletes')
    .update({ availability_status: input.availabilityStatus })
    .eq('id', input.athleteId)

  revalidatePath('/occurrences')
  revalidatePath('/')
}

export async function resolveOccurrence(
  occurrenceId: string,
  athleteId: string,
  resolutionStatus: 'available' | 'evaluation' | 'unavailable' | 'rtp'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  await supabase
    .from('occurrences')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id,
      availability_status: resolutionStatus,
    })
    .eq('id', occurrenceId)

  // Update athlete availability if resolving to available
  await supabase
    .from('athletes')
    .update({ availability_status: resolutionStatus })
    .eq('id', athleteId)

  revalidatePath('/occurrences')
  revalidatePath('/')
}

export async function addOccurrenceRecord(input: {
  occurrenceId: string
  athleteId: string
  recordDate: string
  subjective: string
  objective: string
  assessment: string
  plan: string
  availabilityStatus: 'available' | 'evaluation' | 'unavailable' | 'rtp'
  clinicianName: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  await supabase.from('occurrence_records').insert({
    occurrence_id: input.occurrenceId,
    athlete_id: input.athleteId,
    record_date: input.recordDate,
    subjective: input.subjective,
    objective: input.objective,
    assessment: input.assessment,
    plan: input.plan,
    availability_status: input.availabilityStatus,
    created_by: user?.id,
    clinician_name: input.clinicianName,
  })

  // Update occurrence availability status
  await supabase
    .from('occurrences')
    .update({ availability_status: input.availabilityStatus })
    .eq('id', input.occurrenceId)

  // Update athlete availability
  await supabase
    .from('athletes')
    .update({ availability_status: input.availabilityStatus })
    .eq('id', input.athleteId)

  revalidatePath('/occurrences')
  revalidatePath('/')
}
