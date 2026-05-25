export type RecommendationStakeholder = 'clinical' | 'coach'
export type RecommendationActorRole = 'admin' | 'doctor' | 'physio' | 'coach' | 'fitness_coach' | 'athlete'

const ACK_ROLES: Record<RecommendationStakeholder, RecommendationActorRole[]> = {
  clinical: ['admin', 'doctor', 'physio'],
  coach: ['admin', 'coach', 'fitness_coach'],
}

export function canAcknowledgeRecommendation(
  role: string | null | undefined,
  stakeholder: RecommendationStakeholder,
): boolean {
  return ACK_ROLES[stakeholder].includes(role as RecommendationActorRole)
}

export function normalizeRecommendationOrgId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}
