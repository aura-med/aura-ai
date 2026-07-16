// app/(dashboard)/rehab/[sessionId]/page.tsx
// Issue #20: individual session with phase gates, clinical assessment, override modal, audit log

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { canUseSquad, getViewerContext } from '@/lib/data/auth'
import { getSquadIdParam } from '@/lib/squad-url'
import { getProtocol, evaluatePhase, getPhaseStatus } from '@/lib/rehab/protocol-engine'
import type { ClinicalAssessment, ProgressionOverride } from '@/types/rehab'
import RehabSessionClient from './RehabSessionClient'

interface Props {
  params: Promise<{ sessionId: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function RehabSessionPage({ params, searchParams }: Props) {
  const { sessionId } = await params
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const viewer = await getViewerContext()
  if (!canUseSquad(viewer, squadId)) notFound()

  const supabase = await createClient()

  let query = supabase
    .from('rehab_sessions')
    .select(`
      *,
      athletes!inner (
        id, name, shirt_number, position, club, date_of_birth, squad_id,
        injury_events(injury_date, return_date, diagnosis, severity, location)
      ),
      rehab_protocols ( * )
    `)
    .eq('id', sessionId)

  if (squadId) query = query.eq('athletes.squad_id', squadId)

  const { data: session, error } = await query.single()

  if (error || !session) notFound()

  const athlete = session.athletes as { squad_id?: string | null; injury_events?: unknown[] } | null
  if (squadId && athlete?.squad_id !== squadId) notFound()

  const protocol = getProtocol(session.rehab_protocols?.key ?? '')
  if (!protocol) notFound()

  const assessment = (session.clinical_data ?? {}) as ClinicalAssessment
  const currentPhaseId: number = session.current_phase_id ?? 1

  // Evaluate all phases
  const phaseEligibilities = protocol.phases.map(phase => ({
    phase,
    status: getPhaseStatus(phase, currentPhaseId, assessment),
    eligibility: evaluatePhase(phase, assessment),
  }))

  const currentEligibility = phaseEligibilities.find(p => p.phase.id === currentPhaseId)
  const canAdvance = currentEligibility?.eligibility.all_gates_passed ?? false
  const blockingGates = currentEligibility?.eligibility.blocking_gates ?? []
  const overrideLog = (session.override_log ?? []) as ProgressionOverride[]

  // Active injury: no return_date, or most recent if all recovered
  const injuryEvents = [...(athlete?.injury_events ?? [])] as Array<{
    injury_date: string; return_date: string | null
    diagnosis: string | null; severity: string | null; location: string | null
  }>
  injuryEvents.sort((a, b) => new Date(b.injury_date).getTime() - new Date(a.injury_date).getTime())
  const activeInjury = injuryEvents.find((inj) => !inj.return_date) ?? injuryEvents[0] ?? null

  return (
    <RehabSessionClient
      session={session}
      protocol={protocol}
      assessment={assessment}
      phaseEligibilities={phaseEligibilities}
      canAdvance={canAdvance}
      blockingGates={blockingGates}
      overrideLog={overrideLog}
      currentPhaseId={currentPhaseId}
      startDate={(session.start_date as string | null) ?? null}
      activeInjury={activeInjury as {
        injury_date: string; return_date: string | null
        diagnosis: string | null; severity: string | null; location: string | null
      } | null}
    />
  )
}
