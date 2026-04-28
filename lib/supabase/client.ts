import { createBrowserClient } from '@supabase/ssr'

function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'
  )
}

let browserClient: ReturnType<typeof makeClient> | null = null

export function createClient() {
  if (browserClient) return browserClient

  browserClient = makeClient()
  return browserClient
}
