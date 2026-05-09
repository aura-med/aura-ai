'use server'
import { createClient } from '@/lib/supabase/server'
import { PreferencesSchema } from '@/lib/schemas/preferences'

export async function savePreferences(payload: unknown) {
  const result = PreferencesSchema.safeParse(payload)
  if (!result.success) {
    return { success: false as const, error: result.error.issues[0]?.message ?? 'Validation failed' }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('user_preferences').upsert(result.data)
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}
