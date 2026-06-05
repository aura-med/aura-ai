import { handleAuthenticatedResource } from '@/lib/api/resource-handlers'
import { listAthletes } from '@/lib/api/supabase-services'

export async function GET(request: Request) {
  return handleAuthenticatedResource({ request, load: (viewer) => listAthletes(request, viewer) })
}

