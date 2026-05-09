'use server'
import { createClient } from '@/lib/supabase/server'
import { PassportShareSchema } from '@/lib/schemas/passport'

export async function togglePassportShare(payload: unknown) {
  const result = PassportShareSchema.safeParse(payload)
  if (!result.success) {
    return { success: false as const, error: result.error.issues[0]?.message ?? 'Validation failed' }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('athlete_passport')
    .update({ is_shareable: result.data.isShareable, last_updated: new Date().toISOString() })
    .eq('athlete_id', result.data.athleteId)
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}
