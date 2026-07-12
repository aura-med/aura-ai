// app/(dashboard)/rehab/[sessionId]/page.tsx
// Issue #20: individual session with phase gates, clinical assessment, override modal, audit log

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getProtocol, evaluatePhase, getPhaseStatus } from '@/lib/rehab/protocol-engine'
import type { ClinicalAssessment, ProgressionOverride } from '@/types/rehab'
import RehabSessionClient from './RehabSessionClient'

interface Props {
  params: Promise<{ sessionId: string }>
}

export default async function RehabSessionPage({ params }: Props) {
  const { sessionId } = await params
  const supabase = await createClient()

  const { data: session, error } = await supabase
    .from('rehab_sessions')
    .select(`
      *,
      athletes (
        id, name, shirt_number, position, club, date_of_birth,
        injury_events(injury_date, return_date, diagnosis, severity, location)
      ),
      rehab_protocols ( * )
    `)
    .eq('id', sessionId)
    .order('injury_date', { referencedTable: 'injury_events', ascending: false })
    .single()

  if (error || !session) notFound()

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
  const injuryEvents = (session.athletes as { injury_events?: unknown[] } | null)?.injury_events ?? []
  const activeInjury = (injuryEvents as Array<{
    injury_date: string; return_date: string | null
    diagnosis: string | null; severity: string | null; location: string | null
  }>).find((inj) => !inj.return_date) ?? injuryEvents[0] ?? null

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
