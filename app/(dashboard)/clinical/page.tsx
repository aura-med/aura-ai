import { connection } from 'next/server'
import Link from 'next/link'
import { Activity, FileText, AlertCircle, Users, CheckCircle2, ChevronRight } from 'lucide-react'
import { getSquadIdParam, withSquadParam } from '@/lib/squad-url'
import { getRehabPageDTO } from '@/lib/data/rehab'
import type { RehabSessionDTO } from '@/lib/data/types'

// ── Tab nav ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'file',   label: 'Ficheiro Clínico', icon: FileText   },
  { id: 'occurrences', label: 'Ocorrências', icon: AlertCircle },
  { id: 'rehab',  label: 'Reabilitação',     icon: Activity   },
] as const

type TabId = typeof TABS[number]['id']

function TabNav({ active, squadId }: { active: TabId; squadId: string | null }) {
  return (
    <div className="flex gap-1 border-b" style={{ borderColor: 'var(--aura-border)' }}>
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id
        return (
          <Link
            key={id}
            href={withSquadParam(`/clinical?tab=${id}`, squadId)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderColor: isActive ? 'var(--aura-green)' : 'transparent',
              color: isActive ? 'var(--aura-green)' : 'var(--aura-text3)',
            }}
          >
            <Icon size={13} />
            {label}
          </Link>
        )
      })}
    </div>
  )
}

// ── Ficheiro Clínico tab (placeholder) ───────────────────────────────────────

function FileTab({ squadId }: { squadId: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <FileText size={32} style={{ color: 'var(--aura-text3)', opacity: 0.4 }} />
      <div className="space-y-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--aura-text2)' }}>Ficheiro Clínico</p>
        <p className="text-xs max-w-xs" style={{ color: 'var(--aura-text3)' }}>
          Aceda ao ficheiro individual de cada atleta através do respectivo perfil.
        </p>
      </div>
      <Link
        href={withSquadParam('/athletes', squadId)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
        style={{ background: 'var(--aura-green)', color: '#000' }}
      >
        <Users size={13} />
        Ver lista de atletas
        <ChevronRight size={13} />
      </Link>
    </div>
  )
}

// ── Ocorrências tab (placeholder — links to clinical portal) ─────────────────

function OccurrencesTab({ squadId }: { squadId: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <AlertCircle size={32} style={{ color: 'var(--aura-text3)', opacity: 0.4 }} />
      <div className="space-y-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--aura-text2)' }}>Ocorrências Clínicas</p>
        <p className="text-xs max-w-xs" style={{ color: 'var(--aura-text3)' }}>
          Registo SOAP de queixas, traumas e doenças. Portal clínico disponível abaixo.
        </p>
      </div>
      <Link
        href={withSquadParam('/clinical-portal', squadId)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
        style={{ background: 'var(--aura-green)', color: '#000' }}
      >
        <Activity size={13} />
        Abrir portal clínico
        <ChevronRight size={13} />
      </Link>
    </div>
  )
}

// ── Rehab session card ────────────────────────────────────────────────────────

function RehabCard({ session }: { session: RehabSessionDTO }) {
  const protocol = session.protocol
  const phases = protocol?.phases ?? []
  const currentPhase = phases.find(
    (p) => session.currentDay >= p.d1 && session.currentDay <= p.d2,
  ) ?? phases[phases.length - 1]
  const progress = currentPhase
    ? Math.min(100, Math.round(((session.currentDay - currentPhase.d1) / Math.max(1, currentPhase.d2 - currentPhase.d1 + 1)) * 100))
    : 0

  const doneRtp = session.rtpCriteria.filter((c) => c.done).length
  const totalRtp = session.rtpCriteria.length

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--aura-text)' }}>
            {session.athleteName}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--aura-text3)' }}>
            {session.position ?? '—'}{session.club ? ` · ${session.club}` : ''}
          </p>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: 'rgba(180,141,252,0.12)', color: 'var(--aura-purple)' }}
        >
          RTP
        </span>
      </div>

      {protocol && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span style={{ color: 'var(--aura-text2)' }}>{protocol.name}</span>
            <span className="font-mono font-bold" style={{ color: 'var(--aura-text2)' }}>
              Dia {session.currentDay}{protocol.totalDays ? ` / ${protocol.totalDays}` : ''}
            </span>
          </div>
          {currentPhase && (
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: 'var(--aura-text3)' }}>
                <span>{currentPhase.name}</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--aura-bg4)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, background: 'var(--aura-purple)' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {totalRtp > 0 && (
        <div className="flex items-center gap-2 text-[11px]">
          <CheckCircle2 size={11} style={{ color: doneRtp === totalRtp ? 'var(--aura-green)' : 'var(--aura-text3)' }} />
          <span style={{ color: 'var(--aura-text3)' }}>
            Critérios RTP: <span className="font-mono font-bold" style={{ color: 'var(--aura-text2)' }}>{doneRtp}/{totalRtp}</span>
          </span>
        </div>
      )}

      <Link
        href={`/rehab/${session.id}`}
        className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={{ background: 'var(--aura-bg3)', color: 'var(--aura-text2)' }}
      >
        Ver protocolo completo
        <ChevronRight size={11} />
      </Link>
    </div>
  )
}

// ── Reabilitação tab ──────────────────────────────────────────────────────────

function RehabTab({ sessions }: { sessions: RehabSessionDTO[] }) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <CheckCircle2 size={28} style={{ color: 'var(--aura-green)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--aura-text2)' }}>Sem atletas em reabilitação</p>
        <p className="text-xs" style={{ color: 'var(--aura-text3)' }}>
          Atletas com estado RTP aparecerão aqui automaticamente.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--aura-text3)' }}>
          Em Reabilitação
        </p>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full font-mono"
          style={{ background: 'rgba(180,141,252,0.12)', color: 'var(--aura-purple)' }}
        >
          {sessions.length}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => (
          <RehabCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClinicalPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const params = searchParams ? await searchParams : null
  const squadId = getSquadIdParam(params)
  const rawTab = (params?.tab as string) ?? 'file'
  const activeTab: TabId = ['file', 'occurrences', 'rehab'].includes(rawTab)
    ? (rawTab as TabId)
    : 'file'

  const dto = activeTab === 'rehab' ? await getRehabPageDTO(squadId) : { sessions: [] }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
        >
          Módulo Clínico
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--aura-text3)' }}>
          Ficheiro clínico · ocorrências · reabilitação
        </p>
      </div>

      {/* Tabs */}
      <TabNav active={activeTab} squadId={squadId} />

      {/* Content */}
      {activeTab === 'file'        && <FileTab        squadId={squadId} />}
      {activeTab === 'occurrences' && <OccurrencesTab squadId={squadId} />}
      {activeTab === 'rehab'       && <RehabTab       sessions={dto.sessions} />}
    </div>
  )
}
