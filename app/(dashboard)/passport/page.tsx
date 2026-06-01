import { connection } from 'next/server'
import { getPassportPageDTO } from '@/lib/data/passport'
import { getSquadIdParam } from '@/lib/squad-url'
import { PassportClient } from './PassportClient'

export default async function PassportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const params = searchParams ? await searchParams : null
  const squadId = getSquadIdParam(params)
  const athleteParam = params?.athleteId
  const athleteId = typeof athleteParam === 'string' ? athleteParam : null
  const dto = await getPassportPageDTO(squadId, athleteId)

  return <PassportClient dto={dto} />
}
