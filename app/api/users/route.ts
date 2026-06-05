import { createSupabaseUsersService } from '@/lib/api/supabase-services'
import { handleCreateUser, handleListUsers } from '@/lib/api/users'

export async function GET(request: Request) {
  return handleListUsers(request, { service: createSupabaseUsersService() })
}

export async function POST(request: Request) {
  return handleCreateUser(request, { service: createSupabaseUsersService() })
}

