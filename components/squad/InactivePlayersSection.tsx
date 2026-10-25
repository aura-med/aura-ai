'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AthleteAvatar } from '@/components/ui/AthleteAvatar'
import { Button } from '@/components/ui/button'
import { setAthleteActive } from '@/app/(dashboard)/athletes/actions'
import { withSquadParam } from '@/lib/squad-url'

export interface InactiveAthlete {
  id: string
  name: string
  shirt_number: number | null
  photo_url: string | null
  position: string | null
  club: string | null
}

interface Props {
  athletes: InactiveAthlete[]
  squadId: string | null
}

// Disabled players (athletes.active = false) — only rendered for owner/doctor.
export function InactivePlayersSection({ athletes, squadId }: Props) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function reactivate(id: string) {
    setBusyId(id)
    setError(null)
    const result = await setAthleteActive(id, true)
    setBusyId(null)
    if (!result.success) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div style={{ marginTop: 8, marginBottom: 28 }}>
      <div style={{
        fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em',
        color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)',
        marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--sophi-border)',
      }}>
        Inativos
      </div>
      {error && <p className="text-xs mb-2" style={{ color: 'var(--sophi-danger)' }}>{error}</p>}
      <div style={{ border: '1px solid var(--sophi-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--sophi-bg2)' }}>
        {athletes.map((a, i) => (
          <div
            key={a.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              borderTop: i === 0 ? 'none' : '1px solid var(--sophi-border)',
            }}
          >
            <Link
              href={withSquadParam(`/athletes/${a.id}`, squadId)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, opacity: 0.6, color: 'var(--sophi-text)' }}
            >
              <AthleteAvatar photoUrl={a.photo_url} shirtNumber={a.shirt_number} name={a.name} size={30} />
              <span className="truncate" style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-dm-mono)', color: 'var(--sophi-text3)' }}>
                {[a.shirt_number != null ? `#${a.shirt_number}` : null, a.position, a.club].filter(Boolean).join(' · ')}
              </span>
            </Link>
            <Button type="button" variant="outline" size="sm" disabled={busyId === a.id} onClick={() => void reactivate(a.id)}>
              {busyId === a.id ? 'A reativar…' : 'Reativar'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
