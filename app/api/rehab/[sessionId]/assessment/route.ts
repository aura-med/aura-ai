// app/api/rehab/[sessionId]/assessment/route.ts
// Issue #20: server-side clinical assessment update with audit trail

import { NextRequest, NextResponse } from 'next/server'
import { asString, firstRecord } from '@/lib/data/records'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

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

  // Fetch caller's org and the session (with athlete org) in parallel
  const [{ data: profile }, { data: session, error: fetchError }] = await Promise.all([
    supabase.from('profiles').select('org_id').eq('id', user.id).single(),
    supabase
      .from('rehab_sessions')
      .select('clinical_data, athletes(org_id)')
      .eq('id', sessionId)
      .single(),
  ])

  if (!profile?.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const sessionOrgId = asString(firstRecord(session.athletes).org_id)
  if (sessionOrgId !== profile.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

  await logAudit({
    userId:       user.id,
    userEmail:    user.email ?? '',
    orgId:        profile?.org_id ?? '',
    action:       'rehab.assessment.update',
    resourceType: 'rehab_session',
    resourceId:   sessionId,
    metadata:     { field },
  })

  return NextResponse.json({ ok: true, clinical_data: updatedClinical })
}
