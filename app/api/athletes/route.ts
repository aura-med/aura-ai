import type { NextRequest } from 'next/server'
import { verifyApiViewerFromRequest } from '@/lib/api/auth'
import { listAthletes } from '@/lib/api/supabase-services'
import { errorFromUnknown, jsonResponse, ApiError } from '@/lib/api/errors'
import { logAudit } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const viewer = await verifyApiViewerFromRequest(request)
    const data   = await listAthletes(request, viewer)
    if (!data) throw new ApiError('Not found', 404)

    await logAudit({
      userId:       viewer.userId,
      userEmail:    viewer.email,
      orgId:        viewer.orgId,
      action:       'athlete.list',
      resourceType: 'athlete',
    })

    return jsonResponse(data)
  } catch (error) {
    return errorFromUnknown(error)
  }
}
