export interface MicrocycleStatus {
  label: string       // "MD-3", "MD", "MD+1", "Sem jogo"
  mdOffset: number    // -3, 0, 1, etc. (null if no match within range)
  nextMatchDate: string | null
  prevMatchDate: string | null
  microcycleNumber: number | null
}

/**
 * Calculate MD (Match Day) status for a given date based on known match days.
 * Supports multiple matches per week (congested schedule).
 *
 * Logic:
 * - Looks for the nearest upcoming match (or same day) → gives MD-N
 * - If no upcoming match within 14 days, looks at last past match → gives MD+N
 * - Microcycle number is inferred from the sequence of match days
 */
export function calculateMDStatus(
  date: string,
  matchDays: string[],
): MicrocycleStatus {
  if (!matchDays.length) {
    return { label: 'Sem jogo', mdOffset: 0, nextMatchDate: null, prevMatchDate: null, microcycleNumber: null }
  }

  const d = parseDate(date)
  const sorted = [...matchDays].map(parseDate).sort((a, b) => a - b)

  // Find next match (today or future)
  const upcoming = sorted.filter((m) => m >= d)
  // Find past matches
  const past = sorted.filter((m) => m < d)

  const nextMatch = upcoming[0] ?? null
  const prevMatch = past[past.length - 1] ?? null

  // Primary reference: the nearest match. A same-day match is MD. If a past
  // match is closer than the next one, we're in that match's post-match window
  // (MD+N of the previous microcycle), not yet in the build-up to the next.
  if (nextMatch !== null) {
    const daysUntil = Math.round((nextMatch - d) / 86400000)

    if (prevMatch !== null) {
      const daysSince = Math.round((d - prevMatch) / 86400000)
      if (daysSince < daysUntil) {
        // Chronological match number from the sorted list; lastIndexOf so two
        // matches on the same day count the second as the current microcycle.
        const mcNumber = sorted.lastIndexOf(prevMatch) + 1
        return {
          label: `MD+${daysSince}`,
          mdOffset: daysSince,
          nextMatchDate: formatDate(nextMatch),
          prevMatchDate: formatDate(prevMatch),
          microcycleNumber: mcNumber,
        }
      }
    }

    if (daysUntil <= 14) {
      // On the match day itself, a same-day double-header belongs to the LAST of
      // that day's matches (so occurrences count toward the later MC); during the
      // build-up we're heading to the first match of the target day.
      const mcNumber = (daysUntil === 0 ? sorted.lastIndexOf(nextMatch) : sorted.indexOf(nextMatch)) + 1
      const label = daysUntil === 0 ? 'MD' : `MD-${daysUntil}`
      return {
        label,
        mdOffset: -daysUntil,
        nextMatchDate: formatDate(nextMatch),
        prevMatchDate: prevMatch ? formatDate(prevMatch) : null,
        microcycleNumber: mcNumber,
      }
    }
  }

  // Secondary: days after last match
  if (prevMatch !== null) {
    const daysSince = Math.round((d - prevMatch) / 86400000)
    const mcNumber = sorted.lastIndexOf(prevMatch) + 1
    return {
      label: `MD+${daysSince}`,
      mdOffset: daysSince,
      nextMatchDate: nextMatch ? formatDate(nextMatch) : null,
      prevMatchDate: formatDate(prevMatch),
      microcycleNumber: mcNumber,
    }
  }

  return { label: 'Sem jogo', mdOffset: 0, nextMatchDate: null, prevMatchDate: null, microcycleNumber: null }
}

function parseDate(s: string): number {
  return new Date(s + 'T00:00:00').getTime()
}

function formatDate(ts: number): string {
  // Format in local time to mirror parseDate's local-midnight parsing. Using
  // toISOString() here would shift the date a day in zones east of UTC (e.g.
  // Portugal summer time), breaking matchDays.indexOf() lookups.
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Weekday tables (Sunday-first, matching Date.getUTCDay()) for deterministic
// formatting. toLocaleDateString's weekday rendering differs between the server
// (Node ICU renders pt 'short' as the full "segunda") and browsers (Safari
// renders "seg."), which causes an SSR hydration mismatch. Build the string
// ourselves so the server and client always produce identical output.
const WEEKDAYS_SHORT: Record<string, string[]> = {
  pt: ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  es: ['dom.', 'lun.', 'mar.', 'mié.', 'jue.', 'vie.', 'sáb.'],
}

export function formatDisplayDate(dateStr: string, locale = 'pt-PT'): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  // UTC noon so the weekday is timezone-independent and identical on both sides.
  const weekday = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
  const table = WEEKDAYS_SHORT[locale.slice(0, 2)] ?? WEEKDAYS_SHORT.pt
  return `${table[weekday]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// The club's local timezone defines the "today" boundary. Server components run
// in the server process timezone (UTC on Vercel), so getFullYear()/getDate()
// would resolve to the UTC day — just after local midnight east of UTC (e.g.
// Portugal on summer time) that is still yesterday, making the default
// dashboard date and microcycle compute for the wrong day. Configurable via
// NEXT_PUBLIC_CLUB_TIMEZONE; defaults to the platform's home timezone.
const CLUB_TIMEZONE = process.env.NEXT_PUBLIC_CLUB_TIMEZONE || 'Europe/Lisbon'

export function todayStr(): string {
  // en-CA renders as YYYY-MM-DD; timeZone pins it to the club's calendar day.
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLUB_TIMEZONE }).format(new Date())
}
