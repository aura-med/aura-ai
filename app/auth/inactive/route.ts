import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// A removed (profiles.active = false) user who still holds a valid session lands
// here from the dashboard layout: sign them out (a route handler can write the
// auth cookies) and send them to the login page with an explanation.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = '?error=inactive'
  return NextResponse.redirect(url)
}
