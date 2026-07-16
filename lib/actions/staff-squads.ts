'use server'

import { createClient } from '@/lib/supabase/server'

export async function assignStaffToSquad(profileId: string, squadId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('staff_squads').insert({ profile_id: profileId, squad_id: squadId })
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

export async function removeStaffFromSquad(profileId: string, squadId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('staff_squads')
    .delete()
    .eq('profile_id', profileId)
    .eq('squad_id', squadId)
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}
