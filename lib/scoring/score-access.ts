interface ScoreAccessParams {
  userId: string | null
  profileOrgId: string | null
  athleteOrgId: string | null
  athleteFound: boolean
}

interface ScoreAccessResult {
  ok: boolean
  status: number
  orgId: string | null
  error?: string
}

export function normalizeOrgId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

export function authorizeScoreAccess(params: ScoreAccessParams): ScoreAccessResult {
  if (!params.userId) {
    return { ok: false, status: 401, orgId: null, error: 'Unauthorized' }
  }

  const profileOrgId = normalizeOrgId(params.profileOrgId)
  if (!profileOrgId) {
    return { ok: false, status: 403, orgId: null, error: 'Forbidden' }
  }

  if (!params.athleteFound) {
    return { ok: false, status: 404, orgId: null, error: 'Athlete not found' }
  }

  const athleteOrgId = normalizeOrgId(params.athleteOrgId)
  if (!athleteOrgId || athleteOrgId !== profileOrgId) {
    return { ok: false, status: 403, orgId: null, error: 'Forbidden' }
  }

  return { ok: true, status: 200, orgId: profileOrgId }
}
