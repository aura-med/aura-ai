export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status })
}

export function errorResponse(message: string, status: number) {
  return jsonResponse({ error: message }, status)
}

export function errorFromUnknown(error: unknown) {
  if (error instanceof ApiError) return errorResponse(error.message, error.status)
  const message = error instanceof Error ? error.message : 'Unexpected error'
  return errorResponse(message, 500)
}

export function parsePagination(url: string) {
  const searchParams = new URL(url).searchParams
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const requestedPageSize = Number.parseInt(searchParams.get('pageSize') ?? '20', 10) || 20
  const pageSize = Math.min(100, Math.max(1, requestedPageSize))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  return { page, pageSize, from, to }
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new ApiError('Invalid JSON body', 400)
  }
}
