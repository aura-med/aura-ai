import { ApiError, errorFromUnknown, jsonResponse } from './errors.ts'
import { verifyApiViewerFromRequest } from './auth.ts'

interface HandlerOptions<T> {
  request: Request
  load: (viewer: Awaited<ReturnType<typeof verifyApiViewerFromRequest>>) => Promise<T | null>
}

export async function handleAuthenticatedResource<T>({ request, load }: HandlerOptions<T>) {
  try {
    const viewer = await verifyApiViewerFromRequest(request)
    const data = await load(viewer)
    if (!data) throw new ApiError('Not found', 404)
    return jsonResponse(data)
  } catch (error) {
    return errorFromUnknown(error)
  }
}

