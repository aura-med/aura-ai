// app/api/rehab/[sessionId]/assessment/route.ts
// Issue #20: server-side clinical assessment update with audit trail

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { field, value } = body as { field: string; value: unknown }

  if (!field) {
    return NextResponse.json({ error: 'Missing field' }, { status: 400 })
  }

  // Fetch current session
  const { data: session, error: fetchError } = await supabase
    .from('rehab_sessions')
    .select('clinical_data')
    .eq('id', sessionId)
    .single()

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const updatedClinical = {
    ...(session.clinical_data as Record<string, unknown>),
    [field]: value,
  }

  const { error: updateError } = await supabase
    .from('rehab_sessions')
    .update({
      clinical_data: updatedClinical,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, clinical_data: updatedClinical })
}
