import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton'
import { BASE_WEIGHTS_V1 } from '@/lib/scoring/engine'
import { getSquadIdParam, withSquadParam } from '@/lib/squad-url'
import { AthleteProfileClient } from '@/components/athlete-profile/AthleteProfileClient'
import { getLatestRecommendations } from '@/lib/actions/recommendations'
import { getViewerContext } from '@/lib/data/auth'
import type { UserRole } from '@/types'
import type { AthleteProfileData, TabId, InjuryEventSummary, ActiveDiagnosis, ActiveOccurrence } from '@/types/athlete-profile'

const VALID_TABS: TabId[] = ['overview', 'medical', 'injuries', 'treatments', 'documents']

function parseTab(raw: string | string[] | undefined): TabId {
  const s = Array.isArray(raw) ? raw[0] : raw
  return VALID_TABS.includes(s as TabId) ? (s as TabId) : 'overview'
}

export default function AthleteDetailPage(props: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={<DashboardSkeleton title="A carregar perfil" />}>
      {props.params.then(({ id }) => (
        <AthleteDetailContent id={id} searchParams={props.searchParams} />
      ))}
    </Suspense>
  )
}

async function AthleteDetailContent({
  id,
  searchParams,
}: {
  id: string
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearch = searchParams ? await searchParams : {}
  const squadId   = getSquadIdParam(resolvedSearch)
  const activeTab = parseTab(resolvedSearch.tab)
  const supabase  = await createClient()
  const injuryEventColumns = 'id, injury_date, return_date, diagnosis, location, severity, is_recurrence'

  // Athletes may only ever view their own profile — RLS already enforces this
  // at the data layer, but fail fast here to skip the queries below entirely.
  const viewer = await getViewerContext()
  if (viewer.role === 'athlete' && viewer.athleteId !== id) notFound()

  // ── Core athlete data ──────────────────────────────────────────────────────
  const { data: athlete, error } = await supabase
    .from('athletes')
    .select(`
      id, name, shirt_number, photo_url, position, date_of_birth, club, status, availability_status,
      score_history (score_date, total_score, acwr_partial, hrv_partial, fatigue_partial, sleep_partial, tqr_partial, history_partial, stress_partial, decel_partial, confidence, days_since_match)
    `)
    .eq('id', id)
    .order('score_date',   { referencedTable: 'score_history',    ascending: false })
    .limit(30, { referencedTable: 'score_history' })
    .single()

  if (error || !athlete) notFound()

  const [activeInjuriesResult, resolvedInjuriesResult] = await Promise.all([
    supabase
      .from('injury_events')
      .select(injuryEventColumns)
      .eq('athlete_id', id)
      .is('return_date', null)
      .order('injury_date', { ascending: false }),
    supabase
      .from('injury_events')
      .select(injuryEventColumns)
      .eq('athlete_id', id)
      .not('return_date', 'is', null)
      .order('injury_date', { ascending: false })
      .limit(50),
  ])

  if (activeInjuriesResult.error || resolvedInjuriesResult.error) {
    throw new Error('Failed to load athlete injury events')
  }

  // ── Medical history ────────────────────────────────────────────────────────
  const { data: medicalHistory } = await supabase
    .from('athletes_medical_history')
    .select('*')
    .eq('athlete_id', id)
    .maybeSingle()

  // ── Latest EMD ─────────────────────────────────────────────────────────────
  const { data: latestEmd } = await supabase
    .from('emd_submissions')
    .select('*')
    .eq('athlete_id', id)
    .order('submission_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Baseline SCAT-6 ────────────────────────────────────────────────────────
  const { data: baselineScat6 } = await supabase
    .from('scat6_assessments')
    .select('*')
    .eq('athlete_id', id)
    .eq('is_baseline', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Active concussion assessment ───────────────────────────────────────────
  const { data: activeConcussion } = await supabase
    .from('scat6_assessments')
    .select('*')
    .eq('athlete_id', id)
    .eq('is_baseline', false)
    .in('diagnosis', ['confirmed', 'suspected'])
    .gt('rtp_current_stage', 0)
    .lt('rtp_current_stage', 6)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Active diagnoses + occurrences (clinical module) ─────────────────────
  const [{ data: activeDiagnoses }, { data: activeOccurrences }] = await Promise.all([
    supabase
      .from('diagnoses')
      .select('id, osiics_code, osiics_description, diagnosis_type, custom_description, availability_status, diagnosed_at, is_resolved')
      .eq('athlete_id', id)
      .eq('is_resolved', false)
      .order('diagnosed_at', { ascending: false }),
    supabase
      .from('occurrences')
      .select('id, occurrence_date, occurrence_type, availability_status, subjective')
      .eq('athlete_id', id)
      .eq('is_resolved', false)
      .order('occurrence_date', { ascending: false }),
  ])

  // ── Document + consultation counts ────────────────────────────────────────
  const [{ count: documentCount }, { count: consultationCount }] = await Promise.all([
    supabase
      .from('medical_documents')
      .select('id', { count: 'exact', head: true })
      .eq('athlete_id', id)
      .eq('is_archived', false),
    supabase
      .from('medical_consultations')
      .select('id', { count: 'exact', head: true })
      .eq('athlete_id', id),
  ])

  // ── Latest recommendations ─────────────────────────────────────────────────
  const recommendations = await getLatestRecommendations(id)
  const viewerRole = (viewer.role ?? 'athlete') as UserRole

  // ── Score computations ────────────────────────────────────────────────────
  const latestScore = athlete.score_history?.[0]
  const score = latestScore ? Math.round(latestScore.total_score * 100) : null

  const riskLevel =
    score === null ? null :
    score < 40     ? 'low'      :
    score < 65     ? 'medium'   :
    score < 85     ? 'high'     : 'critical'

  const confidence = (latestScore?.confidence ?? 'low') as 'high' | 'medium' | 'low'

  const sparkData: (number | null)[] = (athlete.score_history ?? [])
    .slice(0, 7)
    .reverse()
    .map((s) => Math.round(s.total_score * 100))

  const partials: Record<string, number | null> = latestScore
    ? {
        history: latestScore.history_partial,
        acwr:    latestScore.acwr_partial,
        hrv:     latestScore.hrv_partial,
        fatigue: latestScore.fatigue_partial,
        sleep:   latestScore.sleep_partial,
        tqr:     latestScore.tqr_partial,
        stress:  latestScore.stress_partial,
        decel:   latestScore.decel_partial,
        md:      null,
      }
    : {
        history: null, acwr: null, hrv: null, fatigue: null,
        sleep: null, tqr: null, stress: null, decel: null, md: null,
      }

  let dominantVariable: string | null = null
  let maxContrib = 0
  for (const [k, v] of Object.entries(partials)) {
    if (v !== null) {
      const w = BASE_WEIGHTS_V1[k as keyof typeof BASE_WEIGHTS_V1] ?? 0
      const contrib = v * w
      if (contrib > maxContrib) {
        maxContrib = contrib
        dominantVariable = k
      }
    }
  }

  // ── Age + BMI ─────────────────────────────────────────────────────────────
  const age = athlete.date_of_birth
    // Server-rendered profile age is intentionally evaluated at request time.
    // eslint-disable-next-line react-hooks/purity
    ? Math.floor((Date.now() - new Date(athlete.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  const bmi = medicalHistory?.height_cm && medicalHistory?.weight_kg
    ? medicalHistory.weight_kg / Math.pow(medicalHistory.height_cm / 100, 2)
    : null

  // ── Injury events → InjuryEventSummary ───────────────────────────────────
  const injuryEvents: InjuryEventSummary[] = [
    ...(activeInjuriesResult.data ?? []),
    ...(resolvedInjuriesResult.data ?? []),
  ]
    .sort((a, b) => new Date(b.injury_date).getTime() - new Date(a.injury_date).getTime())
    .map((inj) => ({
    id:          inj.id,
    injury_date: inj.injury_date,
    return_date: inj.return_date ?? null,
    diagnosis:   inj.diagnosis ?? 'Lesão não especificada',
    location:    inj.location ?? null,
    severity:    inj.severity ?? null,
    is_active:   !inj.return_date,
    }))

  // ── Assemble profile ──────────────────────────────────────────────────────
  const rawAthlete = athlete as typeof athlete & { availability_status?: string | null }
  const availabilityStatus = rawAthlete.availability_status
    ?? (athlete.status === 'rehab' ? 'rtp' : 'available')

  const profile: AthleteProfileData = {
    id:                athlete.id,
    name:              athlete.name,
    shirt_number:      athlete.shirt_number ?? null,
    photo_url:         rawAthlete.photo_url ?? null,
    position:          athlete.position ?? null,
    date_of_birth:     athlete.date_of_birth ?? null,
    club:              athlete.club ?? null,
    status:            athlete.status ?? 'available',
    availabilityStatus,
    score,
    riskLevel,
    confidence,
    sparkData,
    partials,
    dominantVariable,
    age,
    bmi,
    medicalHistory:    medicalHistory ?? null,
    latestEmd:         latestEmd ?? null,
    baselineScat6:     baselineScat6 ?? null,
    activeConcussion:  activeConcussion ?? null,
    injuryEvents,
    activeDiagnoses:   (activeDiagnoses ?? []) as ActiveDiagnosis[],
    activeOccurrences: (activeOccurrences ?? []) as ActiveOccurrence[],
    documentCount:     documentCount ?? 0,
    consultationCount: consultationCount ?? 0,
    recommendations,
    viewerRole,
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Back link */}
      <Link
        href={withSquadParam('/athletes', squadId)}
        className="inline-flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--aura-text)]"
        style={{ color: 'var(--aura-text3)' }}
      >
        <ArrowLeft size={13} />
        Plantel
      </Link>

      {/* Tabbed profile */}
      <AthleteProfileClient profile={profile} activeTab={activeTab} />
    </div>
  )
}
