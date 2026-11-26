import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSquadIdParam } from '@/lib/squad-url'
import { FeedClient } from './FeedClient'

async function getAthletes(squadId: string | null) {
  const supabase = await createClient()
  let query = supabase
    .from('athletes')
    .select('id, name, shirt_number, photo_url, squad_id')
    .eq('active', true)
    .order('name')
  if (squadId) query = query.eq('squad_id', squadId)
  const { data } = await query
  return data ?? []
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const params = searchParams ? await searchParams : {}
  const squadId = getSquadIdParam(params)
  const athletes = await getAthletes(squadId)

  // Keyed by squadId: switching squads (the global switcher, same mechanism
  // every other page uses) should reset the feed's own athlete/category
  // filters rather than carry over a filter that no longer applies.
  return <FeedClient key={squadId ?? 'all'} athletes={athletes} squadId={squadId} />
}
