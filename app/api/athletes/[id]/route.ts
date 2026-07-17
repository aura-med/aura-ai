import type { NextRequest } from 'next/server'
import { verifyApiViewerFromRequest } from '@/lib/api/auth'
import { getAthlete } from '@/lib/api/supabase-services'
import { errorFromUnknown, jsonResponse, ApiError } from '@/lib/api/errors'
import { logAudit } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const viewer  = await verifyApiViewerFromRequest(request)
    const athlete = await getAthlete(id, viewer)
    if (!athlete) throw new ApiError('Athlete not found', 404)

    void logAudit({
      userId:       viewer.userId,
      userEmail:    viewer.email,
      orgId:        viewer.orgId,
      action:       'athlete.read',
      resourceType: 'athlete',
      resourceId:   id,
    })

    return jsonResponse(athlete)
  } catch (error) {
    return errorFromUnknown(error)
  }
}
