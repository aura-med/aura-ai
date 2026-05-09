import { getRehabSessions } from '@/lib/dal/rehab'
import { getSquadIdParam } from '@/lib/squad-url'
import { Suspense } from 'react'
import { RehabContent } from './RehabContent'

export default async function RehabPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  let sessions
  try {
    sessions = await getRehabSessions(squadId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return (
      <div>
        <div className="sec-hdr"><div className="sec-title">🦴 Reabilitação activa</div></div>
        <div className="alert alert-r" style={{ marginTop: 16 }}>
          <div className="adot ad-r" />
          <div><strong>Erro ao carregar dados:</strong> {msg}</div>
        </div>
      </div>
    )
  }
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /><span>A carregar protocolos...</span></div>}>
      <RehabContent initialSessions={sessions} squadId={squadId} />
    </Suspense>
  )
}
