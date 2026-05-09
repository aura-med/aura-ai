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
  const sessions = await getRehabSessions(squadId)
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /><span>A carregar protocolos...</span></div>}>
      <RehabContent initialSessions={sessions} squadId={squadId} />
    </Suspense>
  )
}
