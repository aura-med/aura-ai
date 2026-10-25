import { describe, it, expect } from 'vitest'
import { canManageAthletes } from './roles'

describe('canManageAthletes', () => {
  it('allows owner and doctor only', () => {
    expect(canManageAthletes('owner')).toBe(true)
    expect(canManageAthletes('doctor')).toBe(true)
    for (const role of ['physio', 'masseur', 'coach', 'fitness_coach', 'nutritionist', 'director', 'scout', 'team_manager', 'athlete', null, undefined]) {
      expect(canManageAthletes(role)).toBe(false)
    }
  })
})
