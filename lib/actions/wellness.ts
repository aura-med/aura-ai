'use server'
import { createClient } from '@/lib/supabase/server'
import { WellnessCheckinSchema } from '@/lib/schemas/wellness'
import { logAudit } from '@/lib/audit'

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

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user?.id ?? '').single()
  await logAudit({
    userId: user?.id ?? '', userEmail: user?.email ?? '', orgId: profile?.org_id ?? '',
    action: 'wellness.checkin', resourceType: 'wellness_checkin',
    metadata: { athleteId: result.data.athlete_id, checkinType: result.data.checkin_type },
  })

  return { success: true as const }
}
