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

// Pure calendar-date arithmetic, entirely independent of any local
// timezone: parsing at local noon and re-extracting via toISOString()
// (the previous approach) round-trips through whichever runtime's local
// offset is in effect, which silently drops a day for a viewer in
// UTC+13/+14 (Pacific/Chatham, Pacific/Kiritimati) — noon's 12-hour buffer
// isn't enough to survive an offset past 12 hours, so toISOString() can
// still land on the ORIGINAL UTC date after advancing by a full day. Only
// ever constructing/reading via Date.UTC()/getUTCFullYear() etc. below has
// no local timezone in the computation at all, so it can't be wrong in
// any timezone — and, as a side effect, gives the same result whether run
// on the server or in any viewer's browser.
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return next.toISOString().split('T')[0]
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

// Reads the UTC offset in effect for CLUB_TIMEZONE at a given instant, e.g.
// "+01:00". `longOffset` is a real Intl.DateTimeFormat option (not a custom
// format), widely supported in evergreen runtimes.
function utcOffsetAt(instant: Date): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: CLUB_TIMEZONE, timeZoneName: 'longOffset' })
    .formatToParts(instant)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00'
  const match = part.match(/GMT([+-]\d{2}):?(\d{2})?/)
  return `${match?.[1] ?? '+00'}:${match?.[2] ?? '00'}`
}

// The UTC instant for local midnight at the START of `dateStr` in the
// club's configured timezone — not the viewer's browser timezone, which can
// differ from the club's (a clinician traveling, or just a misconfigured
// OS clock) and would otherwise misplace a diagnosis/reassessment logged
// near either day boundary under the adjacent calendar day.
//
// Sampling the offset at a fixed reference time (e.g. noon) and applying it
// to midnight breaks specifically on the two DST-transition days each year:
// Europe/Lisbon's transitions happen at 01:00 UTC, so midnight and noon can
// straddle the transition and land in DIFFERENT offset regimes. Applying
// noon's offset to midnight on the March transition shifts the boundary an
// hour early (pulling in an hour of the preceding day); on the October
// transition it shifts an hour late (dropping the selected day's first
// hour).
//
// Self-correct instead, iterating to a fixed point: treat the date string
// as if it were already UTC to get a first guess, read the offset actually
// in effect AT that guess, and rebuild — repeating until the offset stops
// changing. A single correction pass (read the offset once, rebuild once)
// is NOT enough for an east-of-UTC zone with a large positive offset (e.g.
// Australia/Sydney, UTC+10/+11): the initial guess can land clean on the
// WRONG side of a transition that, in absolute UTC terms, falls many hours
// before local midnight — reading an offset that's actually correct for a
// LATER instant than the true local midnight, not for local midnight
// itself. Each iteration's rebuilt candidate is a strictly better estimate
// of the true instant, so this converges in at most a couple of passes.
// Verified by brute-force ground truth against Lisbon, New York, Sydney
// (both transitions each), Kolkata's half-hour offset, and
// Pacific/Chatham's 45-minute one.
//
// A zone whose spring-forward transition lands exactly at local midnight
// (e.g. Asia/Beirut, which jumps 00:00 -> 01:00) has no fixed point to
// converge to at all: local 00:00 on that date is a genuine gap — it never
// occurs on the clock — so applying the pre-transition offset overshoots
// PAST the transition (landing on an instant the post-transition offset
// disagrees with) while applying the post-transition offset undershoots
// BEFORE it (landing on an instant the pre-transition offset disagrees
// with). The iteration oscillates between exactly those two instants
// forever instead of converging, and a fixed iteration cap would just
// return whichever one it happened to land on last. Detect the repeat and
// resolve it directly instead: a gap can only be created by the clock
// jumping FORWARD, so the pre-transition offset is always the smaller of
// the two, and applying the SMALLER offset to local midnight always
// produces the LATER of the two UTC candidates — which is exactly the
// transition instant itself (the first genuinely valid moment of this
// calendar date, e.g. Beirut's 01:00 local right after the jump). Take the
// later (max) of the two colliding candidates.
export function clubMidnightUTC(dateStr: string): Date {
  let candidate = new Date(`${dateStr}T00:00:00Z`)
  const seen = new Set<number>()
  for (let i = 0; i < 5; i++) {
    const offset = utcOffsetAt(candidate)
    const next = new Date(`${dateStr}T00:00:00${offset}`)
    if (next.getTime() === candidate.getTime()) return next
    if (seen.has(next.getTime())) return new Date(Math.max(next.getTime(), candidate.getTime()))
    seen.add(candidate.getTime())
    candidate = next
  }
  return candidate
}
