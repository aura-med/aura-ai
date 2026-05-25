'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Activity, Plus, RefreshCw, AlertCircle, Stethoscope,
  Users, Brain, TrendingDown, TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { InjuryAccordionRow } from '@/components/admin/InjuryAccordionRow'
import { RecordInjuryModal } from '@/components/admin/RecordInjuryModal'
import { ToastContainer } from '@/components/admin/Toast'
import { useToast } from '@/components/admin/useToast'
import { useFederatedSync } from '@/lib/federated/useFederatedSync'
import type { ActiveRehabSession, Athlete, AvailabilityStatus } from '@/types'

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div
      className="rounded-xl border p-4 flex items-start gap-3"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <div
        className="mt-0.5 p-2 rounded-lg"
        style={{ background: color ? `${color}18` : 'var(--aura-bg3)' }}
      >
        <Icon size={15} style={{ color: color ?? 'var(--aura-text3)' }} />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
          {label}
        </p>
        <p className="text-xl font-bold mt-0.5" style={{ color: color ?? 'var(--aura-text)', fontFamily: 'var(--font-mono)' }}>
          {value}
        </p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Federated Learning status banner ─────────────────────────────────────────

function FederatedBanner({
  totalObservations,
  phase2Ready,
  onFlush,
}: {
  totalObservations: number
  phase2Ready: boolean
  onFlush: () => Promise<void>
}) {
  const [flushing, setFlushing] = useState(false)
  if (totalObservations === 0) return null
  return (
    <div
      className="rounded-xl border px-4 py-3 flex items-center justify-between gap-4"
      style={{
        background: phase2Ready ? 'rgba(0,229,160,0.06)' : 'var(--aura-bg2)',
        borderColor: phase2Ready ? 'var(--aura-green)' : 'var(--aura-border)',
      }}
    >
      <div className="flex items-center gap-2">
        <Brain size={14} style={{ color: phase2Ready ? 'var(--aura-green)' : 'var(--aura-text3)' }} />
        <span className="text-xs" style={{ color: 'var(--aura-text2)' }}>
          <strong style={{ color: phase2Ready ? 'var(--aura-green)' : 'var(--aura-text)' }}>
            Federated Learning
          </strong>
          {' · '}{totalObservations} observações locais
          {phase2Ready && ' · Pronto para actualização do modelo (Fase 2)'}
        </span>
      </div>
      <button
        type="button"
        disabled={flushing}
        onClick={async () => {
          setFlushing(true)
          await onFlush()
          setFlushing(false)
        }}
        className="text-[11px] px-3 py-1 rounded-lg font-semibold transition-all disabled:opacity-40 shrink-0"
        style={{
          background: phase2Ready ? 'var(--aura-green)' : 'var(--aura-bg3)',
          color: phase2Ready ? '#000' : 'var(--aura-text2)',
        }}
      >
        {flushing ? 'A sincronizar…' : 'Sincronizar'}
      </button>
    </div>
  )
}

// ── Availability filter chip ──────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  all:        'Todos',
  unfit:      'Indisponível',
  modified:   'Modificado',
  monitoring: 'Monitorização',
  delayed:    'Adiado',
  recovered:  'Recuperado',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MedicalPage() {
  const [sessions, setSessions]           = useState<ActiveRehabSession[]>([])
  const [athletes, setAthletes]           = useState<Athlete[]>([])
  const [loading, setLoading]             = useState(true)
  const [fetchError, setFetchError]       = useState<string | null>(null)
  const [showModal, setShowModal]         = useState(false)
  const [filterStatus, setFilterStatus]   = useState<string>('all')
  const { toasts, toast, dismiss }        = useToast()
  const { totalObservations, phase2Ready, flushToSupabase } = useFederatedSync()

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const supabase = createClient()

    // Full query — requires migration 002_medical_portal.sql (injury_event_id FK)
    const SELECT_FULL = `
      id, athlete_id, protocol_id, injury_event_id, start_date, current_day,
      rtp_criteria, clinical_data, availability_status, created_at, updated_at,
      athletes ( id, name, shirt_number, position, status ),
      rehab_protocols ( id, key, name, total_days, phases, color, evidence ),
      injury_events ( id, diagnosis, location, injury_date, severity, osiics_code, mechanism )
    `
    // Fallback query — works without the FK (migration not yet applied)
    const SELECT_FALLBACK = `
      id, athlete_id, protocol_id, start_date, current_day,
      rtp_criteria, clinical_data, availability_status, created_at, updated_at,
      athletes ( id, name, shirt_number, position, status ),
      rehab_protocols ( id, key, name, total_days, phases, color, evidence )
    `

    let { data, error } = await supabase
      .from('rehab_sessions')
      .select(SELECT_FULL)
      .order('created_at', { ascending: false })

    // PGRST200 = relationship not found in schema cache (FK column missing)
    if (error?.code === 'PGRST200') {
      console.warn(
        '[medical] injury_events relationship not found (PGRST200). ' +
        'Run supabase/migrations/002_medical_portal.sql to add the injury_event_id FK. ' +
        'Falling back to query without injury_events join.',
      )
      const fallback = await supabase
        .from('rehab_sessions')
        .select(SELECT_FALLBACK)
        .order('created_at', { ascending: false })
      // Cast to unknown first so TS accepts the narrower shape
      data = fallback.data as unknown as typeof data
      error = fallback.error
    }

    if (error) {
      console.error('[medical] fetch error:', error.code, error.message)
      setFetchError(`${error.message} (${error.code})`)
    } else {
      if (!data || data.length === 0) {
        console.warn(
          '[medical] 0 sessions returned. Check RLS policies on rehab_sessions ' +
          '— add SELECT policy for anon/authenticated roles.',
        )
      }
      setSessions((data ?? []) as unknown as ActiveRehabSession[])
    }
    setLoading(false)
  }, [])

  const fetchAthletes = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('athletes')
      .select('id, squad_id, org_id, name, shirt_number, position, date_of_birth, club, status, active, consent_date, consent_version, created_at, updated_at')
      .eq('active', true)
      .order('shirt_number')
    setAthletes((data ?? []) as unknown as Athlete[])
  }, [])

  useEffect(() => {
    fetchSessions()
    fetchAthletes()
  }, [fetchSessions, fetchAthletes])

  // ── Filtered sessions ─────────────────────────────────────────────────────
  const filtered = filterStatus === 'all'
    ? sessions
    : sessions.filter((s) => s.availability_status === filterStatus)

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalInjured  = sessions.filter((s) => s.availability_status === 'unfit').length
  const inModified    = sessions.filter((s) => s.availability_status === 'modified').length
  const inMonitoring  = sessions.filter((s) => s.availability_status === 'monitoring').length
  const recovered     = sessions.filter((s) => s.availability_status === 'recovered').length

  // Overdue vs UEFA timeline
  const overdue = sessions.filter((s) => {
    const totalDays = s.rehab_protocols?.total_days
    return totalDays && s.current_day > totalDays
  }).length

  // ── Flush handler ─────────────────────────────────────────────────────────
  async function handleFlush() {
    const { flushed, error } = await flushToSupabase()
    if (error) toast('error', `Sync parcial: ${error}`)
    else toast('success', `${flushed} deltas sincronizados com o servidor.`)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
          >
            Clinical Portal
          </h1>
          <p className="text-sm mt-1 flex items-center gap-2" style={{ color: 'var(--aura-text3)' }}>
            <Activity size={13} />
            Lesões activas · reabilitação · RTP · portal clínico
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchSessions}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors hover:bg-[var(--aura-bg3)] disabled:opacity-50"
            style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text2)' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: 'var(--aura-green)', color: '#000' }}
          >
            <Plus size={13} />
            Registar Lesão
          </button>
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          icon={Stethoscope}
          label="Indisponíveis"
          value={totalInjured}
          sub="atletas out"
          color="var(--aura-danger)"
        />
        <SummaryCard
          icon={Users}
          label="Treino Modificado"
          value={inModified}
          sub="carga reduzida"
          color="var(--aura-warn)"
        />
        <SummaryCard
          icon={Activity}
          label="Monitorização"
          value={inMonitoring}
          sub="em observação"
          color="var(--aura-blue)"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Recuperados"
          value={recovered}
          sub="esta temporada"
          color="var(--aura-green)"
        />
      </div>

      {/* Overdue warning */}
      {overdue > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ background: 'rgba(255,196,0,0.06)', borderColor: 'var(--aura-warn)' }}
        >
          <TrendingDown size={14} style={{ color: 'var(--aura-warn)' }} />
          <p className="text-xs" style={{ color: 'var(--aura-text2)' }}>
            <strong style={{ color: 'var(--aura-warn)' }}>{overdue} atleta{overdue > 1 ? 's' : ''}</strong>{' '}
            {overdue > 1 ? 'excedem' : 'excede'} o prazo de recuperação UEFA esperado.
            Reavalie o protocolo ou solicite exame clínico adicional.
          </p>
        </div>
      )}

      {/* ── Federated Learning banner ──────────────────────────────────────── */}
      <FederatedBanner
        totalObservations={totalObservations}
        phase2Ready={phase2Ready}
        onFlush={handleFlush}
      />

      {/* ── Status filter chips ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {Object.keys(STATUS_LABELS).map((s) => {
          const count = s === 'all'
            ? sessions.length
            : sessions.filter((r) => r.availability_status === s).length
          const active = filterStatus === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: active ? 'var(--aura-green)' : 'var(--aura-bg2)',
                color: active ? '#000' : 'var(--aura-text2)',
                border: `1px solid ${active ? 'var(--aura-green)' : 'var(--aura-border)'}`,
              }}
            >
              {STATUS_LABELS[s]}
              <span
                className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: active ? 'rgba(0,0,0,0.15)' : 'var(--aura-bg3)',
                  color: active ? '#000' : 'var(--aura-text3)',
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Main table ────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <RefreshCw size={18} className="animate-spin" style={{ color: 'var(--aura-text3)' }} />
            <span className="text-sm" style={{ color: 'var(--aura-text3)' }}>A carregar sessões…</span>
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 px-6 text-center">
            <AlertCircle size={24} style={{ color: 'var(--aura-danger)' }} />
            <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>Erro: {fetchError}</p>
            <button
              type="button"
              onClick={fetchSessions}
              className="px-4 py-2 rounded-lg border text-xs transition-colors hover:bg-[var(--aura-bg3)]"
              style={{ borderColor: 'var(--aura-border)', color: 'var(--aura-text2)' }}
            >
              Tentar novamente
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 px-6 text-center">
            <Activity size={28} style={{ color: 'var(--aura-text3)' }} />
            <div className="space-y-1">
              <p className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>
                {sessions.length === 0 ? 'Nenhuma sessão de reabilitação activa' : 'Nenhuma lesão com o filtro seleccionado'}
              </p>
              {sessions.length === 0 && (
                <p className="text-xs leading-relaxed" style={{ color: 'var(--aura-text3)' }}>
                  Se houver sessões no Supabase mas não aparecem aqui, verifique as políticas RLS
                  em <code className="font-mono text-[10px]">rehab_sessions</code>.
                </p>
              )}
            </div>
            {sessions.length === 0 && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: 'var(--aura-green)', color: '#000' }}
              >
                <Plus size={13} />
                Registar primeira lesão
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--aura-border)' }}>
                  {[
                    { label: '', w: 'w-8' },
                    { label: 'OSIICS', w: 'w-20' },
                    { label: 'Atleta / Diagnóstico', w: '' },
                    { label: 'Região', w: '' },
                    { label: 'Fase', w: '' },
                    { label: 'Disponibilidade', w: '' },
                    { label: 'Dias em Rehab', w: 'text-right pr-4' },
                  ].map(({ label, w }) => (
                    <th
                      key={label}
                      className={`px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap first:pl-4 ${w}`}
                      style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-mono)' }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((session, i) => (
                  <InjuryAccordionRow
                    key={session.id}
                    session={session}
                    index={i}
                    totalRows={filtered.length}
                    onUpdated={fetchSessions}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer count */}
      {!loading && !fetchError && sessions.length > 0 && (
        <p className="text-xs text-right" style={{ color: 'var(--aura-text3)' }}>
          A mostrar{' '}
          <span className="font-mono font-bold" style={{ color: 'var(--aura-text2)' }}>
            {filtered.length}
          </span>{' '}
          de{' '}
          <span className="font-mono font-bold" style={{ color: 'var(--aura-text2)' }}>
            {sessions.length}
          </span>{' '}
          sessões activas
        </p>
      )}

      {/* ── Modals & toasts ───────────────────────────────────────────────── */}
      <RecordInjuryModal
        open={showModal}
        onClose={() => setShowModal(false)}
        athletes={athletes}
        onSuccess={(newSession) => {
          setSessions((prev) => [newSession, ...prev])
          toast('success', 'Lesão registada com sucesso.')
        }}
      />
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
