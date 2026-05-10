import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { asRecord, asRecordArray, asString } from '@/lib/data/records'
import type { ViewerContextDTO } from '@/lib/data/types'

export const getViewerContext = cache(async (): Promise<ViewerContextDTO> => {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user

  if (!user) {
    return { userId: null, org: null, role: null, squads: [] }
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('org_id, role, full_name')
    .eq('id', user.id)
    .single()

  const profile = asRecord(profileData)
  const orgId = asString(profile.org_id)
  const role = asString(profile.role)

  if (!orgId) {
    return { userId: user.id, org: null, role, squads: [] }
  }

  const [{ data: orgData }, { data: squadsData }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, type')
      .eq('id', orgId)
      .single(),
    supabase
      .from('squads')
      .select('id, name, type, season, org_id')
      .eq('org_id', orgId)
      .order('name'),
  ])

  const org = asRecord(orgData)
  return {
    userId: user.id,
    org: {
      id: asString(org.id) ?? orgId,
      name: asString(org.name) ?? 'Organizacao',
      type: asString(org.type) ?? 'club',
    },
    role,
    squads: asRecordArray(squadsData).map((squad) => ({
      id: asString(squad.id) ?? '',
      name: asString(squad.name) ?? 'Squad',
      type: asString(squad.type) ?? 'male',
      season: asString(squad.season),
      orgId: asString(squad.org_id) ?? orgId,
    })).filter((squad) => squad.id),
  }
})

export function canUseSquad(viewer: ViewerContextDTO, squadId: string | null): boolean {
  return !squadId || viewer.squads.some((squad) => squad.id === squadId)
}
