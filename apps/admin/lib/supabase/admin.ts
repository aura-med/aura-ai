import { createClient as createServiceClient } from '@supabase/supabase-js'

function supabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!value) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  return value
}

function supabaseServiceRoleKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!value) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for Aura Admin')
  return value
}

export function createAdminClient() {
  return createServiceClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
