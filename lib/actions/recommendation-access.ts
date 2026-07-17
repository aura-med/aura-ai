import type { UserRole } from '../../types/index.ts'
import { OWNER_ROLE, REHAB_ROLES } from '../roles.ts'

export type RecommendationStakeholder = 'clinical' | 'coach'
export type RecommendationActorRole = UserRole

// These must stay in lock-step with migration 021's recommendation_log UPDATE
// policies: acknowledgeRecommendations() writes with the service-role client
// (bypassing RLS), so any role allowed here that RLS would reject becomes a
// privilege-escalation path. RLS allows clinical acks for owner/doctor/physio
// and coach acks for owner/coach/fitness_coach only.
const COACH_ACK_ROLES: RecommendationActorRole[] = ['coach', 'fitness_coach']
const ACK_ROLES: Record<RecommendationStakeholder, RecommendationActorRole[]> = {
  clinical: [OWNER_ROLE, ...REHAB_ROLES],
  coach: [OWNER_ROLE, ...COACH_ACK_ROLES],
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
