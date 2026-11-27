'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Activity, Plus, Edit2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { OWNER_ROLE, REHAB_ROLES } from '@/lib/roles'
import { fetchRehabPlans } from '@/components/rehab-plans/RehabPlanShared'
import type {
  AthleteProfileData,
  RehabSession,
  RehabPlan,
} from '@/types/athlete-profile'

const RehabSessionModal = dynamic(() => import('./RehabSessionModal').then((mod) => mod.RehabSessionModal))

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const SESSION_TYPE_LABEL: Record<string, string> = {
  physio:  'Fisioterapia',
  gym:     'Ginásio',
  massage: 'Massagem',
  field:   'Campo',
  other:   'Outro',
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, action, children,
}: {
  icon: React.ElementType
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
        <Icon size={13} style={{ color: 'var(--sophi-accent)' }} />
        <p className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text2)' }}>
          {title}
        </p>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label, cta, onClick }: { label: string; cta: string; onClick: () => void }) {
  return (
    <div className="py-6 flex flex-col items-center gap-2">
      <p className="text-xs" style={{ color: 'var(--sophi-text3)' }}>{label}</p>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed transition-colors hover:border-[var(--sophi-accent)] hover:text-[var(--sophi-accent)]"
        style={{ borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text3)' }}
      >
        <Plus size={11} />
        {cta}
      </button>
    </div>
  )
}

// ── Rehab Session Row ─────────────────────────────────────────────────────────

function RehabRow({ s, occurrenceLabel, planLabel, onEdit }: { s: RehabSession; occurrenceLabel?: string | null; planLabel?: string | null; onEdit?: () => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border" style={{ borderColor: 'var(--sophi-border)', background: 'var(--sophi-bg3)' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold" style={{ color: 'var(--sophi-text)' }}>
            {formatDate(s.session_date)}
          </p>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'var(--sophi-accent-bg)', color: 'var(--sophi-accent)' }}>
            {SESSION_TYPE_LABEL[s.session_type] ?? s.session_type}
          </span>
          {s.duration_minutes && (
            <span className="text-[10px]" style={{ color: 'var(--sophi-text3)' }}>{s.duration_minutes} min</span>
          )}
          {s.pse != null && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'var(--sophi-warn-bg)', color: 'var(--sophi-warn)' }}>
              PSE {s.pse}
            </span>
          )}
        </div>
        {s.exercises.length > 0 && (
          <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--sophi-text3)' }}>
            {s.exercises
              .map((ex) => {
                const parts = [ex.sets != null ? `${ex.sets}x` : null, ex.reps, ex.load].filter(Boolean)
                return parts.length ? `${ex.name} (${parts.join(' ')})` : ex.name
              })
              .join(', ')}
          </p>
        )}
        {s.description && (
          <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--sophi-text3)' }}>{s.description}</p>
        )}
        {planLabel && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--sophi-blue)' }}>↳ Plano: {planLabel}</p>
        )}
        {occurrenceLabel && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--sophi-purple)' }}>↳ {occurrenceLabel}</p>
        )}
        {s.clinician_name && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--sophi-text3)' }}>{s.clinician_name}</p>
        )}
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} className="p-1 rounded hover:bg-[var(--sophi-bg4)] shrink-0">
          <Edit2 size={11} style={{ color: 'var(--sophi-text3)' }} />
        </button>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function TreatmentsTab({ profile }: { profile: AthleteProfileData }) {
  const router = useRouter()

  // Rehab sessions have a narrower writer set (018 rehab_clinical_write: owner +
  // doctor/physio only — masseurs are excluded).
  const canRehab = profile.viewerRole === OWNER_ROLE || REHAB_ROLES.includes(profile.viewerRole)

  // Rehab sessions
  const [sessions,   setSessions]   = useState<RehabSession[]>([])
  const [loadingS,   setLoadingS]   = useState(true)

  // Rehab plans — offered as the association picker in RehabSessionModal, same
  // role as profile.activeOccurrences below (includes past/closed plans too,
  // since a physio may log a session against a plan after it closed).
  const [plans, setPlans] = useState<RehabPlan[]>([])

  // Occurrence titles for sessions associated with one — profile.activeOccurrences
  // only covers open/recent ones, which is the same set offered when creating a
  // new association, so an older resolved occurrence link just shows no label.
  const occurrenceLabelById = new Map(
    profile.activeOccurrences.map((occ) => [occ.id, occ.title || occ.occurrence_type || 'Ocorrência']),
  )
  const planLabelById = new Map(plans.map((p) => [p.id, p.title]))

  // Rehab session modal
  const [showRehabModal,  setShowRehabModal]  = useState(false)
  const [editingRehab,    setEditingRehab]    = useState<RehabSession | null>(null)

  // ── Fetch rehab sessions ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingS(true)
      try {
        const res = await fetch(`/api/athletes/${profile.id}/rehab-sessions`)
        if (!cancelled && res.ok) setSessions(await res.json())
      } finally {
        if (!cancelled) setLoadingS(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [profile.id])

  // ── Fetch rehab plans (for the session→plan association picker) ───────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const rows = await fetchRehabPlans(profile.id)
      if (!cancelled) setPlans(rows)
    }
    load()
    return () => { cancelled = true }
  }, [profile.id])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleRehabSaved(s: RehabSession) {
    setSessions((prev) => {
      const idx = prev.findIndex((x) => x.id === s.id)
      if (idx >= 0) return prev.map((x, i) => i === idx ? s : x)
      return [s, ...prev]
    })
    setShowRehabModal(false)
    setEditingRehab(null)
    router.refresh()
  }

  function handleRehabDeleted(id: string) {
    setSessions((prev) => prev.filter((x) => x.id !== id))
    setShowRehabModal(false)
    setEditingRehab(null)
    router.refresh()
  }

  return (
    <>
      <div className="space-y-4">

        {/* Treatment sessions — the rehab plan itself now lives on the Lesões tab,
            next to the injury it treats. */}
        <Section
          icon={Activity}
          title={`Sessões de Tratamento${sessions.length > 0 ? ` (${sessions.length})` : ''}`}
          action={canRehab ? (
            <button
              type="button"
              onClick={() => { setEditingRehab(null); setShowRehabModal(true) }}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--sophi-accent-bg)]"
              style={{ color: 'var(--sophi-accent)' }}
            >
              <Plus size={10} /> Nova
            </button>
          ) : undefined}
        >
          {loadingS ? (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--sophi-text3)' }} />
            </div>
          ) : sessions.length === 0 ? (
            canRehab ? (
              <EmptyState
                label="Sem sessões de fisioterapia registadas"
                cta="Nova Sessão"
                onClick={() => { setEditingRehab(null); setShowRehabModal(true) }}
              />
            ) : (
              <p className="py-6 text-center text-xs" style={{ color: 'var(--sophi-text3)' }}>Sem sessões de fisioterapia registadas</p>
            )
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <RehabRow
                  key={s.id}
                  s={s}
                  occurrenceLabel={s.occurrence_id ? occurrenceLabelById.get(s.occurrence_id) : null}
                  planLabel={s.rehab_plan_id ? planLabelById.get(s.rehab_plan_id) : null}
                  onEdit={canRehab ? () => { setEditingRehab(s); setShowRehabModal(true) } : undefined}
                />
              ))}
            </div>
          )}
        </Section>

      </div>

      {/* Modals */}
      {showRehabModal && (
        <RehabSessionModal
          athleteId={profile.id}
          existing={editingRehab}
          occurrences={profile.activeOccurrences}
          plans={plans}
          onClose={() => { setShowRehabModal(false); setEditingRehab(null) }}
          onSaved={handleRehabSaved}
          onDeleted={handleRehabDeleted}
        />
      )}
    </>
  )
}
