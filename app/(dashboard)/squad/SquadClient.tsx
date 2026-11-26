'use client'

// Roster view — extracted from the Dashboard's old "Plantel" tab into its
// own sidebar page (user feedback: wanted it as a proper sidebar entry, not
// a tab buried inside Dashboard). Behavior is otherwise unchanged: same
// search, card/list toggle, inactive-athletes section, add/edit/remove.
import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGrid, List, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { AthleteCard } from '@/components/ui/AthleteCard'
import { withSquadParam } from '@/lib/squad-url'
import { useUiStore } from '@/stores/uiStore'
import { PlayerFormDialog, type PlayerFormSquad, type PlayerFormInitial } from '@/components/squad/PlayerFormDialog'
import { RemovePlayerDialog } from '@/components/squad/RemovePlayerDialog'
import { SquadListView } from '@/components/squad/SquadListView'
import { InactivePlayersSection, type InactiveAthlete } from '@/components/squad/InactivePlayersSection'
import type { AthleteAvailabilityStatus } from '@/types'

export interface SquadAthlete {
  id: string
  name: string
  shirt_number: number | null
  photo_url: string | null
  position: string | null
  club: string | null
  date_of_birth: string | null
  squad_id: string | null
  nationality: string | null
  menstrual_day: number | null
  cycle_length: number | null
  availability_status: AthleteAvailabilityStatus
  score: number
  scoreColor: string
  scoreLabel: string
}

interface SquadClientProps {
  athletes: SquadAthlete[]
  squadId: string | null
  canAddPlayer: boolean
  canManage: boolean
  inactiveAthletes: InactiveAthlete[]
  addPlayerSquads: PlayerFormSquad[]
  addPlayerOrg: { type: string; name: string } | null
  clubs: string[]
}

const STATUS_CONFIG: Record<AthleteAvailabilityStatus, { label: string; color: string; bg: string; dot: string }> = {
  available:       { label: 'Disponível',      color: 'var(--sophi-green)',  bg: 'color-mix(in srgb, var(--sophi-green) 6%, transparent)', dot: 'var(--sophi-green)' },
  evaluation:      { label: 'Em Avaliação',    color: 'var(--sophi-yellow)', bg: 'rgba(212,160,23,0.06)',  dot: '#d4a017' },
  load_management: { label: 'Gestão de Carga', color: 'var(--sophi-orange)', bg: 'rgba(249,115,22,0.06)',  dot: '#f97316' },
  unavailable:     { label: 'Indisponível',    color: 'var(--sophi-danger)', bg: 'rgba(255,77,109,0.06)',  dot: '#ff4d6d' },
  rtp:             { label: 'Return To Play',  color: 'var(--sophi-purple)', bg: 'rgba(180,141,252,0.06)', dot: '#b48dfc' },
}

const posLabels: Record<string, string> = { GK: 'Guarda-Redes', DEF: 'Defesas', MID: 'Médios', FWD: 'Avançados', OTHER: 'Sem posição' }
const posCodes: Record<string, string> = { GK: 'GK', DEF: 'DEF', MID: 'MED', FWD: 'AVA', OTHER: '—' }

function editInitial(a: SquadAthlete): PlayerFormInitial {
  return {
    athleteId: a.id,
    squad_id: a.squad_id ?? '',
    name: a.name,
    shirt_number: a.shirt_number,
    position: a.position,
    date_of_birth: a.date_of_birth,
    nationality: a.nationality,
    club: a.club,
    menstrual_day: a.menstrual_day,
    cycle_length: a.cycle_length,
    photo_url: a.photo_url,
  }
}

export function SquadClient({ athletes, squadId, canAddPlayer, canManage, inactiveAthletes, addPlayerSquads, addPlayerOrg, clubs }: SquadClientProps) {
  const [squadQuery, setSquadQuery] = useState('')
  const [addPlayerOpen, setAddPlayerOpen] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [editingAthlete, setEditingAthlete] = useState<SquadAthlete | null>(null)
  const [removingAthlete, setRemovingAthlete] = useState<SquadAthlete | null>(null)
  const router = useRouter()
  // The persisted view only applies after hydration; until then render cards
  // (the default) so server and client markup match.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const storedSquadView = useUiStore((s) => s.squadView)
  const setSquadView = useUiStore((s) => s.setSquadView)
  const squadView = mounted ? storedSquadView : 'cards'

  const squadSearch = squadQuery.trim().toLowerCase()
  const squadAthletes = squadSearch ? athletes.filter((a) => a.name.toLowerCase().includes(squadSearch)) : athletes

  const positionGroups: Record<string, SquadAthlete[]> = { GK: [], DEF: [], MID: [], FWD: [], OTHER: [] }
  squadAthletes.forEach((a) => {
    // Athletes without a known position still belong in the roster — bucket them
    // under "Sem posição" instead of dropping them from the view.
    if (a.position && positionGroups[a.position]) positionGroups[a.position].push(a)
    else positionGroups.OTHER.push(a)
  })

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Plantel</div>
        <div className="sec-sub">{athletes.length} atletas convocados</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div className="relative w-full max-w-xs">
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
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--sophi-bg4)]"
              aria-label="Limpar pesquisa"
            >
              <X size={12} style={{ color: 'var(--sophi-text3)' }} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <div role="group" aria-label="Vista do plantel" style={{ display: 'flex', border: '1px solid var(--sophi-border)', borderRadius: 8, overflow: 'hidden' }}>
            {([['cards', 'Vista cartões', LayoutGrid], ['list', 'Vista lista', List]] as const).map(([view, title, Icon], i) => (
              <button
                key={view}
                type="button"
                title={title}
                aria-label={title}
                aria-pressed={squadView === view}
                onClick={() => setSquadView(view)}
                style={{
                  padding: '6px 10px', cursor: 'pointer', border: 'none',
                  borderLeft: i === 1 ? '1px solid var(--sophi-border)' : 'none',
                  background: squadView === view ? 'var(--sophi-primary)' : 'var(--sophi-bg3)',
                  color: squadView === view ? 'var(--sophi-on-primary)' : 'var(--sophi-text3)',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>

          {inactiveAthletes.length > 0 && (
            <button
              type="button"
              aria-pressed={showInactive}
              onClick={() => setShowInactive((v) => !v)}
              style={{
                padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1px solid var(--sophi-border)',
                background: showInactive ? 'var(--sophi-primary)' : 'var(--sophi-bg3)',
                color: showInactive ? 'var(--sophi-on-primary)' : 'var(--sophi-text2)',
              }}
            >
              Inativos ({inactiveAthletes.length})
            </button>
          )}

          {canAddPlayer && (
            <button
              type="button"
              onClick={() => setAddPlayerOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: 'var(--sophi-primary)', color: 'var(--sophi-on-primary)',
              }}
            >
              <Plus size={13} />
              Adicionar jogador
            </button>
          )}
        </div>
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
            {squadView === 'list' ? (
              <SquadListView
                athletes={group}
                squadId={squadId}
                statusConfig={STATUS_CONFIG}
                positionCode={posCodes[pos] ?? pos}
                onEdit={canManage ? (id) => setEditingAthlete(athletes.find((x) => x.id === id) ?? null) : undefined}
                onRemove={canManage ? (id) => setRemovingAthlete(athletes.find((x) => x.id === id) ?? null) : undefined}
              />
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
              {group.map((a) => {
                const cfg = STATUS_CONFIG[a.availability_status]
                return (
                  <div key={a.id} style={{
                    position: 'relative',
                    borderRadius: 16, overflow: 'hidden',
                    border: `2px solid ${cfg.dot}`,
                    background: 'var(--sophi-bg2)',
                  }}>
                    {canManage && (
                      <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 2, display: 'flex', gap: 4 }}>
                        {([
                          ['Edit', Pencil, () => setEditingAthlete(a)],
                          ['Remove', Trash2, () => setRemovingAthlete(a)],
                        ] as const).map(([label, Icon, onClick]) => (
                          <button
                            key={label}
                            type="button"
                            title={`${label} ${a.name}`}
                            aria-label={`${label} ${a.name}`}
                            onClick={onClick}
                            style={{
                              width: 26, height: 26, borderRadius: 8, border: 'none', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'rgba(0,0,0,0.55)', color: '#fff',
                            }}
                          >
                            <Icon size={13} />
                          </button>
                        ))}
                      </div>
                    )}
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
            )}
          </div>
        )
      })}

      {canManage && addPlayerOrg && editingAthlete && (
        <PlayerFormDialog
          open
          onClose={() => setEditingAthlete(null)}
          mode="edit"
          initial={editInitial(editingAthlete)}
          squads={addPlayerSquads}
          org={addPlayerOrg}
          clubs={clubs}
        />
      )}
      {canManage && removingAthlete && (
        <RemovePlayerDialog
          open
          onClose={() => setRemovingAthlete(null)}
          athleteId={removingAthlete.id}
          name={removingAthlete.name}
          onRemoved={() => router.refresh()}
        />
      )}

      {showInactive && inactiveAthletes.length > 0 && (
        <InactivePlayersSection athletes={inactiveAthletes} squadId={squadId} />
      )}

      {canAddPlayer && addPlayerOrg && (
        <PlayerFormDialog
          mode="create"
          open={addPlayerOpen}
          onClose={() => setAddPlayerOpen(false)}
          squads={addPlayerSquads}
          defaultSquadId={squadId}
          org={addPlayerOrg}
          clubs={clubs}
        />
      )}
    </div>
  )
}
