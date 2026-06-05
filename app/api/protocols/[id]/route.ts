import { ApiError } from '@/lib/api/errors'
import { handleAuthenticatedResource } from '@/lib/api/resource-handlers'
import { getProtocol } from '@/lib/api/supabase-services'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return handleAuthenticatedResource({
    request,
    load: async () => {
      const protocol = await getProtocol(id)
      if (!protocol) throw new ApiError('Protocol not found', 404)
      return protocol
    },
  })
}

