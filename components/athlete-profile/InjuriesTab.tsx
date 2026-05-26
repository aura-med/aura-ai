'use client'

import { AlertTriangle, CheckCircle2, Clock, Brain, Shield } from 'lucide-react'
import type { AthleteProfileData, InjuryEventSummary, Scat6Assessment } from '@/types/athlete-profile'
import { RTP_STAGES } from '@/types/athlete-profile'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function severityConfig(severity: string | null) {
  switch (severity) {
    case 'minor':    return { label: 'Minor',    color: 'var(--aura-green)',  bg: 'var(--aura-green-bg)'  }
    case 'moderate': return { label: 'Moderada', color: 'var(--aura-warn)',   bg: 'var(--aura-warn-bg)'   }
    case 'major':    return { label: 'Major',    color: '#ff9330',            bg: 'rgba(255,147,48,0.12)' }
    case 'severe':   return { label: 'Severa',   color: 'var(--aura-danger)', bg: 'var(--aura-danger-bg)' }
    default:         return { label: severity ?? '—', color: 'var(--aura-text3)', bg: 'var(--aura-bg4)' }
  }
}

function durationDays(start: string, end: string | null) {
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  const days = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
  return days
}

// ── Injury Card ───────────────────────────────────────────────────────────────

function InjuryCard({ inj }: { inj: InjuryEventSummary }) {
  const sev = severityConfig(inj.severity)
  const days = durationDays(inj.injury_date, inj.return_date)
  const isActive = inj.is_active

  return (
    <div
      className="rounded-xl border p-4 space-y-3 transition-colors"
      style={{
        background: 'var(--aura-bg2)',
        borderColor: isActive ? 'var(--aura-danger)' : 'var(--aura-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {isActive
            ? <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--aura-danger)' }} />
            : <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--aura-green)' }} />
          }
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--aura-text)' }}>
              {inj.diagnosis}
            </p>
            {inj.location && (
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>
                {inj.location}
              </p>
            )}
          </div>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: sev.bg, color: sev.color }}
        >
          {sev.label}
        </span>
      </div>

      {/* Dates + duration */}
      <div className="flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1" style={{ color: 'var(--aura-text3)' }}>
          <Clock size={10} />
          <span>{formatDate(inj.injury_date)}</span>
        </div>
        {inj.return_date && (
          <>
            <span style={{ color: 'var(--aura-border2)' }}>→</span>
            <span style={{ color: 'var(--aura-text3)' }}>{formatDate(inj.return_date)}</span>
          </>
        )}
        <span
          className="ml-auto font-mono font-bold"
          style={{ color: isActive ? 'var(--aura-danger)' : 'var(--aura-text3)' }}
        >
          {isActive ? `${days}d afastado` : `${days}d`}
        </span>
      </div>
    </div>
  )
}

// ── Concussion / RTP Section ──────────────────────────────────────────────────

function ConcussionSection({ scat6 }: { scat6: Scat6Assessment }) {
  const currentStage = scat6.rtp_current_stage

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-danger)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ background: 'var(--aura-danger-bg)' }}
      >
        <Brain size={13} style={{ color: 'var(--aura-danger)' }} />
        <p className="text-[11px] font-bold uppercase tracking-wider flex-1" style={{ color: 'var(--aura-danger)' }}>
          Protocolo Concussão Ativo
        </p>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--aura-danger)', color: '#fff' }}
        >
          Fase {currentStage} / 6
        </span>
      </div>

      {/* RTP stages */}
      <div className="p-4 space-y-2">
        {RTP_STAGES.map((stage) => {
          const isDone = currentStage > stage.stage
          const isCurrent = currentStage === stage.stage
          const isPending = currentStage < stage.stage

          return (
            <div
              key={stage.stage}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5"
              style={{
                background: isCurrent ? 'var(--aura-warn-bg)' : isPending ? 'transparent' : 'var(--aura-green-bg)',
                opacity: isPending ? 0.5 : 1,
              }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5"
                style={{
                  background: isDone ? 'var(--aura-green)' : isCurrent ? 'var(--aura-warn)' : 'var(--aura-bg4)',
                  color: isDone || isCurrent ? '#fff' : 'var(--aura-text3)',
                }}
              >
                {isDone ? '✓' : stage.stage}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs font-semibold"
                  style={{ color: isDone ? 'var(--aura-green)' : isCurrent ? 'var(--aura-warn)' : 'var(--aura-text3)' }}
                >
                  {stage.name}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>
                  {stage.desc}
                </p>
                <p className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--aura-text3)' }}>
                  Mín. {stage.hours}h
                </p>
              </div>
              {isCurrent && (
                <Shield size={12} style={{ color: 'var(--aura-warn)', flexShrink: 0, marginTop: 2 }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyInjuries() {
  return (
    <div
      className="rounded-xl border border-dashed py-10 flex flex-col items-center gap-2"
      style={{ borderColor: 'var(--aura-border2)' }}
    >
      <CheckCircle2 size={22} style={{ color: 'var(--aura-green)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--aura-text2)' }}>
        Sem lesões registadas
      </p>
      <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>
        Histórico limpo esta época
      </p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function InjuriesTab({ profile }: { profile: AthleteProfileData }) {
  const active   = profile.injuryEvents.filter((i) => i.is_active)
  const resolved = profile.injuryEvents.filter((i) => !i.is_active)

  return (
    <div className="space-y-6">
      {/* Active concussion protocol */}
      {profile.activeConcussion && (
        <ConcussionSection scat6={profile.activeConcussion} />
      )}

      {/* Active injuries */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
            Lesões Ativas
          </p>
          {active.length > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--aura-danger-bg)', color: 'var(--aura-danger)' }}
            >
              {active.length}
            </span>
          )}
        </div>

        {active.length === 0 ? (
          <div
            className="rounded-xl border py-6 flex flex-col items-center gap-1.5"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            <CheckCircle2 size={18} style={{ color: 'var(--aura-green)' }} />
            <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>Sem lesões ativas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((inj) => <InjuryCard key={inj.id} inj={inj} />)}
          </div>
        )}
      </div>

      {/* Resolved injuries */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
          Histórico de Lesões
          {resolved.length > 0 && (
            <span className="ml-2 font-mono" style={{ color: 'var(--aura-text3)' }}>({resolved.length})</span>
          )}
        </p>

        {resolved.length === 0 && active.length === 0
          ? <EmptyInjuries />
          : resolved.length === 0
            ? <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>Sem lesões resolvidas</p>
            : (
              <div className="space-y-3">
                {resolved.map((inj) => <InjuryCard key={inj.id} inj={inj} />)}
              </div>
            )
        }
      </div>
    </div>
  )
}
