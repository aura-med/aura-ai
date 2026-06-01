// app/api/rehab/[sessionId]/progress/route.ts
// Issue #20: phase advancement with optional override + full audit trail

import { NextRequest, NextResponse } from 'next/server'
import { asString, firstRecord } from '@/lib/data/records'
import { createClient } from '@/lib/supabase/server'
import { getProtocol, evaluatePhase } from '@/lib/rehab/protocol-engine'
import type { ProgressionOverride, ClinicalAssessment } from '@/types/rehab'

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
  const {
    to_phase,
    override_reason,
    override_notes,
  } = body as {
    to_phase: number
    override_reason?: string
    override_notes?: string
  }

  // Fetch caller's org and the session (with athlete org) in parallel
  const [{ data: profile }, { data: session, error }] = await Promise.all([
    supabase.from('profiles').select('org_id').eq('id', user.id).single(),
    supabase
      .from('rehab_sessions')
      .select('*, rehab_protocols(key, phases), athletes(org_id)')
      .eq('id', sessionId)
      .single(),
  ])

  if (!profile?.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const sessionOrgId = asString(firstRecord(session.athletes).org_id)
  if (sessionOrgId !== profile.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const protocol = getProtocol(session.rehab_protocols?.key ?? '')
  if (!protocol) {
    return NextResponse.json({ error: 'Protocol not found' }, { status: 400 })
  }

  const currentPhaseId: number = session.current_phase_id ?? 1
  const assessment = session.clinical_data as ClinicalAssessment

  // Validate: can only advance by 1 phase at a time
  if (to_phase !== currentPhaseId + 1) {
    return NextResponse.json(
      { error: 'Can only advance one phase at a time' },
      { status: 400 }
    )
  }

  // Check eligibility
  const currentPhase = protocol.phases.find(p => p.id === currentPhaseId)
  if (!currentPhase) {
    return NextResponse.json({ error: 'Current phase not found' }, { status: 400 })
  }

  const eligibility = evaluatePhase(currentPhase, assessment)
  const isOverride = !eligibility.all_gates_passed

  // If not eligible and no override provided, reject
  if (isOverride && !override_reason) {
    return NextResponse.json(
      {
        error: 'Gates not met. Provide override_reason to force progression.',
        blocking_gates: eligibility.blocking_gates.map(g => ({
          id: g.id,
          label: g.label,
          overridable: g.overridable,
        })),
      },
      { status: 422 }
    )
  }

  // Check non-overridable gates
  const hardBlocks = eligibility.blocking_gates.filter(g => !g.overridable)
  if (hardBlocks.length > 0) {
    return NextResponse.json(
      {
        error: 'Cannot override mandatory gates',
        mandatory_gates: hardBlocks.map(g => ({ id: g.id, label: g.label })),
      },
      { status: 422 }
    )
  }

  // Build override log entry if applicable
  const existingLog: ProgressionOverride[] = Array.isArray(session.override_log)
    ? session.override_log
    : []

  const newLog = isOverride
    ? [
        ...existingLog,
        {
          id: crypto.randomUUID(),
          session_id: sessionId,
          from_phase: currentPhaseId,
          to_phase,
          reason: override_reason as ProgressionOverride['reason'],
          notes: override_notes ?? '',
          overridden_by: user.id,
          overridden_at: new Date().toISOString(),
        } satisfies ProgressionOverride,
      ]
    : existingLog

  // Persist
  const { error: updateError } = await supabase
    .from('rehab_sessions')
    .update({
      current_phase_id: to_phase,
      override_log: newLog,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    advanced_to: to_phase,
    was_override: isOverride,
  })
}
