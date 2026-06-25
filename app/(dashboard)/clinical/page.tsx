import { createClient } from '@/lib/supabase/server'
import { getSquadIdParam, withSquadParam } from '@/lib/squad-url'
import { AthleteAvatar } from '@/components/ui/AthleteAvatar'
import Link from 'next/link'
import type { AthleteAvailabilityStatus } from '@/types'

const STATUS_CONFIG: Record<AthleteAvailabilityStatus, { label: string; color: string; dot: string; bg: string }> = {
  available:   { label: 'Disponível',   color: 'var(--aura-green)',  dot: '#00e5a0', bg: 'rgba(0,229,160,0.08)' },
  evaluation:  { label: 'Em Avaliação', color: 'var(--aura-warn)',   dot: '#f6ad55', bg: 'rgba(246,173,85,0.08)' },
  unavailable: { label: 'Indisponível', color: 'var(--aura-danger)', dot: '#ff4d6d', bg: 'rgba(255,77,109,0.08)' },
  rtp:         { label: 'Em RTP',       color: 'var(--aura-purple)', dot: '#b48dfc', bg: 'rgba(180,141,252,0.08)' },
}

const STATUS_ORDER: AthleteAvailabilityStatus[] = ['unavailable', 'evaluation', 'rtp', 'available']

async function getData(squadId: string | null) {
  const supabase = await createClient()
  let query = supabase
    .from('athletes')
    .select('id, name, shirt_number, photo_url, position, status, availability_status, squad_id')
    .eq('active', true)
    .order('shirt_number')
  if (squadId) query = query.eq('squad_id', squadId)
  const { data } = await query
  return data ?? []
}

export default async function ClinicalFilePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const squadId = getSquadIdParam(params)
  const athletes = await getData(squadId)

  const byStatus = STATUS_ORDER.reduce<Record<AthleteAvailabilityStatus, typeof athletes>>(
    (acc, s) => ({ ...acc, [s]: athletes.filter((a) => (a.availability_status ?? 'available') === s) }),
    { available: [], evaluation: [], unavailable: [], rtp: [] }
  )

  const nonAvailable = athletes.filter((a) => (a.availability_status ?? 'available') !== 'available')

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-title">Ficheiro Clínico</div>
        <div className="sec-sub">{athletes.length} atletas · {nonAvailable.length} com ocorrência ativa</div>
      </div>

      {/* Alerts banner */}
      {nonAvailable.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            background: 'rgba(255,77,109,0.06)', border: '1px solid rgba(255,77,109,0.2)',
            borderRadius: 10, padding: '10px 16px', marginBottom: 10,
          }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-dm-mono)', color: 'var(--aura-danger)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Atenção clínica necessária
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {nonAvailable.map((a) => {
                const status = (a.availability_status ?? 'available') as AthleteAvailabilityStatus
                const cfg = STATUS_CONFIG[status]
                return (
                  <Link key={a.id} href={withSquadParam(`/athletes/${a.id}?tab=medical`, squadId)} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: cfg.bg, border: `1px solid ${cfg.dot}33`,
                      borderRadius: 20, padding: '4px 10px 4px 4px',
                    }}>
                      <div style={{ borderRadius: '50%', padding: 1, background: cfg.dot }}>
                        <div style={{ borderRadius: '50%', overflow: 'hidden', width: 22, height: 22 }}>
                          <AthleteAvatar photoUrl={a.photo_url} shirtNumber={a.shirt_number} name={a.name} size={22} />
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--aura-text)', fontWeight: 500 }}>{a.name}</span>
                      <span style={{ fontSize: 10, color: cfg.color, fontFamily: 'var(--font-dm-mono)' }}>{cfg.label}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Athletes by status group */}
      {STATUS_ORDER.map((status) => {
        const group = byStatus[status]
        if (!group.length) return null
        const cfg = STATUS_CONFIG[status]
        return (
          <div key={status} style={{ marginBottom: 28 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--aura-border)',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot }} />
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: cfg.color, fontFamily: 'var(--font-dm-mono)' }}>
                {cfg.label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
                ({group.length})
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
              {group.map((a) => (
                <Link key={a.id} href={withSquadParam(`/athletes/${a.id}?tab=medical`, squadId)} className="clinical-athlete-card" style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10,
                    background: 'var(--aura-bg2)', border: `1px solid var(--aura-border)`,
                  }}>
                    <div style={{ borderRadius: '50%', padding: 2, background: cfg.dot, flexShrink: 0 }}>
                      <div style={{ borderRadius: '50%', overflow: 'hidden', width: 36, height: 36 }}>
                        <AthleteAvatar photoUrl={a.photo_url} shirtNumber={a.shirt_number} name={a.name} size={36} />
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--aura-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.shirt_number != null ? `${a.shirt_number}. ` : ''}{a.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
                        {a.position ?? '—'}
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono)', color: cfg.color }}>
                        Ver ficheiro →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}

      {athletes.length === 0 && (
        <div className="empty-state">
          <h3>Sem atletas nesta squad</h3>
        </div>
      )}
    </div>
  )
}
