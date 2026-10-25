import { describe, it, expect } from 'vitest'
import { resolveSquadId } from './squad-url'

const valid = new Set(['a', 'b', 'c'])
const base = { urlSquadId: null, storedSquadId: null, defaultSquadId: null, validSquadIds: valid, firstSquadId: 'a' }

describe('resolveSquadId', () => {
  it('prefers the URL, then the stored pick, then the default, then the first squad', () => {
    expect(resolveSquadId({ ...base, urlSquadId: 'c', storedSquadId: 'b', defaultSquadId: 'b' })).toBe('c')
    expect(resolveSquadId({ ...base, storedSquadId: 'b', defaultSquadId: 'c' })).toBe('b')
    expect(resolveSquadId({ ...base, defaultSquadId: 'c' })).toBe('c')
    expect(resolveSquadId(base)).toBe('a')
  })

  it('skips ids the user cannot access', () => {
    expect(resolveSquadId({ ...base, urlSquadId: 'x', storedSquadId: 'y', defaultSquadId: 'b' })).toBe('b')
    expect(resolveSquadId({ ...base, defaultSquadId: 'x' })).toBe('a')
  })

  it('returns null when there are no squads', () => {
    expect(resolveSquadId({ ...base, validSquadIds: new Set(), firstSquadId: null, defaultSquadId: 'b' })).toBeNull()
  })
})
