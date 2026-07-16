import type { UserRole } from '../../types/index.ts'
import { OWNER_ROLE, CLINICAL_ROLES, SQUAD_ROLES } from '../roles.ts'

export type RecommendationStakeholder = 'clinical' | 'coach'
export type RecommendationActorRole = UserRole

const ACK_ROLES: Record<RecommendationStakeholder, RecommendationActorRole[]> = {
  clinical: [OWNER_ROLE, ...CLINICAL_ROLES],
  coach: [OWNER_ROLE, ...SQUAD_ROLES],
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
