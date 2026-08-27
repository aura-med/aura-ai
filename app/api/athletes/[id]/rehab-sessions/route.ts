import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { RehabSessionExercise } from '@/types/athlete-profile'

type Ctx = { params: Promise<{ id: string }> }

const COLUMNS = 'id, athlete_id, session_date, session_type, duration_minutes, description, clinician_name, notes, occurrence_id, rehab_plan_id, pse, exercises, created_at, updated_at'

// Trusts only the shape the client-side exercise-row editor produces; drops
// anything else rather than persisting arbitrary client JSON.
function sanitizeExercises(input: unknown): RehabSessionExercise[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({
      name: typeof e.name === 'string' ? e.name.trim() : '',
      sets: typeof e.sets === 'number' && Number.isFinite(e.sets) ? Math.max(0, Math.round(e.sets)) : null,
      reps: typeof e.reps === 'string' && e.reps.trim() ? e.reps.trim() : null,
      load: typeof e.load === 'string' && e.load.trim() ? e.load.trim() : null,
    }))
    .filter((e) => e.name.length > 0)
}

function sanitizePse(input: unknown): number | null {
  const n = typeof input === 'string' ? Number(input) : input
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return Math.min(10, Math.max(0, Math.round(n)))
}

// The FK on rehab_sessions.rehab_plan_id only checks the plan exists, not
// that it belongs to this session's athlete — without this, a client could
// link a session to another athlete's plan since both athletes may be
// visible to the same clinician/squad.
async function validateRehabPlanOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rehabPlanId: unknown,
  athleteId: string,
): Promise<string | null> {
  if (typeof rehabPlanId !== 'string' || !rehabPlanId) return null
  const { data, error } = await supabase
    .from('rehab_plans')
    .select('athlete_id')
    .eq('id', rehabPlanId)
    .maybeSingle()
  if (error || !data || data.athlete_id !== athleteId) return 'Plano de reabilitação inválido para este atleta'
  return null
}

// GET /api/athletes/[id]/rehab-sessions
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rehab_sessions')
    .select(COLUMNS)
    .eq('athlete_id', id)
    // rehab_sessions is shared, by name only, with the unrelated RTP
    // protocol tracker (001_initial_schema.sql) — its rows always set
    // protocol_id, which this route's own inserts never do (see POST
    // below). Without this filter, an RTP protocol row would appear in
    // TreatmentsTab as an undated physio session, editable/deletable from
    // that UI and destroying the athlete's active protocol.
    .is('protocol_id', null)
    .order('session_date', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/athletes/[id]/rehab-sessions
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  const planError = await validateRehabPlanOwnership(supabase, body.rehab_plan_id, id)
  if (planError) return NextResponse.json({ error: planError }, { status: 400 })

  const { data, error } = await supabase
    .from('rehab_sessions')
    .insert({
      athlete_id:       id,
      session_date:     body.session_date,
      session_type:     body.session_type ?? 'physio',
      duration_minutes: body.duration_minutes ? Number(body.duration_minutes) : null,
      description:      body.description ?? null,
      clinician_name:   body.clinician_name ?? null,
      notes:            body.notes ?? null,
      occurrence_id:    body.occurrence_id ?? null,
      rehab_plan_id:    body.rehab_plan_id ?? null,
      pse:              sanitizePse(body.pse),
      exercises:        sanitizeExercises(body.exercises),
    })
    .select(COLUMNS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/athletes/[id]/rehab-sessions  (body must include sessionId)
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()
  const { sessionId, ...rest } = body

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  // rehab_plan_id is only re-validated when the caller actually sent it —
  // a partial PATCH that never mentions it shouldn't be blocked by
  // validating undefined against ownership.
  if ('rehab_plan_id' in rest) {
    const planError = await validateRehabPlanOwnership(supabase, rest.rehab_plan_id, id)
    if (planError) return NextResponse.json({ error: planError }, { status: 400 })
  }

  // PATCH means partial update — only touch fields the caller actually
  // included in the body. Unconditionally writing every column (defaulting
  // an omitted one to null/[]) would silently erase data set by someone
  // else since this client last loaded the session, e.g. another clinician
  // populating pse/exercises/rehab_plan_id moments earlier. A field IS
  // still clearable by explicitly sending it as null.
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('session_date' in rest) updateData.session_date = rest.session_date
  if ('session_type' in rest) updateData.session_type = rest.session_type
  if ('duration_minutes' in rest) updateData.duration_minutes = rest.duration_minutes ? Number(rest.duration_minutes) : null
  if ('description' in rest) updateData.description = rest.description ?? null
  if ('clinician_name' in rest) updateData.clinician_name = rest.clinician_name ?? null
  if ('notes' in rest) updateData.notes = rest.notes ?? null
  if ('occurrence_id' in rest) updateData.occurrence_id = rest.occurrence_id ?? null
  if ('rehab_plan_id' in rest) updateData.rehab_plan_id = rest.rehab_plan_id ?? null
  if ('pse' in rest) updateData.pse = sanitizePse(rest.pse)
  if ('exercises' in rest) updateData.exercises = sanitizeExercises(rest.exercises)

  const { data, error } = await supabase
    .from('rehab_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .eq('athlete_id', id)
    // Same reasoning as GET's filter above — never let this route touch
    // an RTP protocol tracker row, even given a stray/forged sessionId.
    .is('protocol_id', null)
    .select(COLUMNS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/athletes/[id]/rehab-sessions?sessionId=xxx
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const sessionId = new URL(req.url).searchParams.get('sessionId')

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const { error } = await supabase
    .from('rehab_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('athlete_id', id)
    // Same reasoning as GET's filter above — never let this route delete
    // an RTP protocol tracker row, even given a stray/forged sessionId.
    .is('protocol_id', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
