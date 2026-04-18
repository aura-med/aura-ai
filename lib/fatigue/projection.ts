// 14-day fatigue/risk projection model
// Port of projectScore() from Aura_Demo_FPF.html
// Models accumulated match fatigue with individual recovery profiles

import type { CalendarEvent, FatigueProfile } from '@/types'

interface ProjectionPoint {
  day: number
  score: number
  event: CalendarEvent
}

const INTENSITY_LOAD: Record<string, number> = {
  low:    3,
  medium: 6,
  high:   10,
  max:    15,
}

export function projectScore(
  baseScore: number,
  events: CalendarEvent[],
  profile: FatigueProfile
): ProjectionPoint[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  )

  let score = baseScore
  let matchFatigue = 0
  const results: ProjectionPoint[] = []

  for (const event of sorted) {
    const dayIndex = sorted.indexOf(event) + 1

    switch (event.event_type) {
      case 'match': {
        const congestion = Math.min(matchFatigue * profile.congestion_sensitivity * 0.15, 20)
        const matchDrop = profile.typical_md1_drop * profile.recovery_speed + congestion
        score = Math.min(100, score + matchDrop)
        matchFatigue += 10
        break
      }
      case 'training': {
        const load = INTENSITY_LOAD[event.intensity ?? 'medium'] ?? 6
        score = Math.min(100, score + load * 0.3)
        matchFatigue = Math.max(0, matchFatigue - 1.5)
        break
      }
      case 'rest': {
        const recovery = (9 + matchFatigue * 0.12) * profile.recovery_speed
        score = Math.max(5, score - recovery)
        matchFatigue = Math.max(0, matchFatigue - 3)
        break
      }
      case 'travel': {
        score = Math.min(100, score + 4)
        break
      }
    }

    score = Math.round(score)
    results.push({ day: dayIndex, score, event })
  }

  return results
}
