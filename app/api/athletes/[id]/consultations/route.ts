import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import { logAudit }      from '@/lib/audit'

// GET /api/athletes/[id]/consultations
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }   = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('org_id').eq('id', user.id).single()

  const { data, error } = await supabase
    .from('medical_consultations')
    .select('id, athlete_id, consultation_date, consultation_time, clinician_id, clinician_name, subjective, objective, assessment, plan, created_at, updated_at')
    .eq('athlete_id', id)
    .order('consultation_date', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void logAudit({
    userId:       user.id,
    userEmail:    user.email ?? '',
    orgId:        profile?.org_id ?? '',
    action:       'medical.consultation.read',
    resourceType: 'medical_consultation',
    resourceId:   id,
    metadata:     { count: data.length },
  })

  return NextResponse.json(data)
}

// POST /api/athletes/[id]/consultations
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }   = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('org_id').eq('id', user.id).single()

  const body = await req.json()

  const { data, error } = await supabase
    .from('medical_consultations')
    .insert({
      athlete_id:        id,
      consultation_date: body.consultation_date,
      consultation_time: body.consultation_time ?? null,
      clinician_name:    body.clinician_name    ?? null,
      subjective:        body.subjective        ?? null,
      objective:         body.objective         ?? null,
      assessment:        body.assessment        ?? null,
      plan:              body.plan              ?? null,
    })
    .select('id, athlete_id, consultation_date, consultation_time, clinician_id, clinician_name, subjective, objective, assessment, plan, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void logAudit({
    userId:       user.id,
    userEmail:    user.email ?? '',
    orgId:        profile?.org_id ?? '',
    action:       'medical.consultation.create',
    resourceType: 'medical_consultation',
    resourceId:   data.id,
    metadata:     { athlete_id: id, consultation_date: data.consultation_date },
  })

  return NextResponse.json(data, { status: 201 })
}
