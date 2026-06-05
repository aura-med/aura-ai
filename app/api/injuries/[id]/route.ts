import { ApiError } from '@/lib/api/errors'
import { handleAuthenticatedResource } from '@/lib/api/resource-handlers'
import { getInjury } from '@/lib/api/supabase-services'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return handleAuthenticatedResource({
    request,
    load: async (viewer) => {
      const injury = await getInjury(id, viewer)
      if (!injury) throw new ApiError('Injury not found', 404)
      return injury
    },
  })
}

