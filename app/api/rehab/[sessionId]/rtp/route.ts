// app/api/rehab/[sessionId]/rtp/route.ts
// Persists RTP (return-to-play) criteria checkmarks for a rehab session.

import { NextRequest, NextResponse } from 'next/server'
import { asString, firstRecord } from '@/lib/data/records'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { verifyApiViewerFromRequest } from '@/lib/api/auth'
import { errorFromUnknown, readJsonBody } from '@/lib/api/errors'
import { requireClinical } from '@/lib/api/supabase-services'
import { REHAB_ROLES } from '@/lib/roles'
import { RtpCriteriaSchema } from '@/lib/schemas/rehab'
import type { UserRole } from '@/types'

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
      ? Promise.resolve({ data: { org_id: apiViewer.orgId, role: apiViewer.role } })
      : supabase.from('profiles').select('org_id, role').eq('id', user.id).single(),
    supabase
      .from('rehab_sessions')
      .select('id, athletes(org_id, squad_id)')
      .eq('id', sessionId)
      .single(),
  ])

  if (!profile?.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const athleteRow = firstRecord(session.athletes)
  const sessionOrgId = asString(athleteRow.org_id)
  if (sessionOrgId !== profile.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // The service-role client bypasses RLS, so replicate the rehab_sessions write
  // scope here: RTP writes are owner + doctor/physio only (not masseur), and
  // non-owners are limited to their assigned squads (mirrors get_user_squad_ids()).
  const viewerRole = (profile as { role?: string | null } | null)?.role ?? null
  if (viewerRole !== 'owner' && !REHAB_ROLES.includes(viewerRole as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (viewerRole !== 'owner') {
    const sessionSquadId = asString(athleteRow.squad_id)
    const { data: squadRows } = await supabase
      .from('staff_squads')
      .select('squad_id')
      .eq('profile_id', user.id)
    const allowed = new Set((squadRows ?? []).map((r) => (r as { squad_id: string }).squad_id))
    if (!sessionSquadId || !allowed.has(sessionSquadId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
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
