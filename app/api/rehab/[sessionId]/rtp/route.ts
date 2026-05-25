// app/api/rehab/[sessionId]/rtp/route.ts
// Persists RTP (return-to-play) criteria checkmarks for a rehab session.

import { NextRequest, NextResponse } from 'next/server'
import { asString, firstRecord } from '@/lib/data/records'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { rtp_criteria } = body as { rtp_criteria: Array<{ label: string; done: boolean }> }

  if (!Array.isArray(rtp_criteria)) {
    return NextResponse.json({ error: 'Invalid rtp_criteria' }, { status: 400 })
  }

  const [{ data: profile }, { data: session, error: sessionError }] = await Promise.all([
    supabase.from('profiles').select('org_id').eq('id', user.id).single(),
    supabase
      .from('rehab_sessions')
      .select('id, athletes(org_id)')
      .eq('id', sessionId)
      .single(),
  ])

  if (!profile?.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const sessionOrgId = asString(firstRecord(session.athletes).org_id)
  if (sessionOrgId !== profile.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from('rehab_sessions')
    .update({ rtp_criteria, updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
