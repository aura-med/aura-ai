import { connection } from 'next/server'
import { getInputPageDTO } from '@/lib/data/input'
import { getSquadIdParam } from '@/lib/squad-url'
import { InputClient } from './InputClient'

export default async function InputPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const dto = await getInputPageDTO(squadId)
  return <InputClient dto={dto} />
}
