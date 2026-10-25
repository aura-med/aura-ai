import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Removed users (profiles.active = false, migration 093) are banned in Supabase
// Auth, but a session token that was already issued stays valid for a while.
// This catches it on the next dashboard request. A query error (e.g. the
// migration not applied yet) is treated as "active" so the app keeps working.
export async function ActiveUserGuard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase.from('profiles').select('active').eq('id', user.id).maybeSingle()
  if (!error && data?.active === false) redirect('/auth/inactive')
  return null
}
