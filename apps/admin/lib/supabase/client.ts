import { createBrowserClient } from '@supabase/ssr'

function supabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!value) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  return value
}

function supabaseAnonKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!value) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
  return value
}

export function createBrowserSupabaseClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey())
}

export const createClient = createBrowserSupabaseClient
