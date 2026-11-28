'use server'

// Wraps what was previously a direct supabase.upsert() in
// DailyWeightModal (NutritionClient.tsx) — moved server-side so the write
// has a logAudit() hook point (Phase D activity feed). athlete_daily_weight's
// own triggers (set_daily_weight_author/freeze_daily_weight_author) still
// derive recorded_by/recorded_by_name/org_id server-side; nothing here
// duplicates that.

import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

export interface RegisterAthleteWeightInput {
  athleteId: string
  measurementDate: string
  weightKg: number
}

export async function registerAthleteWeight(input: RegisterAthleteWeightInput) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athlete_daily_weight')
    .upsert(
      { athlete_id: input.athleteId, measurement_date: input.measurementDate, weight_kg: input.weightKg },
      { onConflict: 'athlete_id,measurement_date' },
    )
    .select('id, athlete_id, measurement_date, weight_kg, recorded_by_name, org_id')
    .single()
  if (error || !data) throw new Error('Não foi possível guardar. Sem permissão ou erro de ligação.')

  const { data: { user } } = await supabase.auth.getUser()
  await logAudit({
    userId: user?.id ?? '', userEmail: user?.email ?? '', orgId: data.org_id ?? '',
    action: 'weight.create', resourceType: 'athlete_daily_weight', resourceId: data.id,
    metadata: { athleteId: input.athleteId },
  })

  return data
}
