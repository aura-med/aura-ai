export const dataTags = {
  org: (orgId: string) => `org:${orgId}`,
  squadAthletes: (squadId: string) => `squad:${squadId}:athletes`,
  athlete: (athleteId: string) => `athlete:${athleteId}`,
  athleteScore: (athleteId: string) => `athlete:${athleteId}:score`,
  athleteWellness: (athleteId: string) => `athlete:${athleteId}:wellness`,
  athleteReadiness: (athleteId: string) => `athlete:${athleteId}:readiness`,
  athleteRehab: (athleteId: string) => `athlete:${athleteId}:rehab`,
  athletePassport: (athleteId: string) => `athlete:${athleteId}:passport`,
  squadCalendar: (squadId: string) => `squad:${squadId}:calendar`,
  orgSettings: (orgId: string) => `org:${orgId}:settings`,
  orgNotifications: (orgId: string) => `org:${orgId}:notifications`,
  userPreferences: (userId: string) => `user:${userId}:preferences`,
}
