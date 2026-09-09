'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { AlertTriangle, CheckCircle2, Clock, Brain, Shield, ChevronRight, ChevronLeft, Loader2, Plus } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { AthleteProfileData, InjuryEventSummary, ActiveDiagnosis, Scat6Assessment } from '@/types/athlete-profile'
import { RTP_STAGES } from '@/types/athlete-profile'

const DiagnosisModal = dynamic(() => import('./DiagnosisModal').then((m) => m.DiagnosisModal))

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function severityConfig(severity: string | null) {
  switch (severity) {
    case 'minor':    return { label: 'Minor',    color: 'var(--sophi-green)',  bg: 'var(--sophi-green-bg)'  }
    case 'moderate': return { label: 'Moderada', color: 'var(--sophi-warn)',   bg: 'var(--sophi-warn-bg)'   }
    case 'major':    return { label: 'Major',    color: '#ff9330',            bg: 'rgba(255,147,48,0.12)' }
    case 'severe':   return { label: 'Severa',   color: 'var(--sophi-danger)', bg: 'var(--sophi-danger-bg)' }
    default:         return { label: severity ?? '—', color: 'var(--sophi-text3)', bg: 'var(--sophi-bg4)' }
  }
}

function durationDays(start: string, end: string | null) {
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Injury Card ───────────────────────────────────────────────────────────────

function InjuryCard({ inj, athleteId }: { inj: InjuryEventSummary; athleteId: string }) {
  const sev      = severityConfig(inj.severity)
  const days     = durationDays(inj.injury_date, inj.return_date)
  const isActive = inj.is_active
  const searchParams = useSearchParams()
  const squadId  = searchParams.get('squadId')
  const rehabHref = `/rehab${squadId ? `?squadId=${squadId}&` : '?'}athleteId=${athleteId}`

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ background: 'var(--sophi-bg2)', borderColor: isActive ? 'var(--sophi-danger)' : 'var(--sophi-border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {isActive
            ? <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--sophi-danger)' }} />
            : <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--sophi-green)' }} />
          }
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--sophi-text)' }}>{inj.diagnosis}</p>
            {inj.location && <p className="text-[11px] mt-0.5" style={{ color: 'var(--sophi-text3)' }}>{inj.location}</p>}
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: sev.bg, color: sev.color }}>
          {sev.label}
        </span>
      </div>
      <div className="flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1" style={{ color: 'var(--sophi-text3)' }}>
          <Clock size={10} />
          <span>{formatDate(inj.injury_date)}</span>
        </div>
        {inj.return_date && (
          <>
            <span style={{ color: 'var(--sophi-border2)' }}>→</span>
            <span style={{ color: 'var(--sophi-text3)' }}>{formatDate(inj.return_date)}</span>
          </>
        )}
        <span className="ml-auto font-mono font-bold" style={{ color: isActive ? 'var(--sophi-danger)' : 'var(--sophi-text3)' }}>
          {isActive ? `${days}d afastado` : `${days}d`}
        </span>
        {!isActive && (
          <Link
            href={rehabHref}
            className="text-[10px] font-medium hover:opacity-80"
            style={{ color: 'var(--sophi-purple)', textDecoration: 'none' }}
          >
            Ver plano →
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Concussion / RTP Section ──────────────────────────────────────────────────

function ConcussionSection({ scat6 }: { scat6: Scat6Assessment }) {
  const router = useRouter()
  const [stage,    setStage]    = useState(scat6.rtp_current_stage)
  const [saving,   setSaving]   = useState(false)
  const [confirmR, setConfirmR] = useState(false)   // confirm regress

  const canAdvance  = stage < 6
  const canRegress  = stage > 0

  async function updateStage(newStage: number) {
    setSaving(true)
    setConfirmR(false)
    try {
      const supabase = createClient()

      // Build updated rtp_stages_completed
      const completed: Record<string, boolean> = { ...(scat6.rtp_stages_completed ?? {}) }
      if (newStage > stage) {
        completed[String(stage)] = true   // mark current as done
      } else {
        delete completed[String(newStage)] // clear next stage on regress
      }

      const { error } = await supabase
        .from('scat6_assessments')
        .update({ rtp_current_stage: newStage, rtp_stages_completed: completed })
        .eq('id', scat6.id)

      if (error) throw error

      setStage(newStage)
      router.refresh()
    } catch (e) {
      console.error('[rtp-stage]', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-danger)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'var(--sophi-danger-bg)' }}>
        <Brain size={13} style={{ color: 'var(--sophi-danger)' }} />
        <p className="text-[11px] font-bold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-danger)' }}>
          Protocolo Concussão Ativo
        </p>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--sophi-danger)', color: '#fff' }}>
          Fase {stage} / 6
        </span>
      </div>

      {/* Stage list */}
      <div className="p-4 space-y-2">
        {RTP_STAGES.map((s) => {
          const isDone    = stage > s.stage
          const isCurrent = stage === s.stage
          const isPending = stage < s.stage

          return (
            <div
              key={s.stage}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5"
              style={{
                background: isCurrent ? 'var(--sophi-warn-bg)' : isDone ? 'var(--sophi-green-bg)' : 'transparent',
                opacity: isPending ? 0.45 : 1,
              }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5"
                style={{
                  background: isDone ? 'var(--sophi-green)' : isCurrent ? 'var(--sophi-warn)' : 'var(--sophi-bg4)',
                  color: isDone || isCurrent ? '#fff' : 'var(--sophi-text3)',
                }}
              >
                {isDone ? '✓' : s.stage}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: isDone ? 'var(--sophi-green)' : isCurrent ? 'var(--sophi-warn)' : 'var(--sophi-text3)' }}>
                  {s.name}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--sophi-text3)' }}>{s.desc}</p>
                {s.hours > 0 && <p className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--sophi-text3)' }}>Mín. {s.hours}h</p>}
              </div>
              {isCurrent && <Shield size={12} style={{ color: 'var(--sophi-warn)', flexShrink: 0, marginTop: 2 }} />}
            </div>
          )
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t" style={{ borderColor: 'var(--sophi-border)' }}>
        {/* Regress */}
        {canRegress ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => confirmR ? updateStage(stage - 1) : setConfirmR(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: confirmR ? 'var(--sophi-danger)' : 'var(--sophi-danger-bg)',
              color: confirmR ? '#fff' : 'var(--sophi-danger)',
            }}
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <ChevronLeft size={11} />}
            {confirmR ? 'Confirmar regressão' : 'Regredir fase'}
          </button>
        ) : <div />}

        {/* Advance */}
        {canAdvance ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => { setConfirmR(false); updateStage(stage + 1) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style={{ background: 'var(--sophi-green)', color: '#000' }}
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : null}
            {stage === 0 ? 'Iniciar protocolo' : 'Avançar fase'}
            <ChevronRight size={11} />
          </button>
        ) : (
          <span className="text-xs font-bold" style={{ color: 'var(--sophi-green)' }}>
            ✓ Protocolo concluído
          </span>
        )}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyInjuries() {
  return (
    <div className="rounded-xl border border-dashed py-10 flex flex-col items-center gap-2" style={{ borderColor: 'var(--sophi-border2)' }}>
      <CheckCircle2 size={22} style={{ color: 'var(--sophi-green)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--sophi-text2)' }}>Sem lesões registadas</p>
      <p className="text-xs" style={{ color: 'var(--sophi-text3)' }}>Histórico limpo esta época</p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

function ActiveInjuryCard({ diag }: { diag: ActiveDiagnosis }) {
  const title = diag.osiics_description ?? diag.custom_description ?? 'Lesão'
  const statusColors: Record<string, { color: string; bg: string; label: string }> = {
    unavailable: { color: 'var(--sophi-danger)', bg: 'var(--sophi-danger-bg)', label: 'Indisponível' },
    evaluation:  { color: 'var(--sophi-warn)',   bg: 'var(--sophi-warn-bg)',   label: 'Em Avaliação' },
    rtp:         { color: 'var(--sophi-purple)', bg: 'rgba(180,141,252,0.12)', label: 'Em RTP'       },
    available:   { color: 'var(--sophi-green)',  bg: 'var(--sophi-green-bg)',  label: 'Disponível'   },
  }
  const sc = statusColors[diag.availability_status ?? ''] ?? statusColors.evaluation
  return (
    <div className="rounded-lg border p-3 flex items-center justify-between gap-2"
      style={{ borderColor: 'var(--sophi-danger)', borderLeftWidth: '3px', background: 'var(--sophi-bg3)' }}>
      <div className="min-w-0">
        {diag.osiics_code && (
          <span className="text-[10px] font-mono mr-1.5" style={{ color: 'var(--sophi-text3)' }}>{diag.osiics_code}</span>
        )}
        <span className="text-xs font-semibold" style={{ color: 'var(--sophi-text)' }}>{title}</span>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--sophi-text3)' }}>
          Desde {formatDate(diag.diagnosed_at)}
        </p>
      </div>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
        style={{ background: sc.bg, color: sc.color }}>
        {sc.label}
      </span>
    </div>
  )
}

export function InjuriesTab({ profile }: { profile: AthleteProfileData }) {
  const router    = useRouter()
  const [activeDiags, setActiveDiags] = useState(
    profile.activeDiagnoses.filter((d) => d.diagnosis_type === 'injury')
  )
  const resolved  = profile.injuryEvents
  const athleteId = profile.id
  const [showDiagModal, setShowDiagModal] = useState(false)

  function handleDiagSaved() {
    setShowDiagModal(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Active concussion */}
      {profile.activeConcussion && (
        <ConcussionSection scat6={profile.activeConcussion} />
      )}

      {/* Active injuries */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--sophi-text3)' }}>
            Lesões Ativas
          </p>
          {activeDiags.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' }}>
              {activeDiags.length}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowDiagModal(true)}
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-[var(--sophi-green-bg)]"
            style={{ color: 'var(--sophi-green)' }}
          >
            <Plus size={10} /> Novo diagnóstico
          </button>
        </div>
        {activeDiags.length === 0 ? (
          <div className="rounded-xl border py-6 flex flex-col items-center gap-1.5" style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}>
            <CheckCircle2 size={18} style={{ color: 'var(--sophi-green)' }} />
            <p className="text-xs" style={{ color: 'var(--sophi-text3)' }}>Sem lesões ativas</p>
          </div>
        ) : (
          <div className="space-y-3">{activeDiags.map((d) => <ActiveInjuryCard key={d.id} diag={d} />)}</div>
        )}
      </div>

      {/* Resolved injuries */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sophi-text3)' }}>
          Histórico de Lesões
          {resolved.length > 0 && <span className="ml-2 font-mono">({resolved.length})</span>}
        </p>
        {resolved.length === 0
          ? <EmptyInjuries />
          : <div className="space-y-3">{resolved.map((inj) => <InjuryCard key={inj.id} inj={inj} athleteId={athleteId} />)}</div>
        }
      </div>

      {showDiagModal && (
        <DiagnosisModal
          athleteId={athleteId}
          occurrences={profile.activeOccurrences}
          onClose={() => setShowDiagModal(false)}
          onSaved={handleDiagSaved}
        />
      )}
    </div>
  )
}
