import { handleAuthenticatedResource } from '@/lib/api/resource-handlers'
import { listProtocols } from '@/lib/api/supabase-services'

export async function GET(request: Request) {
  return handleAuthenticatedResource({ request, load: () => listProtocols(request) })
}

