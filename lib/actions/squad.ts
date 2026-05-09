'use server'
import { createClient } from '@/lib/supabase/server'
import { CreateSquadSchema } from '@/lib/schemas/squad'

export async function createSquad(payload: unknown) {
  const result = CreateSquadSchema.safeParse(payload)
  if (!result.success) {
    return { success: false as const, error: result.error.issues[0]?.message ?? 'Validation failed' }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('squads').insert(result.data)
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}
