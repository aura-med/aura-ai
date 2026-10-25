import { describe, it, expect } from 'vitest'
import { CreateAthleteSchema, UpdateAthleteSchema } from './athlete'
import { canUseNationality } from '@/lib/nationalities'

const SQUAD_ID = '11111111-1111-4111-8111-111111111111'

describe('CreateAthleteSchema', () => {
  it('accepts a name-only payload and nulls the optional fields', () => {
    const r = CreateAthleteSchema.safeParse({ squad_id: SQUAD_ID, name: '  Rui Costa  ' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.name).toBe('Rui Costa')
      expect(r.data.shirt_number).toBeNull()
      expect(r.data.position).toBeNull()
      expect(r.data.club).toBeNull()
    }
  })

  it('rejects an empty name', () => {
    expect(CreateAthleteSchema.safeParse({ squad_id: SQUAD_ID, name: '   ' }).success).toBe(false)
  })

  it('rejects an unknown position and an out-of-range shirt number', () => {
    expect(CreateAthleteSchema.safeParse({ squad_id: SQUAD_ID, name: 'A', position: 'ST' }).success).toBe(false)
    expect(CreateAthleteSchema.safeParse({ squad_id: SQUAD_ID, name: 'A', shirt_number: 100 }).success).toBe(false)
  })

  it('rejects a future date of birth', () => {
    expect(CreateAthleteSchema.safeParse({ squad_id: SQUAD_ID, name: 'A', date_of_birth: '2999-01-01' }).success).toBe(false)
    expect(CreateAthleteSchema.safeParse({ squad_id: SQUAD_ID, name: 'A', date_of_birth: '2001-05-04' }).success).toBe(true)
  })

  it('bounds the menstrual day to the DB check (1-35)', () => {
    expect(CreateAthleteSchema.safeParse({ squad_id: SQUAD_ID, name: 'A', menstrual_day: 36 }).success).toBe(false)
    expect(CreateAthleteSchema.safeParse({ squad_id: SQUAD_ID, name: 'A', menstrual_day: 14 }).success).toBe(true)
  })

  it('only accepts nationalities from the list', () => {
    expect(CreateAthleteSchema.safeParse({ squad_id: SQUAD_ID, name: 'A', nationality: 'Cape Verde' }).success).toBe(true)
    expect(CreateAthleteSchema.safeParse({ squad_id: SQUAD_ID, name: 'A', nationality: 'Narnia' }).success).toBe(false)
    const empty = CreateAthleteSchema.safeParse({ squad_id: SQUAD_ID, name: 'A', nationality: '' })
    expect(empty.success && empty.data.nationality).toBeNull()
  })
})

describe('UpdateAthleteSchema / canUseNationality', () => {
  it('lets a legacy nationality through the schema but not through canUseNationality when changed', () => {
    const r = UpdateAthleteSchema.safeParse({ squad_id: SQUAD_ID, name: 'A', nationality: 'Portuguesa' })
    expect(r.success && r.data.nationality).toBe('Portuguesa')
    expect(canUseNationality('Portuguesa', 'Portuguesa')).toBe(true)
    expect(canUseNationality('Portuguesa', 'Portugal')).toBe(false)
    expect(canUseNationality('Portugal', 'Portuguesa')).toBe(true)
    expect(canUseNationality(null, 'Portuguesa')).toBe(true)
  })
})
