export function getSquadIdParam(
  searchParams?: Record<string, string | string[] | undefined> | { get: (name: string) => string | null } | null
): string | null {
  if (!searchParams) return null
  if (hasGet(searchParams)) {
    return searchParams.get('squadId')
  }
  const value = searchParams.squadId
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function hasGet(
  searchParams: Record<string, string | string[] | undefined> | { get: (name: string) => string | null }
): searchParams is { get: (name: string) => string | null } {
  return typeof (searchParams as { get?: unknown }).get === 'function'
}

export function withSquadParam(path: string, squadId?: string | null): string {
  if (!squadId) return path
  const [pathname, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  params.set('squadId', squadId)
  return `${pathname}?${params.toString()}`
}
