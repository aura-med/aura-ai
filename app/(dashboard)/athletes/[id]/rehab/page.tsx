import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function RehabPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: athlete }, { data: session }] = await Promise.all([
    supabase.from('athletes').select('name, shirt_number').eq('id', id).single(),
    supabase
      .from('rehab_sessions')
      .select('*, rehab_protocols(*)')
      .eq('athlete_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!athlete) notFound()

  const protocol = session?.rehab_protocols as Record<string, unknown> | null
  const phases: Array<{
    id: number; name: string; range: string; d1: number; d2: number; color: string;
    exercises: string[]; criteria: string
  }> = (protocol?.phases as typeof phases) ?? []

  const currentDay = session?.current_day ?? 1
  const totalDays  = (protocol?.total_days as number) ?? 42

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-syne)', color: 'var(--aura-text)' }}
        >
          Reabilitação · {athlete.name}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--aura-text2)' }}>
          #{athlete.shirt_number}
        </p>
      </div>

      {!session ? (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--aura-text3)' }}>
            Sem protocolo de reabilitação activo.
          </p>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div
            className="rounded-xl border p-5"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--aura-text)' }}>
                {protocol?.name as string} · Dia {currentDay}/{totalDays}
              </h2>
              <span
                className="text-xs font-mono"
                style={{ color: 'var(--aura-text3)' }}
              >
                {Math.round((currentDay / totalDays) * 100)}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'var(--aura-bg4)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round((currentDay / totalDays) * 100)}%`,
                  background: 'var(--aura-green)',
                }}
              />
            </div>
          </div>

          {/* Phase timeline */}
          <div
            className="rounded-xl border p-5"
            style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--aura-text)' }}>
              Fases do Protocolo
            </h2>
            <div className="space-y-4">
              {phases.map((phase) => {
                const isActive = currentDay >= phase.d1 && currentDay <= phase.d2
                const isDone   = currentDay > phase.d2
                return (
                  <div
                    key={phase.id}
                    className="rounded-lg border p-4"
                    style={{
                      borderColor: isActive ? phase.color + '60' : 'var(--aura-border)',
                      background: isActive ? phase.color + '08' : 'var(--aura-bg3)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: isDone ? 'var(--aura-green)' : isActive ? phase.color : 'var(--aura-text3)' }}
                        />
                        <span className="text-sm font-medium" style={{ color: 'var(--aura-text)' }}>
                          Fase {phase.id}: {phase.name}
                        </span>
                      </div>
                      <span className="text-xs font-mono" style={{ color: 'var(--aura-text3)' }}>
                        {phase.range}
                      </span>
                    </div>
                    {isActive && (
                      <ul className="mt-2 space-y-1">
                        {phase.exercises.map((ex, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--aura-text2)' }}>
                            <span style={{ color: phase.color }}>·</span> {ex}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* RTP criteria */}
          {session.rtp_criteria && (session.rtp_criteria as Array<{ label: string; done: boolean }>).length > 0 && (
            <div
              className="rounded-xl border p-5"
              style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
            >
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--aura-text)' }}>
                Critérios RTP
              </h2>
              <ul className="space-y-2.5">
                {(session.rtp_criteria as Array<{ label: string; done: boolean }>).map((c, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                      style={{
                        borderColor: c.done ? 'var(--aura-green)' : 'var(--aura-border2)',
                        background: c.done ? 'var(--aura-green-bg)' : 'transparent',
                      }}
                    >
                      {c.done && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1 4l2 2 4-4" stroke="var(--aura-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span
                      className="text-sm"
                      style={{ color: c.done ? 'var(--aura-text)' : 'var(--aura-text2)' }}
                    >
                      {c.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
