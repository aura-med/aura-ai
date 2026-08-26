'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Download, Hourglass, Search, X } from 'lucide-react'
import { AthleteCard } from '@/components/ui/AthleteCard'
import { AthleteAvatar } from '@/components/ui/AthleteAvatar'
import { withSquadParam } from '@/lib/squad-url'
import { formatDisplayDate, addDays } from '@/lib/utils/microcycle'
import type { MicrocycleStatus } from '@/lib/utils/microcycle'
import { exportDashboardPDF, type DashboardOccurrenceRow, type ClinicalStaffMember } from '@/lib/utils/pdf-export'
import { MonthCalendar, type MonthCalendarEvent } from '@/components/dashboard/MonthCalendar'
import type { AthleteAvailabilityStatus } from '@/types'

interface DashboardAthlete {
  id: string
  name: string
  shirt_number: number | null
  photo_url: string | null
  position: string | null
  club: string | null
  availability_status: AthleteAvailabilityStatus
  status: string
  score: number
  scoreColor: string
  scoreLabel: string
}

interface DashboardClientProps {
  athletes: DashboardAthlete[]
  squadId: string | null
  currentDate: string
  microcycle: MicrocycleStatus
  isToday: boolean
  calendarEvents: MonthCalendarEvent[]
  clinicalOccurrences: DashboardOccurrenceRow[]
  clinicalStaff: ClinicalStaffMember[]
  orgName: string | null
}

const STATUS_CONFIG: Record<AthleteAvailabilityStatus, {
  label: string
  color: string
  bg: string
  border: string
  dot: string
  priority: number
}> = {
  available:       { label: 'Disponível',      color: 'var(--sophi-green)',  bg: 'rgba(0,229,160,0.06)',   border: 'rgba(0,229,160,0.2)',   dot: '#00e5a0', priority: 5 },
  evaluation:      { label: 'Em Avaliação',    color: 'var(--sophi-warn)',   bg: 'rgba(246,173,85,0.06)',  border: 'rgba(246,173,85,0.25)', dot: '#f6ad55', priority: 2 },
  load_management: { label: 'Gestão de Carga', color: 'var(--sophi-orange)', bg: 'rgba(204,85,0,0.06)',    border: 'rgba(204,85,0,0.25)',   dot: '#cc5500', priority: 3 },
  unavailable:     { label: 'Indisponível',    color: 'var(--sophi-danger)', bg: 'rgba(255,77,109,0.06)',  border: 'rgba(255,77,109,0.2)',  dot: '#ff4d6d', priority: 1 },
  rtp:             { label: 'Return To Play',  color: 'var(--sophi-purple)', bg: 'rgba(180,141,252,0.06)', border: 'rgba(180,141,252,0.2)', dot: '#b48dfc', priority: 4 },
}

const STATUS_ORDER: AthleteAvailabilityStatus[] = ['unavailable', 'evaluation', 'load_management', 'rtp', 'available']

// "Em Avaliação" isn't a semáforo colour — it's a to-do (athlete pending a clinical
// decision), so it gets its own action band instead of a slot in the traffic light.
// The remaining four render as a 2x2 grid: Disponível/Gestão de Carga on top (both
// train normally, just one is monitored), Indisponível/RTP below (both off the
// normal training plan).
const TRAFFIC_LIGHT_ORDER: AthleteAvailabilityStatus[] = ['available', 'load_management', 'unavailable', 'rtp']

export function DashboardClient({ athletes, squadId, currentDate, microcycle, isToday, calendarEvents, clinicalOccurrences, clinicalStaff, orgName }: DashboardClientProps) {
  const [tab, setTab] = useState<'overview' | 'squad' | 'calendar'>('overview')
  const [squadQuery, setSquadQuery] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigateDate(direction: -1 | 1) {
    const newDate = addDays(currentDate, direction)
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', newDate)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function goToToday() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('date')
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const byStatus = STATUS_ORDER.reduce<Record<AthleteAvailabilityStatus, DashboardAthlete[]>>(
    (acc, s) => ({ ...acc, [s]: athletes.filter((a) => a.availability_status === s) }),
    { available: [], evaluation: [], load_management: [], unavailable: [], rtp: [] }
  )

  const squadSearch = squadQuery.trim().toLowerCase()
  const squadAthletes = squadSearch ? athletes.filter((a) => a.name.toLowerCase().includes(squadSearch)) : athletes

  const positionGroups: Record<string, DashboardAthlete[]> = { GK: [], DEF: [], MID: [], FWD: [], OTHER: [] }
  squadAthletes.forEach((a) => {
    // Athletes without a known position still belong in the roster — bucket them
    // under "Sem posição" instead of dropping them from the Plantel tab.
    if (a.position && positionGroups[a.position]) positionGroups[a.position].push(a)
    else positionGroups.OTHER.push(a)
  })
  const posLabels: Record<string, string> = { GK: 'Guarda-Redes', DEF: 'Defesas', MID: 'Médios', FWD: 'Avançados', OTHER: 'Sem posição' }
  const posCodes: Record<string, string> = { GK: 'GK', DEF: 'DEF', MID: 'MED', FWD: 'AVA', OTHER: '—' }

  function handleExport() {
    exportDashboardPDF(clinicalOccurrences, clinicalStaff, { orgName, currentDate })
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div className="sec-title">Dashboard</div>
            <div className="sec-sub">Visão geral do plantel</div>
          </div>

          {/* Microcycle badge */}
          {microcycle.microcycleNumber !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--sophi-bg3)', border: '1px solid var(--sophi-border2)',
              borderRadius: 8, padding: '6px 12px',
            }}>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: 'var(--sophi-text3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                MC {microcycle.microcycleNumber}
              </span>
              <span style={{ width: 1, height: 14, background: 'var(--sophi-border2)' }} />
              <span style={{
                fontFamily: 'var(--font-syne)', fontSize: 13, fontWeight: 700,
                color: microcycle.mdOffset === 0 ? 'var(--sophi-danger)'
                  : Math.abs(microcycle.mdOffset) <= 2 ? 'var(--sophi-warn)'
                  : 'var(--sophi-text)',
              }}>
                {microcycle.label}
              </span>
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={athletes.length === 0}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              background: 'transparent', border: '1px solid var(--sophi-border2)',
              color: 'var(--sophi-text2)', fontWeight: 600, fontSize: 12,
              cursor: athletes.length === 0 ? 'default' : 'pointer',
              opacity: athletes.length === 0 ? 0.5 : 1,
            }}
          >
            <Download size={13} />
            Exportar PDF
          </button>
        </div>

        {/* Date navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigateDate(-1)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: '1px solid var(--sophi-border2)', background: 'var(--sophi-bg3)', color: 'var(--sophi-text2)', cursor: 'pointer' }}
            aria-label="Dia anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <div
            className="min-w-[140px] sm:min-w-[180px]"
            style={{
              fontFamily: 'var(--font-dm-mono)', fontSize: 12, color: 'var(--sophi-text)',
              padding: '5px 12px', borderRadius: 6, border: '1px solid var(--sophi-border2)',
              background: 'var(--sophi-bg3)', textAlign: 'center',
            }}
          >
            {formatDisplayDate(currentDate)}
          </div>
          <button
            onClick={() => navigateDate(1)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: '1px solid var(--sophi-border2)', background: 'var(--sophi-bg3)', color: 'var(--sophi-text2)', cursor: 'pointer' }}
            aria-label="Próximo dia"
          >
            <ChevronRight size={14} />
          </button>
          {!isToday && (
            <button
              onClick={goToToday}
              style={{ fontSize: 11, fontFamily: 'var(--font-dm-mono)', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--sophi-border)', background: 'transparent', color: 'var(--sophi-green)', cursor: 'pointer' }}
            >
              Hoje
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--sophi-border)', paddingBottom: 0 }}>
        {(['overview', 'squad', 'calendar'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: tab === t ? '2px solid var(--sophi-green)' : '2px solid transparent',
              color: tab === t ? 'var(--sophi-green)' : 'var(--sophi-text2)',
              marginBottom: -1,
            }}
          >
            {t === 'overview' ? 'Visão Geral' : t === 'squad' ? 'Plantel' : 'Calendário'}
          </button>
        ))}
      </div>

      {/* ── Tab: Visão Geral ─────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div>
          {/* Faixa de ação: atletas "em avaliação" ainda não têm cor — precisam de decisão clínica */}
          {byStatus.evaluation.length > 0 && (
            <div style={{
              marginBottom: 16,
              borderRadius: 12,
              border: '1px solid rgba(246,173,85,0.35)',
              background: 'linear-gradient(180deg, rgba(246,173,85,0.10), rgba(246,173,85,0.03))',
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Hourglass size={15} color="var(--sophi-warn)" className="animate-pulse" />
                <span style={{ fontFamily: 'var(--font-syne)', fontSize: 13, fontWeight: 700, color: 'var(--sophi-warn)' }}>
                  A Reavaliar
                </span>
                <span style={{
                  fontFamily: 'var(--font-dm-mono)', fontSize: 11, fontWeight: 700, color: 'var(--sophi-warn)',
                  background: 'rgba(246,173,85,0.18)', borderRadius: 999, padding: '1px 8px',
                }}>
                  {byStatus.evaluation.length}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--sophi-text3)' }}>
                  Aguardam decisão clínica
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {byStatus.evaluation.map((a) => (
                  <Link key={a.id} href={withSquadParam(`/athletes/${a.id}`, squadId)} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'var(--sophi-bg2)', border: '1px solid rgba(246,173,85,0.25)',
                      borderRadius: 999, padding: '4px 12px 4px 4px',
                    }}>
                      <AthleteAvatar photoUrl={a.photo_url} shirtNumber={a.shirt_number} name={a.name} size={26} />
                      <span style={{ fontSize: 12, color: 'var(--sophi-text)', fontWeight: 500 }}>{a.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}>
                        {a.position}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Semáforo em grelha 2x2: Disponível/Gestão de Carga em cima (treinam
              normalmente), Indisponível/RTP em baixo (fora do plano normal).
              Stacks to 1 column on phones so the named pills have room to wrap
              instead of being squeezed into a ~110px-wide slot. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TRAFFIC_LIGHT_ORDER.map((status) => {
              const cfg = STATUS_CONFIG[status]
              const group = byStatus[status]
              const isPriority = status === 'unavailable' || status === 'rtp'
              return (
                <div key={status} style={{
                  background: 'var(--sophi-bg2)',
                  border: `1px solid ${isPriority && group.length > 0 ? cfg.border : 'var(--sophi-border)'}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}>
                  {/* Group header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px',
                    background: group.length > 0 ? cfg.bg : 'transparent',
                    borderBottom: '1px solid var(--sophi-border)',
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-syne)', fontSize: 12, fontWeight: 700, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    <span style={{
                      marginLeft: 'auto', fontFamily: 'var(--font-dm-mono)', fontSize: 11,
                      fontWeight: 700, color: cfg.color,
                      background: `${cfg.dot}22`, borderRadius: 999, padding: '1px 8px',
                    }}>
                      {group.length}
                    </span>
                  </div>

                  {/* Athletes — "Disponível" stays as compact avatar circles (many
                      athletes); RTP/Indisponível use the same named-pill format as
                      the "A Reavaliar" strip above, since there are fewer of them. */}
                  <div style={{ padding: '10px 14px', minHeight: 60 }}>
                    {group.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)', textAlign: 'center', padding: '12px 0' }}>
                        —
                      </div>
                    ) : isPriority ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {group.map((a) => (
                          <Link key={a.id} href={withSquadParam(`/athletes/${a.id}`, squadId)} style={{ textDecoration: 'none' }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              background: 'var(--sophi-bg3)', border: `1px solid ${cfg.border}`,
                              borderRadius: 999, padding: '4px 12px 4px 4px',
                            }}>
                              <AthleteAvatar photoUrl={a.photo_url} shirtNumber={a.shirt_number} name={a.name} size={26} />
                              <span style={{ fontSize: 12, color: 'var(--sophi-text)', fontWeight: 500 }}>{a.name}</span>
                              <span style={{ fontSize: 10, color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}>
                                {a.position}
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {group.map((a) => (
                          <Link key={a.id} href={withSquadParam(`/athletes/${a.id}`, squadId)} title={a.name} style={{ textDecoration: 'none' }}>
                            <div style={{ position: 'relative' }}>
                              <div style={{
                                borderRadius: '50%',
                                padding: 2,
                                background: cfg.dot,
                                display: 'inline-flex',
                              }}>
                                <div style={{ borderRadius: '50%', overflow: 'hidden', width: 40, height: 40 }}>
                                  <AthleteAvatar
                                    photoUrl={a.photo_url}
                                    shirtNumber={a.shirt_number}
                                    name={a.name}
                                    size={40}
                                  />
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Calendário ──────────────────────────────────────────── */}
      {tab === 'calendar' && (
        <MonthCalendar
          key={`${squadId ?? 'all'}-${currentDate.slice(0, 7)}`}
          events={calendarEvents}
          initialDate={currentDate}
        />
      )}

      {/* ── Tab: Plantel ─────────────────────────────────────────────── */}
      {tab === 'squad' && (
        <div>
          <div className="relative max-w-xs mb-5">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--sophi-text3)' }} />
            <input
              value={squadQuery}
              onChange={(e) => setSquadQuery(e.target.value)}
              placeholder="Procurar jogador…"
              className="w-full pl-8 pr-8 py-2 rounded-lg text-xs border focus:outline-none"
              style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border2)', color: 'var(--sophi-text)' }}
            />
            {squadQuery && (
              <button
                type="button"
                onClick={() => setSquadQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10"
                aria-label="Limpar pesquisa"
              >
                <X size={12} style={{ color: 'var(--sophi-text3)' }} />
              </button>
            )}
          </div>

          {squadQuery && squadAthletes.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--sophi-text3)', textAlign: 'center', padding: '24px 0' }}>
              Sem jogadores para &quot;{squadQuery}&quot;
            </div>
          )}

          {(['GK', 'DEF', 'MID', 'FWD', 'OTHER'] as const).map((pos) => {
            const group = positionGroups[pos]
            if (!group.length) return null
            return (
              <div key={pos} style={{ marginBottom: 28 }}>
                <div style={{
                  fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em',
                  color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)',
                  marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--sophi-border)',
                }}>
                  {posLabels[pos]}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                  {group.map((a) => {
                    const cfg = STATUS_CONFIG[a.availability_status]
                    return (
                      <div key={a.id} style={{
                        borderRadius: 16, overflow: 'hidden',
                        border: `2px solid ${cfg.dot}`,
                        background: 'var(--sophi-bg2)',
                      }}>
                        <AthleteCard
                          href={withSquadParam(`/athletes/${a.id}`, squadId)}
                          name={a.name}
                          photoUrl={a.photo_url}
                          shirtNumber={a.shirt_number}
                          position={posCodes[pos] ?? pos}
                          status={a.availability_status}
                          score={a.score}
                          scoreColor={a.scoreColor}
                          scoreLabel={a.scoreLabel}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
