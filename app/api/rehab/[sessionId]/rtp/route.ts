// app/api/rehab/[sessionId]/rtp/route.ts
// Persists RTP (return-to-play) criteria checkmarks for a rehab session.

import { NextRequest, NextResponse } from 'next/server'
import { asString, firstRecord } from '@/lib/data/records'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { verifyApiViewerFromRequest } from '@/lib/api/auth'
import { errorFromUnknown, readJsonBody } from '@/lib/api/errors'
import { requireClinical } from '@/lib/api/supabase-services'
import { RtpCriteriaSchema } from '@/lib/schemas/rehab'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const apiViewer = request.headers.get('authorization')
    ? await verifyApiViewerFromRequest(request).catch((error) => error)
    : null
  if (apiViewer instanceof Error) return errorFromUnknown(apiViewer)
  const apiClient = apiViewer ? createServiceRoleClient() : null
  if (apiViewer && !apiClient) {
    return NextResponse.json({ error: 'Supabase service role is not configured' }, { status: 500 })
  }
  if (apiViewer) requireClinical(apiViewer)
  const supabase = apiClient ?? await createClient()

  const { data: { user }, error: authError } = apiViewer
    ? { data: { user: { id: apiViewer.userId } }, error: null }
    : await supabase.auth.getUser()
  if (authError || !user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await readJsonBody(request).catch((error) => error)
  if (body instanceof Error) return errorFromUnknown(body)
  const { rtp_criteria } = body as { rtp_criteria: Array<{ label: string; done: boolean }> }

  const validation = RtpCriteriaSchema.safeParse(rtp_criteria)
  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid rtp_criteria' }, { status: 400 })
  }

  const [{ data: profile }, { data: session, error: sessionError }] = await Promise.all([
    apiViewer
      ? Promise.resolve({ data: { org_id: apiViewer.orgId } })
      : supabase.from('profiles').select('org_id').eq('id', user.id).single(),
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
    .update({ rtp_criteria: validation.data, updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
