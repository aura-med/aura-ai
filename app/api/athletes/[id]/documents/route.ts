import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import { logAudit }      from '@/lib/audit'

// GET /api/athletes/[id]/documents?category=emd
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }           = await params
  const { searchParams } = new URL(req.url)
  const category         = searchParams.get('category')
  const supabase         = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('org_id').eq('id', user.id).single()

  let query = supabase
    .from('medical_documents')
    .select('id, athlete_id, category, exam_type, exam_date, file_url, file_name, file_size, file_type, uploaded_by, notes, is_archived, created_at')
    .eq('athlete_id', id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void logAudit({
    userId:       user.id,
    userEmail:    user.email ?? '',
    orgId:        profile?.org_id ?? '',
    action:       'medical.document.read',
    resourceType: 'medical_document',
    resourceId:   id,
    metadata:     { category: category ?? 'all', count: data.length },
  })

  return NextResponse.json(data)
}
