import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/athletes/[id]/consultations
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('medical_consultations')
    .select('*')
    .eq('athlete_id', id)
    .order('consultation_date', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/athletes/[id]/consultations
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('medical_consultations')
    .insert({
      athlete_id:        id,
      consultation_date: body.consultation_date,
      consultation_time: body.consultation_time ?? null,
      clinician_name:    body.clinician_name ?? null,
      subjective:        body.subjective ?? null,
      objective:         body.objective ?? null,
      assessment:        body.assessment ?? null,
      plan:              body.plan ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
