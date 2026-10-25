import { describe, it, expect } from 'vitest'
import {
  canInviteUsers, canManageUsers, canEditSquads, inviteRolesFor, inviteRoleAllowed, validateSquadAssignment,
} from './permissions'

describe('user admin permissions', () => {
  it('invite: owner and doctor only; manage: owner only', () => {
    expect(canInviteUsers('owner')).toBe(true)
    expect(canInviteUsers('doctor')).toBe(true)
    expect(canInviteUsers('physio')).toBe(false)
    expect(canManageUsers('owner')).toBe(true)
    expect(canManageUsers('doctor')).toBe(false)
    expect(canEditSquads('doctor')).toBe(true)
    expect(canEditSquads('coach')).toBe(false)
  })

  it('a doctor can never invite an owner; nobody invites athletes', () => {
    expect(inviteRoleAllowed('doctor', 'owner')).toBe(false)
    expect(inviteRoleAllowed('doctor', 'physio')).toBe(true)
    expect(inviteRoleAllowed('owner', 'owner')).toBe(true)
    expect(inviteRoleAllowed('owner', 'athlete')).toBe(false)
    expect(inviteRolesFor('coach')).toEqual([])
  })

  it('squad-scoped roles need at least one accessible squad', () => {
    const mine = new Set(['a', 'b'])
    expect(validateSquadAssignment('physio', [], mine)).toEqual({ ok: false, error: 'Selecione pelo menos um squad' })
    expect(validateSquadAssignment('physio', ['a', 'a'], mine)).toEqual({ ok: true, squadIds: ['a'] })
    expect(validateSquadAssignment('physio', ['a', 'x'], mine).ok).toBe(false)
    expect(validateSquadAssignment('owner', ['x'], mine)).toEqual({ ok: true, squadIds: [] })
  })
})
