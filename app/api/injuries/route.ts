import { handleAuthenticatedResource } from '@/lib/api/resource-handlers'
import { listInjuries } from '@/lib/api/supabase-services'

export async function GET(request: Request) {
  return handleAuthenticatedResource({ request, load: (viewer) => listInjuries(request, viewer) })
}

