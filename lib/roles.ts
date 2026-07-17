import type { UserRole } from '@/types'

export const OWNER_ROLE: UserRole = 'owner'

export const CLINICAL_ROLES: UserRole[] = ['doctor', 'physio', 'masseur']
export const REHAB_ROLES: UserRole[] = ['doctor', 'physio']
export const SQUAD_ROLES: UserRole[] = ['coach', 'fitness_coach', 'nutritionist', 'director', 'scout', 'team_manager']
export const STAFF_ROLES: UserRole[] = [...CLINICAL_ROLES, ...SQUAD_ROLES]

export function isOwner(role: UserRole | null | undefined): boolean {
  return role === OWNER_ROLE
}

export function isSquadScoped(role: UserRole | null | undefined): boolean {
  return role !== OWNER_ROLE && role !== 'athlete'
}
