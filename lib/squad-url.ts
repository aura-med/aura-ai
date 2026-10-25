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

// Which squad is active: the URL wins, then the one picked earlier in this
// session, then the user's saved default (Settings → Preferences), then the
// first squad. Anything not in `validSquadIds` is skipped.
export function resolveSquadId({
  urlSquadId,
  storedSquadId,
  defaultSquadId,
  validSquadIds,
  firstSquadId,
}: {
  urlSquadId: string | null
  storedSquadId: string | null
  defaultSquadId: string | null
  validSquadIds: ReadonlySet<string>
  firstSquadId: string | null
}): string | null {
  for (const id of [urlSquadId, storedSquadId, defaultSquadId]) {
    if (id && validSquadIds.has(id)) return id
  }
  return firstSquadId
}
