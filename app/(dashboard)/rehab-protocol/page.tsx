import { connection } from 'next/server'
import { getRehabPageDTO } from '@/lib/data/rehab'
import { getSquadIdParam } from '@/lib/squad-url'
import { RehabClient } from './RehabClient'

export default async function RehabPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const dto = await getRehabPageDTO(squadId)
  return <RehabClient dto={dto} />
}
