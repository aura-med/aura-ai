'use server'
import { createClient } from '@/lib/supabase/server'
import { WellnessCheckinSchema } from '@/lib/schemas/wellness'

export async function saveWellnessCheckin(payload: unknown) {
  const result = WellnessCheckinSchema.safeParse(payload)
  if (!result.success) {
    return { success: false as const, error: result.error.issues[0]?.message ?? 'Validation failed' }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('wellness_checkins')
    .upsert(result.data, { onConflict: 'athlete_id,checkin_date,checkin_type' })
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}
