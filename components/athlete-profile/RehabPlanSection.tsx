'use client'

// Per-athlete rehab plan section, embedded inside TreatmentsTab. The actual
// calendar/phases/modals live in components/rehab-plans/RehabPlanShared.tsx,
// shared with the squad-wide /rehab page — same relationship as
// components/occurrences/OccurrenceRow.tsx has with /occurrences and the
// athlete profile's Overview tab.
import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, ChevronRight, ChevronDown, CalendarClock } from 'lucide-react'
import { OWNER_ROLE, REHAB_ROLES } from '@/lib/roles'
import {
  PlanModal, PlanDetail, fetchRehabPlans, formatShort,
  type RehabPlanOccurrenceOption,
} from '@/components/rehab-plans/RehabPlanShared'
import type { AthleteProfileData, RehabPlan } from '@/types/athlete-profile'

export function RehabPlanSection({ profile }: { profile: AthleteProfileData }) {
  const canEdit = profile.viewerRole === OWNER_ROLE || REHAB_ROLES.includes(profile.viewerRole)

  const [plans, setPlans] = useState<RehabPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [plansVersion, setPlansVersion] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedPastId, setExpandedPastId] = useState<string | null>(null)

  const loadPlans = useCallback(() => setPlansVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const rows = await fetchRehabPlans(profile.id)
        if (!cancelled) setPlans(rows)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [profile.id, plansVersion])

  const occurrences: RehabPlanOccurrenceOption[] = profile.activeOccurrences.map((o) => ({
    id: o.id,
    athlete_id: profile.id,
    title: o.title,
    occurrence_type: o.occurrence_type,
    occurrence_date: o.occurrence_date,
  }))

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--sophi-text3)' }} /></div>
  }

  const activePlan = plans.find((p) => p.is_active) ?? null
  const pastPlans = plans.filter((p) => !p.is_active)

  return (
    <div className="space-y-4">
      {activePlan ? (
        <PlanDetail plan={activePlan} athleteName={profile.name} occurrences={occurrences} canEdit={canEdit} onPlanChanged={loadPlans} />
      ) : (
        <div className="rounded-xl border p-8 flex flex-col items-center gap-3 text-center" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
          <CalendarClock size={22} style={{ color: 'var(--sophi-text3)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--sophi-text)' }}>Sem plano de reabilitação ativo</p>
          {canEdit && (
            <button type="button" onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg" style={{ background: 'var(--sophi-green)', color: '#000' }}>
              <Plus size={12} /> Criar Plano de Reabilitação
            </button>
          )}
        </div>
      )}

      {pastPlans.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text2)' }}>
              Histórico de Planos ({pastPlans.length})
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--sophi-border)' }}>
            {pastPlans.map((p) => (
              <div key={p.id}>
                <button type="button" onClick={() => setExpandedPastId((cur) => (cur === p.id ? null : p.id))}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium" style={{ color: 'var(--sophi-text)' }}>{p.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--sophi-text3)' }}>
                      {formatShort(p.start_date)} – {formatShort(p.closed_at?.slice(0, 10) ?? p.expected_end_date)} · {p.is_completed ? 'Concluído' : 'Arquivado'}
                    </p>
                  </div>
                  {expandedPastId === p.id ? <ChevronDown size={13} style={{ color: 'var(--sophi-text3)' }} /> : <ChevronRight size={13} style={{ color: 'var(--sophi-text3)' }} />}
                </button>
                {expandedPastId === p.id && (
                  <div className="px-4 pb-4">
                    <PlanDetail plan={p} athleteName={profile.name} occurrences={occurrences} canEdit={false} onPlanChanged={loadPlans} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateModal && (
        <PlanModal athleteId={profile.id} existing={null} occurrences={occurrences}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => { setShowCreateModal(false); loadPlans() }} />
      )}
    </div>
  )
}
