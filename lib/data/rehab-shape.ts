export type RehabShapeRecord = Record<string, unknown>

function asRecord(value: unknown): RehabShapeRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RehabShapeRecord : {}
}

export function rehabSessionRootFromSession(sessionRow: RehabShapeRecord): RehabShapeRecord {
  const athlete = asRecord(sessionRow.athletes)
  return {
    id: athlete.id,
    name: athlete.name,
    position: athlete.position,
    club: athlete.club,
    injury_events: athlete.injury_events,
    rehab_sessions: [{
      ...sessionRow,
      rehab_protocols: sessionRow.rehab_protocols,
    }],
  }
}
