'use client'

import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import { AthleteAvatar } from '@/components/ui/AthleteAvatar'
import { withSquadParam } from '@/lib/squad-url'
import type { AthleteAvailabilityStatus } from '@/types'

export interface SquadListAthlete {
  id: string
  name: string
  shirt_number: number | null
  photo_url: string | null
  date_of_birth: string | null
  club: string | null
  availability_status: AthleteAvailabilityStatus
}

export interface SquadListStatusConfig {
  label: string
  color: string
  bg: string
  dot: string
}

interface Props {
  athletes: SquadListAthlete[]
  squadId: string | null
  statusConfig: Record<AthleteAvailabilityStatus, SquadListStatusConfig>
  positionCode: string
  // Row actions (owner/doctor only) — omitted for everyone else.
  onEdit?: (id: string) => void
  onRemove?: (id: string) => void
}

const actionButtonStyle = {
  width: 26, height: 26, borderRadius: 8, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--sophi-border)', background: 'var(--sophi-bg3)', color: 'var(--sophi-text2)',
} as const

function ageFrom(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(`${dob}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  if (beforeBirthday) age -= 1
  return age
}

export function SquadListView({ athletes, squadId, statusConfig, positionCode, onEdit, onRemove }: Props) {
  const hasActions = !!(onEdit || onRemove)
  return (
    <div style={{ border: '1px solid var(--sophi-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--sophi-bg2)' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Jogador</th>
            <th style={{ width: 64 }}>Nº</th>
            <th style={{ width: 72 }}>Pos.</th>
            <th style={{ width: 64 }}>Idade</th>
            <th>Clube</th>
            <th style={{ width: 170 }}>Estado</th>
            {hasActions && <th style={{ width: 90 }} />}
          </tr>
        </thead>
        <tbody>
          {athletes.map((a) => {
            const cfg = statusConfig[a.availability_status]
            const age = ageFrom(a.date_of_birth)
            const href = withSquadParam(`/athletes/${a.id}`, squadId)
            return (
              <tr key={a.id}>
                <td>
                  <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--sophi-text)', fontWeight: 600 }}>
                    <AthleteAvatar photoUrl={a.photo_url} shirtNumber={a.shirt_number} name={a.name} size={30} />
                    <span className="truncate">{a.name}</span>
                  </Link>
                </td>
                <td style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text2)' }}>{a.shirt_number ?? '—'}</td>
                <td style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text2)' }}>{positionCode}</td>
                <td style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text2)' }}>{age ?? '—'}</td>
                <td style={{ color: 'var(--sophi-text2)' }}>{a.club ?? '—'}</td>
                <td>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px', borderRadius: 999,
                    fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
                    {cfg.label}
                  </span>
                </td>
                {hasActions && (
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {onEdit && (
                        <button
                          type="button" title={`Edit ${a.name}`} aria-label={`Edit ${a.name}`}
                          onClick={() => onEdit(a.id)}
                          style={actionButtonStyle}
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {onRemove && (
                        <button
                          type="button" title={`Remove ${a.name}`} aria-label={`Remove ${a.name}`}
                          onClick={() => onRemove(a.id)}
                          style={actionButtonStyle}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
