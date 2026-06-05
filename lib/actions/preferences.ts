'use server'
import { createClient } from '@/lib/supabase/server'
import { PreferencesSchema } from '@/lib/schemas/preferences'
import { z } from 'zod'

const ThemePreferenceSchema = z.enum(['dark', 'light'])

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

export async function saveThemePreference(payload: unknown) {
  const result = ThemePreferenceSchema.safeParse(payload)
  if (!result.success) {
    return { success: false as const, error: result.error.issues[0]?.message ?? 'Invalid theme' }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false as const, error: authError?.message ?? 'Not authenticated' }
  }

  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: user.id, theme: result.data }, { onConflict: 'user_id' })

  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}
