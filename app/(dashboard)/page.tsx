import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSquadIdParam } from '@/lib/squad-url'
import { calcScore, riskColor, riskLabel } from '@/lib/scoring'
import { calculateMDStatus, todayStr, addDays } from '@/lib/utils/microcycle'
import { DashboardClient } from './DashboardClient'
import { OWNER_ROLE, CLINICAL_ROLES } from '@/lib/roles'
import type { AthleteAvailabilityStatus } from '@/types'

async function getData(squadId: string | null, date: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user?.id ?? '')
    .single()
  const orgId = viewerProfile?.org_id ?? null
  // occurrences/occurrence_records/diagnoses RLS (018) only grants SELECT to
  // owner/doctor/physio/masseur — reasonByAthleteId is empty for anyone else,
  // so the dashboard must not offer the expand-to-see-reason affordance to
  // them (it would just read as "nothing happened" instead of "no access").
  const viewerRole = viewerProfile?.role ?? null
  const canReadClinical = viewerRole === OWNER_ROLE || (viewerRole !== null && CLINICAL_ROLES.includes(viewerRole))
  // coach/fitness_coach can't read occurrences/diagnoses at all (RLS, same
  // as above), but 040's own header names them as the intended audience for
  // the load-management restrictions checklist — they need to know WHAT to
  // restrict even though they can't see WHY. get_squad_load_management_
  // restrictions (081) exposes only that narrow projection.
  const canApplyLoadManagement = viewerRole === 'coach' || viewerRole === 'fitness_coach'
  let loadManagementRestrictionsByAthleteId: Record<string, { restrictions: string[]; notes: string | null }> = {}
  if (canApplyLoadManagement) {
    const { data } = await supabase.rpc('get_squad_load_management_restrictions')
    loadManagementRestrictionsByAthleteId = Object.fromEntries(
      (data ?? []).map((row: { athlete_id: string; restrictions: string[] | null; notes: string | null }) =>
        [row.athlete_id, { restrictions: row.restrictions ?? [], notes: row.notes ?? null }]),
    )
  }

  let orgName: string | null = null
  if (orgId) {
    const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
    orgName = org?.name ?? null
  }

  let athleteQuery = supabase
    .from('athletes')
    .select(`
      id, name, shirt_number, photo_url, position, club, status,
      availability_status,
      wellness_checkins(*), injury_events(*), score_history(*)
    `)
    .eq('active', true)
    .order('shirt_number')

  if (squadId) athleteQuery = athleteQuery.eq('squad_id', squadId)

  const { data: athletes } = await athleteQuery

  // Fetch match days for microcycle calculation
  let matchQuery = supabase
    .from('calendar_events')
    .select('event_date')
    .eq('is_match_day', true)
    .order('event_date')

  if (squadId) matchQuery = matchQuery.eq('squad_id', squadId)

  const { data: matchEvents } = await matchQuery

  const matchDays = (matchEvents ?? []).map((e: { event_date: string }) => e.event_date)
  const microcycle = calculateMDStatus(date, matchDays)

  // Calendar events for the dashboard month view — a wide window so the
  // client can flip months without refetching (season calendars are small).
  let eventsQuery = supabase
    .from('calendar_events')
    .select('id, event_date, event_type, label, is_match_day, opponent, venue')
    .gte('event_date', addDays(date, -90))
    .lte('event_date', addDays(date, 180))
    .order('event_date')
    .limit(500)
  if (squadId) eventsQuery = eventsQuery.eq('squad_id', squadId)
  const { data: calendarEvents } = await eventsQuery

  // Active occurrences — the "Registos Clínicos Diários" export lists one row
  // per athlete with an open clinical issue, matching the club's own paper
  // form (title/description + current decision), not the full roster.
  const athleteIds = (athletes ?? []).map((a: { id: string }) => a.id)
  let occurrences: {
    id: string
    athlete_id: string
    title: string | null
    occurrence_type: string | null
    subjective: string | null
    availability_status: string | null
    load_management_restrictions: string[] | null
    load_management_notes: string | null
    created_at: string
    updated_at: string | null
    // Which of the 3 write paths (updateOccurrence's direct edit,
    // createDiagnosis/updateDiagnosis's mirror, addOccurrenceRecord's mirror)
    // last decided this occurrence's status — set explicitly by each of
    // them, so the dashboard doesn't have to (unreliably) infer it from
    // comparing timestamps across tables.
    decision_source: 'own' | 'diagnosis' | 'reassessment'
    athletes: { name: string } | { name: string }[] | null
    diagnoses: { id: string; osiics_description: string | null; custom_description: string | null; is_resolved: boolean; availability_status: string | null; load_management_restrictions: string[] | null; load_management_notes: string | null; diagnosed_at: string; updated_at: string | null }[] | null
  }[] = []
  if (athleteIds.length) {
    const { data } = await supabase
      .from('occurrences')
      .select(`
        id, athlete_id, title, occurrence_type, subjective, availability_status,
        load_management_restrictions, load_management_notes, created_at, updated_at,
        decision_source,
        athletes ( name ),
        diagnoses ( id, osiics_description, custom_description, is_resolved, availability_status, load_management_restrictions, load_management_notes, diagnosed_at, updated_at )
      `)
      .in('athlete_id', athleteIds)
      .eq('is_resolved', false)
      .order('occurrence_date', { ascending: false })
    occurrences = data ?? []
  }

  // Latest reassessment per occurrence — addOccurrenceRecord always syncs the
  // parent occurrence's status/updated_at on insert, so a reassessment can be
  // the true current source of an occurrence's decision even when an open
  // diagnosis also exists (if the reassessment was logged after the
  // diagnosis). Needed to pick the right description below instead of always
  // preferring the diagnosis.
  const occurrenceIds = occurrences.map((o) => o.id)
  let latestRecordByOccurrenceId = new Map<string, { description: string; restrictions: string[]; notes: string | null; status: string | null; at: string }>()
  if (occurrenceIds.length) {
    const { data, error } = await supabase
      .from('occurrence_records')
      .select('occurrence_id, assessment, availability_status, load_management_restrictions, load_management_notes, created_at')
      .in('occurrence_id', occurrenceIds)
      .order('created_at', { ascending: false })
    // A silently-dropped failure here would fall back to `data: null`, and
    // every occurrence whose decision_source is 'reassessment' would then
    // wrongly show its own stale title instead of the actual reassessment —
    // a misattributed reason/PDF row that looks like a successful page load.
    if (error) throw new Error(`Não foi possível carregar as reavaliações: ${error.message}`)
    latestRecordByOccurrenceId = new Map()
    for (const r of data ?? []) {
      // Ordered desc, so the first row seen per occurrence_id is its latest.
      if (latestRecordByOccurrenceId.has(r.occurrence_id)) continue
      latestRecordByOccurrenceId.set(r.occurrence_id, {
        description: r.assessment || '—',
        restrictions: r.load_management_restrictions ?? [],
        notes: r.load_management_notes,
        status: r.availability_status,
        at: r.created_at,
      })
    }
  }

  // All active diagnoses for these athletes — not just occurrence_id IS NULL
  // ones. A diagnosis stays active after its parent occurrence is resolved,
  // so relying on occurrence_id alone would miss it (the occurrence's
  // is_resolved=false filter above already excludes it from `occurrences`,
  // and it's not orphaned either since occurrence_id is still set). Anything
  // already nested under one of the open occurrences fetched above is
  // excluded below to avoid feeding it into the winning-event pool twice.
  let allActiveDiagnoses: {
    id: string
    athlete_id: string
    occurrence_id: string | null
    osiics_description: string | null
    custom_description: string | null
    availability_status: string | null
    load_management_restrictions: string[] | null
    load_management_notes: string | null
    diagnosed_at: string
    updated_at: string | null
    athletes: { name: string } | { name: string }[] | null
  }[] = []
  if (athleteIds.length) {
    const { data, error } = await supabase
      .from('diagnoses')
      .select(`
        id, athlete_id, occurrence_id, osiics_description, custom_description,
        availability_status, load_management_restrictions, load_management_notes, diagnosed_at, updated_at,
        athletes ( name )
      `)
      .in('athlete_id', athleteIds)
      .eq('is_resolved', false)
    // A silently-dropped failure here would fall back to "no active
    // diagnoses" — standalone diagnoses and ones attached to a resolved
    // occurrence would vanish from the expanded reasons/PDF even though the
    // athlete's stored availability is still restricted by them.
    if (error) throw new Error(`Não foi possível carregar os diagnósticos: ${error.message}`)
    allActiveDiagnoses = data ?? []
  }
  const openOccurrenceIds = new Set(occurrences.map((o) => o.id))
  const looseDiagnoses = allActiveDiagnoses.filter(
    (d) => !d.occurrence_id || !openOccurrenceIds.has(d.occurrence_id)
  )

  // Clinical staff roster ("D.Clínico:") for the export header — physios/
  // masseurs before doctors, matching the club's own form.
  const ROLE_ORDER: Record<string, number> = { physio: 0, masseur: 1, doctor: 2 }
  let clinicalStaff: { name: string; role: string }[] = []
  if (orgId) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('org_id', orgId)
      .in('role', ['physio', 'masseur', 'doctor'])
    clinicalStaff = (data ?? [])
      .filter((p): p is { full_name: string; role: string } => !!p.full_name)
      .map((p) => ({ name: p.full_name, role: p.role }))
      .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9))
  }

  return {
    athletes: athletes ?? [], microcycle, calendarEvents: calendarEvents ?? [], occurrences, looseDiagnoses,
    latestRecordByOccurrenceId, clinicalStaff, orgName, canReadClinical, canApplyLoadManagement,
    loadManagementRestrictionsByAthleteId,
  }
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  // Opt out of the cached/prerendered shell (Next.js Cache Components) so
  // availability_status writes from occurrences/diagnoses show up immediately
  // instead of a stale snapshot — mirrors /rehab/page.tsx's same fix.
  await connection()
  const params = searchParams ? await searchParams : {}
  const squadId = getSquadIdParam(params)
  // The dashboard always shows today — there's no more date-navigation UI to
  // request a historical day (the reconstructed "as of that day" snapshot
  // was inherently unreliable; see the calendar tab for actual day history).
  const currentDate = todayStr()

  const {
    athletes, microcycle, calendarEvents, occurrences, looseDiagnoses, latestRecordByOccurrenceId,
    clinicalStaff, orgName, canReadClinical, canApplyLoadManagement, loadManagementRestrictionsByAthleteId,
  } = await getData(squadId, currentDate)

  // One row per athlete, not per occurrence — an athlete with several open
  // occurrences previously produced one export row each, sometimes with
  // conflicting decision colors since each occurrence only carries its own
  // (possibly stale) snapshot of availability_status. `occurrences` is
  // already ordered by date desc, so the first one seen per athlete is the
  // most recent (used for the description); the decision column always
  // reflects the athlete's actual current status, not that snapshot.
  const currentStatusByAthleteId = new Map(athletes.map((a) => [a.id, a.availability_status]))

  // Per athlete, find the clinical event that's actually driving their
  // current status — the same "most recent write wins" rule
  // recomputeAthleteAvailability uses (occurrence.updated_at ?? created_at,
  // or a diagnosis's diagnosed_at, whichever is later) — not just "the first
  // occurrence returned". Picking by occurrence_date/array-order instead
  // could show an unrelated occurrence's title/restrictions when an older
  // occurrence was the one most recently reassessed.
  type WinningEvent = {
    athleteName: string
    description: string
    restrictions: string[]
    notes: string | null
    at: string
    // The event's own availability_status — distinct from the athlete's
    // actual current status (currentStatusByAthleteId), which can differ
    // when the active-rehab RTP floor overrides this event's status below.
    status: string | null
  }
  const winningEventByAthleteId = new Map<string, WinningEvent>()
  for (const o of occurrences) {
    const athlete = Array.isArray(o.athletes) ? o.athletes[0] : o.athletes
    const athleteName = athlete?.name ?? '—'
    // decision_source says exactly which of the 3 write paths last decided
    // this occurrence's status — no need to infer it from comparing
    // timestamps across tables (which broke down whenever a genuinely later
    // direct edit landed within the same few seconds as an unrelated mirror
    // write). Each branch falls back to the occurrence's own data if its
    // named source turns out to be unavailable (e.g. decision_source is
    // 'diagnosis' but that diagnosis has since been resolved).
    const occAt = o.updated_at ?? o.created_at
    const openDiagnosis = (o.diagnoses ?? []).find((d) => !d.is_resolved) ?? null
    const latestRecord = latestRecordByOccurrenceId.get(o.id) ?? null

    let candidate: WinningEvent
    if (o.decision_source === 'diagnosis' && openDiagnosis) {
      candidate = {
        athleteName,
        description: openDiagnosis.osiics_description || openDiagnosis.custom_description || '—',
        restrictions: openDiagnosis.load_management_restrictions ?? [],
        notes: openDiagnosis.load_management_notes,
        at: occAt,
        status: openDiagnosis.availability_status,
      }
    } else if (o.decision_source === 'reassessment' && latestRecord) {
      candidate = {
        athleteName,
        description: latestRecord.description,
        restrictions: latestRecord.restrictions,
        notes: latestRecord.notes,
        at: occAt,
        status: latestRecord.status,
      }
    } else {
      candidate = {
        athleteName,
        description: o.title || o.subjective || o.occurrence_type || '—',
        restrictions: o.load_management_restrictions ?? [],
        notes: o.load_management_notes,
        at: occAt,
        status: o.availability_status,
      }
    }
    const current = winningEventByAthleteId.get(o.athlete_id)
    if (!current || candidate.at > current.at) winningEventByAthleteId.set(o.athlete_id, candidate)
  }

  // Diagnoses not already covered by an open occurrence above (orphaned, or
  // attached to a now-resolved one) compete in the same winning-event pool —
  // an athlete whose status is driven only by one of these would otherwise
  // be missing from clinicalOccurrences/reasonByAthleteId.
  for (const d of looseDiagnoses) {
    const athlete = Array.isArray(d.athletes) ? d.athletes[0] : d.athletes
    const candidate: WinningEvent = {
      athleteName: athlete?.name ?? '—',
      description: d.osiics_description || d.custom_description || '—',
      restrictions: d.load_management_restrictions ?? [],
      notes: d.load_management_notes,
      at: d.updated_at ?? d.diagnosed_at,
      status: d.availability_status,
    }
    const current = winningEventByAthleteId.get(d.athlete_id)
    if (!current || candidate.at > current.at) winningEventByAthleteId.set(d.athlete_id, candidate)
  }

  // recomputeAthleteAvailability treats active rehab (rehab_sessions/
  // injury_events, via the athlete_in_active_rehab RPC) as an RTP floor: it
  // can raise the athlete to 'rtp' even when the winning occurrence/diagnosis
  // above carries a lower-severity status (or there's no open one at all).
  // In both cases that event's own description is not why the athlete is
  // RTP, so it must not be shown/exported as the reason — only an event whose
  // OWN status is already 'rtp' genuinely explains it. Fall back to the
  // athlete's open injury (already fetched below for the score calc) for a
  // description whenever the floor is what's actually driving the status.
  for (const a of athletes) {
    if (a.availability_status !== 'rtp') continue
    const current = winningEventByAthleteId.get(a.id)
    if (current?.status === 'rtp') continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const injuries: any[] = a.injury_events ?? []
    const openInjury = injuries
      .filter((i) => !i.return_date)
      .sort((x, y) => new Date(y.injury_date).getTime() - new Date(x.injury_date).getTime())[0]
    winningEventByAthleteId.set(a.id, {
      athleteName: a.name,
      description: openInjury?.diagnosis || 'Reabilitação em curso',
      restrictions: [],
      notes: null,
      at: openInjury?.injury_date ?? currentDate,
      status: 'rtp',
    })
  }

  const clinicalOccurrences = Array.from(winningEventByAthleteId.entries()).map(([athleteId, event]) => ({
    athleteName: event.athleteName,
    description: event.description,
    availabilityStatus: currentStatusByAthleteId.get(athleteId) ?? 'evaluation',
  }))

  const reasonByAthleteId: Record<string, { reason?: string; restrictions: string[]; notes: string | null }> = {}
  for (const [athleteId, event] of winningEventByAthleteId) {
    reasonByAthleteId[athleteId] = { reason: event.description, restrictions: event.restrictions, notes: event.notes }
  }
  // coach/fitness_coach never populate winningEventByAthleteId above (RLS
  // hides occurrences/diagnoses from them entirely) — merge in their
  // narrower, restrictions-only projection instead. No `reason`: that field
  // is clinical text (diagnosis/occurrence description) these roles can't
  // see, so DashboardClient must never render it for these entries.
  for (const [athleteId, lm] of Object.entries(loadManagementRestrictionsByAthleteId)) {
    if (!reasonByAthleteId[athleteId]) {
      reasonByAthleteId[athleteId] = { restrictions: lm.restrictions, notes: lm.notes }
    }
  }

  const withScores = athletes.map((a) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkins: any[] = a.wellness_checkins ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const injuries: any[] = a.injury_events ?? []

    // Use the latest check-in that is not newer than the displayed day, so a
    // historical date (previous/next-day controls) shows that day's readiness
    // rather than a future check-in. checkin_date is ISO YYYY-MM-DD, so string
    // comparison orders correctly.
    const latest = checkins
      .filter((c: { checkin_date: string }) => c.checkin_date <= currentDate)
      .sort((x: { checkin_date: string }, y: { checkin_date: string }) =>
        new Date(y.checkin_date).getTime() - new Date(x.checkin_date).getTime()
      )[0]

    // Compute injury history as of the displayed day: only injuries that had
    // occurred by then, treated as open if they had no return date yet on that
    // day. Otherwise a historical date (or its PDF) would count a future injury
    // or use an injury's present open/closed state instead of the day's.
    const injuriesAsOf = injuries.filter(
      (i: { injury_date?: string | null }) => !i.injury_date || i.injury_date <= currentDate
    )
    const openAsOf = injuriesAsOf.filter(
      (i: { return_date: string | null }) => !i.return_date || i.return_date > currentDate
    )

    const inputs = {
      history: openAsOf.length >= 2 ? 2
        : injuriesAsOf.length >= 1 ? 1 : 0,
      acwr: null,
      hrv: null,
      fatigue: latest?.fatigue ?? null,
      sleep: latest?.sleep_hours ?? null,
      tqr: latest?.tqr ?? null,
      stress: latest?.stress ?? null,
      decel: null,
      md: null,
    }

    const result = calcScore(inputs)
    // NOTE: this is the materialized "now" availability. Reconstructing it
    // accurately for a historical date needs a server-side status-history
    // source (see the availability history RPC discussion) — a client-side
    // reconstruction from raw occurrence/diagnosis rows is unsafe (RLS hides
    // them from coaches) and lossy (availability_status is overwritten on
    // resolve/reassessment), so we intentionally show the current status here.
    const availabilityStatus = (a.availability_status as string) ?? 'available'

    return {
      id: a.id as string,
      name: a.name as string,
      shirt_number: a.shirt_number as number | null,
      photo_url: (a as { photo_url?: string | null }).photo_url ?? null,
      position: a.position as string | null,
      club: a.club as string | null,
      status: a.status as string,
      availability_status: (availabilityStatus as AthleteAvailabilityStatus),
      score: result.score,
      scoreColor: riskColor(result.score),
      scoreLabel: riskLabel(result.score),
    }
  })

  return (
    <DashboardClient
      athletes={withScores}
      squadId={squadId}
      currentDate={currentDate}
      microcycle={microcycle}
      calendarEvents={calendarEvents}
      clinicalOccurrences={clinicalOccurrences}
      reasonByAthleteId={reasonByAthleteId}
      canReadClinical={canReadClinical}
      canApplyLoadManagement={canApplyLoadManagement}
      clinicalStaff={clinicalStaff}
      orgName={orgName}
    />
  )
}
