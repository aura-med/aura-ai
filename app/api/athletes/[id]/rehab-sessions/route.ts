import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/athletes/[id]/rehab-sessions
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rehab_sessions')
    .select('id, athlete_id, session_date, session_type, duration_minutes, description, clinician_name, notes, created_at, updated_at')
    .eq('athlete_id', id)
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
    })
    .select('id, athlete_id, session_date, session_type, duration_minutes, description, clinician_name, notes, created_at, updated_at')
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

  const { data, error } = await supabase
    .from('rehab_sessions')
    .update({
      session_date:     rest.session_date,
      session_type:     rest.session_type,
      duration_minutes: rest.duration_minutes ? Number(rest.duration_minutes) : null,
      description:      rest.description ?? null,
      clinician_name:   rest.clinician_name ?? null,
      notes:            rest.notes ?? null,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('athlete_id', id)
    .select('id, athlete_id, session_date, session_type, duration_minutes, description, clinician_name, notes, created_at, updated_at')
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
