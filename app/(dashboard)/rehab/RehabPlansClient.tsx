'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AthleteAvatar } from '@/components/ui/AthleteAvatar'
import { Plus, ChevronDown, ChevronRight, CalendarClock, LayoutGrid, List } from 'lucide-react'
import { OWNER_ROLE, REHAB_ROLES } from '@/lib/roles'
import {
  PlanModal, PlanDetail, formatShort,
  type RehabPlanOccurrenceOption, type RehabPlanAthleteOption,
} from '@/components/rehab-plans/RehabPlanShared'
import { WeeklyCalendarView } from '@/components/rehab-plans/WeeklyCalendarView'
import type { RehabPlan, RehabPlanPeriod } from '@/types/athlete-profile'
import type { UserRole } from '@/types'

interface Athlete {
  id: string
  name: string
  shirt_number: number | null
  photo_url: string | null
  position: string | null
}

interface PlanWithAthlete extends RehabPlan {
  athletes: Athlete
}

interface RehabPlansClientProps {
  plans: PlanWithAthlete[]
  athletes: Athlete[]
  occurrences: RehabPlanOccurrenceOption[]
  role: UserRole
  squadId: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Ativo',      color: 'var(--sophi-green)',  bg: 'var(--sophi-green-bg)' },
  completed: { label: 'Concluído',  color: 'var(--sophi-text2)',  bg: 'var(--sophi-bg4)' },
  archived:  { label: 'Arquivado',  color: 'var(--sophi-text3)',  bg: 'var(--sophi-bg4)' },
}

function planStatus(p: RehabPlan): keyof typeof STATUS_CONFIG {
  if (p.is_active) return 'active'
  return p.is_completed ? 'completed' : 'archived'
}

function PlanRow({
  plan, athleteOptions, occurrences, canEdit, expanded, onToggle, onChanged,
}: {
  plan: PlanWithAthlete
  athleteOptions: RehabPlanAthleteOption[]
  occurrences: RehabPlanOccurrenceOption[]
  canEdit: boolean
  expanded: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const a = plan.athletes
  const status = STATUS_CONFIG[planStatus(plan)]
  const rtpDone = (plan.rtp_criteria ?? []).filter((c) => c.done).length
  const rtpTotal = (plan.rtp_criteria ?? []).length

  return (
    <div style={{ background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)', borderRadius: 10, overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <Link href={`/athletes/${plan.athlete_id}`} onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <AthleteAvatar photoUrl={a?.photo_url ?? null} shirtNumber={a?.shirt_number ?? null} name={a?.name ?? '—'} size={36} />
        </Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sophi-text)' }}>{plan.title}</div>
          <div style={{ fontSize: 11, color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}>
            <Link href={`/athletes/${plan.athlete_id}`} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none' }}>
              {a?.name ?? '—'}
            </Link>
            {' · '}{a?.position ?? '—'} · {formatShort(plan.start_date)}
            {plan.expected_end_date ? ` → ${formatShort(plan.expected_end_date)}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {rtpTotal > 0 && (
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-dm-mono)', fontWeight: 700,
              padding: '2px 7px', borderRadius: 999,
              background: rtpDone === rtpTotal ? 'var(--sophi-green-bg)' : 'var(--sophi-bg4)',
              color: rtpDone === rtpTotal ? 'var(--sophi-green)' : 'var(--sophi-text3)',
            }}>
              RTP {rtpDone}/{rtpTotal}
            </span>
          )}
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-dm-mono)', fontWeight: 700,
            padding: '2px 8px', borderRadius: 999, background: status.bg, color: status.color,
          }}>
            {status.label}
          </span>
        </div>
        {expanded ? <ChevronDown size={14} color="var(--sophi-text3)" /> : <ChevronRight size={14} color="var(--sophi-text3)" />}
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--sophi-border)', padding: '12px 16px' }}>
          <PlanDetail
            plan={plan}
            athletes={athleteOptions}
            occurrences={occurrences.filter((o) => o.athlete_id === plan.athlete_id)}
            canEdit={canEdit}
            onPlanChanged={onChanged}
          />
        </div>
      )}
    </div>
  )
}

export function RehabPlansClient({ plans, athletes, occurrences, role }: RehabPlansClientProps) {
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [filter, setFilter] = useState<'active' | 'all' | 'history'>('active')
  const [showRegister, setShowRegister] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const router = useRouter()

  const canEdit = role === OWNER_ROLE || REHAB_ROLES.includes(role)

  const filtered = plans.filter((p) => {
    if (filter === 'active') return p.is_active
    if (filter === 'history') return !p.is_active
    return true
  })

  const activePlans = plans.filter((p) => p.is_active)
  const calendarRows = activePlans.map((p) => ({
    planId: p.id,
    athleteId: p.athlete_id,
    athleteName: p.athletes?.name ?? '—',
    shirtNumber: p.athletes?.shirt_number ?? null,
    photoUrl: p.athletes?.photo_url ?? null,
    position: p.athletes?.position ?? null,
    title: p.title,
  }))

  const athleteOptions: RehabPlanAthleteOption[] = athletes.map((a) => ({ id: a.id, name: a.name, shirt_number: a.shirt_number }))
  const activeCount = plans.filter((p) => p.is_active).length

  function refresh() { router.refresh() }

  function handleCalendarCellClick(planId: string, date: string, period: RehabPlanPeriod) {
    // Switch to list view and expand the target plan
    setView('list')
    setFilter('active')
    setExpandedId(planId)
  }

  return (
    <div>
      {/* Header */}
      <div className="sec-hdr">
        <div>
          <div className="sec-title">Reabilitação</div>
          <div className="sec-sub">Planos de reabilitação dia-a-dia do plantel</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--sophi-border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={() => setView('list')}
              title="Vista lista"
              style={{
                display: 'flex', alignItems: 'center', padding: '6px 10px', cursor: 'pointer', border: 'none',
                background: view === 'list' ? 'var(--sophi-green)' : 'var(--sophi-bg3)',
                color: view === 'list' ? '#000' : 'var(--sophi-text3)',
              }}
            >
              <List size={13} />
            </button>
            <button
              onClick={() => setView('calendar')}
              title="Vista calendário"
              style={{
                display: 'flex', alignItems: 'center', padding: '6px 10px', cursor: 'pointer', border: 'none',
                borderLeft: '1px solid var(--sophi-border)',
                background: view === 'calendar' ? 'var(--sophi-green)' : 'var(--sophi-bg3)',
                color: view === 'calendar' ? '#000' : 'var(--sophi-text3)',
              }}
            >
              <LayoutGrid size={13} />
            </button>
          </div>

          {canEdit && (
            <button
              onClick={() => setShowRegister(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                background: 'var(--sophi-green)', border: 'none',
                color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              Registar Plano
            </button>
          )}
        </div>
      </div>

      {/* ── Vista Calendário ───────────────────────────────────────────── */}
      {view === 'calendar' && (
        <div style={{ background: 'var(--sophi-bg2)', border: '1px solid var(--sophi-border)', borderRadius: 12, padding: '16px' }}>
          <WeeklyCalendarView
            plans={calendarRows}
            canEdit={canEdit}
            onCellClick={handleCalendarCellClick}
          />
        </div>
      )}

      {/* ── Vista Lista ────────────────────────────────────────────────── */}
      {view === 'list' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {([['all', 'Todos'], ['active', `Ativos (${activeCount})`], ['history', 'Histórico']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                style={{
                  fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                  fontFamily: 'var(--font-dm-mono)',
                  background: filter === v ? 'var(--sophi-green)' : 'var(--sophi-bg3)',
                  border: filter === v ? 'none' : '1px solid var(--sophi-border)',
                  color: filter === v ? '#000' : 'var(--sophi-text2)',
                  fontWeight: filter === v ? 700 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Plans list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)', fontSize: 12 }}>
                <CalendarClock size={20} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                {filter === 'active' ? 'Sem planos ativos' : filter === 'history' ? 'Sem planos no histórico' : 'Sem planos de reabilitação registados'}
              </div>
            ) : (
              filtered.map((p) => (
                <PlanRow
                  key={p.id}
                  plan={p}
                  athleteOptions={athleteOptions}
                  occurrences={occurrences}
                  canEdit={canEdit}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId((cur) => (cur === p.id ? null : p.id))}
                  onChanged={refresh}
                />
              ))
            )}
          </div>
        </>
      )}

      {showRegister && (
        <PlanModal
          athletes={athleteOptions}
          existing={null}
          occurrences={occurrences}
          onClose={() => setShowRegister(false)}
          onSaved={() => { setShowRegister(false); refresh() }}
        />
      )}
    </div>
  )
}
