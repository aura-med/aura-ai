import { connection } from 'next/server'
import { getCalendarPageDTO } from '@/lib/data/calendar'
import { getSquadIdParam } from '@/lib/squad-url'
import { CalendarClient } from './CalendarClient'

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const squadId = getSquadIdParam(searchParams ? await searchParams : null)
  const dto = await getCalendarPageDTO(squadId)
  return <CalendarClient dto={dto} />
}
