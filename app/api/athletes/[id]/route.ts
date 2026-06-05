import { ApiError } from '@/lib/api/errors'
import { handleAuthenticatedResource } from '@/lib/api/resource-handlers'
import { getAthlete } from '@/lib/api/supabase-services'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return handleAuthenticatedResource({
    request,
    load: async (viewer) => {
      const athlete = await getAthlete(id, viewer)
      if (!athlete) throw new ApiError('Athlete not found', 404)
      return athlete
    },
  })
}

