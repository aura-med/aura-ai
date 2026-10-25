import type { UserRole } from '@/types'
import { OWNER_ROLE, isSquadScoped } from '@/lib/roles'

export const ALL_USER_ROLES: UserRole[] = [
  'owner', 'doctor', 'physio', 'masseur',
  'coach', 'fitness_coach',
  'nutritionist', 'director', 'scout', 'team_manager',
  'athlete',
]

// 'athlete' accounts must be linked to an athletes row (user_id); there is no
// claim flow yet, so they can't be created through an invite.
export const INVITABLE_ROLES: UserRole[] = ALL_USER_ROLES.filter((r) => r !== 'athlete')

export function canInviteUsers(role: string | null | undefined): boolean {
  return role === OWNER_ROLE || role === 'doctor'
}

// Edit / reset password / remove / reactivate users.
export function canManageUsers(role: string | null | undefined): boolean {
  return role === OWNER_ROLE
}

// Create and edit squads (a doctor: only squads they're assigned to).
export function canEditSquads(role: string | null | undefined): boolean {
  return role === OWNER_ROLE || role === 'doctor'
}

// Roles the actor may hand out in an invite. A doctor can never mint an owner.
export function inviteRolesFor(actorRole: string | null | undefined): UserRole[] {
  if (actorRole === OWNER_ROLE) return INVITABLE_ROLES
  if (actorRole === 'doctor') return INVITABLE_ROLES.filter((r) => r !== OWNER_ROLE)
  return []
}

export function inviteRoleAllowed(actorRole: string | null | undefined, target: string): boolean {
  return inviteRolesFor(actorRole).includes(target as UserRole)
}

// Squads for an invite/edit: every id must be one the actor can access, and a
// squad-scoped role (everyone except owner/athlete) needs at least one.
export function validateSquadAssignment(
  targetRole: string,
  requestedSquadIds: string[],
  actorSquadIds: ReadonlySet<string>,
): { ok: true; squadIds: string[] } | { ok: false; error: string } {
  const unique = [...new Set(requestedSquadIds)]
  if (!isSquadScoped(targetRole as UserRole)) return { ok: true, squadIds: [] }
  if (unique.length === 0) return { ok: false, error: 'Selecione pelo menos um squad' }
  if (unique.some((id) => !actorSquadIds.has(id))) return { ok: false, error: 'Squad inválido' }
  return { ok: true, squadIds: unique }
}
