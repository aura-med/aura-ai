import { getPassportList } from '@/lib/dal/passport'
import { getSquadIdParam } from '@/lib/squad-url'
import { Suspense } from 'react'
import { PassportContent } from './PassportContent'

export default async function PassportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const athletes = await getPassportList(squadId)
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /><span>A carregar passaportes...</span></div>}>
      <PassportContent initialAthletes={athletes} />
    </Suspense>
  )
}
