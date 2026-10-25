import 'server-only'

import type { createClient } from '@/lib/supabase/server'

// Federations pick a player's club from the distinct club names already on the
// org's active athletes (club orgs are locked to their own name, see
// createAthlete/updateAthlete).
export async function listOrgClubs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('athletes')
    .select('club')
    .eq('org_id', orgId)
    .eq('active', true)
    .not('club', 'is', null)
  const byKey = new Map<string, string>()
  for (const row of (data ?? []) as { club: string | null }[]) {
    const name = row.club?.trim()
    if (name && !byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), name)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}
