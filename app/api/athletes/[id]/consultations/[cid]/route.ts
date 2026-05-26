import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/athletes/[id]/consultations/[cid]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; cid: string }> },
) {
  const { cid } = await params
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('medical_consultations')
    .update({
      consultation_date: body.consultation_date,
      consultation_time: body.consultation_time ?? null,
      clinician_name:    body.clinician_name ?? null,
      subjective:        body.subjective ?? null,
      objective:         body.objective ?? null,
      assessment:        body.assessment ?? null,
      plan:              body.plan ?? null,
    })
    .eq('id', cid)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/athletes/[id]/consultations/[cid]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; cid: string }> },
) {
  const { cid } = await params
  const supabase = await createClient()

  const { error } = await supabase
    .from('medical_consultations')
    .delete()
    .eq('id', cid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
