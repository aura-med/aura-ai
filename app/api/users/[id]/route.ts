import { createSupabaseUsersService } from '@/lib/api/supabase-services'
import { handleGetUser } from '@/lib/api/users'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return handleGetUser(request, id, { service: createSupabaseUsersService() })
}

