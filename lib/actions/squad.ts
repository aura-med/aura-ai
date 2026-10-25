'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getViewerContext } from '@/lib/data/auth'
import { CreateSquadSchema, UpdateSquadSchema } from '@/lib/schemas/squad'
import { postgresUuidSchema } from '@/lib/schemas/ids'
import { canEditSquads } from '@/lib/users/permissions'
import { logAudit } from '@/lib/audit'

// Owner or doctor. The org always comes from the viewer, never the client. A
// doctor is auto-assigned to the squad they create (otherwise they couldn't see
// it or its players); that needs the service role, so the role check is explicit.
export async function createSquad(payload: unknown) {
  const result = CreateSquadSchema.safeParse(payload)
  if (!result.success) {
    return { success: false as const, error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const viewer = await getViewerContext()
  if (!viewer.userId || !viewer.org) return { success: false as const, error: 'Sessão inválida' }
  if (!canEditSquads(viewer.role)) return { success: false as const, error: 'Sem permissão para criar squads' }

  const service = createServiceRoleClient()
  if (!service) return { success: false as const, error: 'Serviço indisponível' }

  const { data: squad, error } = await service
    .from('squads')
    .insert({ org_id: viewer.org.id, name: result.data.name.trim(), type: result.data.type })
    .select('id')
    .single()
  if (error || !squad) return { success: false as const, error: error?.message ?? 'Não foi possível criar o squad' }

  if (viewer.role === 'doctor') {
    const { error: assignError } = await service
      .from('staff_squads')
      .insert({ profile_id: viewer.userId, squad_id: squad.id })
    if (assignError) {
      // Roll back the (still empty) squad we just created so it isn't orphaned.
      await service.from('squads').delete().eq('id', squad.id)
      return { success: false as const, error: assignError.message }
    }
  }

  await logAudit({
    userId: viewer.userId,
    userEmail: viewer.user?.email ?? '',
    orgId: viewer.org.id,
    action: 'squad.create',
    resourceType: 'squad',
    resourceId: squad.id,
  })

  revalidatePath('/settings/squads')
  revalidatePath('/settings/users')
  return { success: true as const, id: squad.id as string }
}

// Owner, or a doctor on an assigned squad — enforced by squads_update RLS (093);
// the explicit role check gives a clear error first.
export async function updateSquad(id: unknown, payload: unknown) {
  const idParsed = postgresUuidSchema.safeParse(id)
  const parsed = UpdateSquadSchema.safeParse(payload)
  if (!idParsed.success) return { success: false as const, error: 'Squad inválido' }
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation failed' }
  }

  const viewer = await getViewerContext()
  if (!viewer.userId || !viewer.org) return { success: false as const, error: 'Sessão inválida' }
  if (!canEditSquads(viewer.role)) return { success: false as const, error: 'Sem permissão para editar squads' }
  if (!viewer.squads.some((s) => s.id === idParsed.data)) {
    return { success: false as const, error: 'Squad inválido' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('squads')
    .update({ name: parsed.data.name, season: parsed.data.season })
    .eq('id', idParsed.data)
    .eq('org_id', viewer.org.id)
    .select('id')
    .maybeSingle()
  if (error) return { success: false as const, error: error.message }
  if (!data) return { success: false as const, error: 'Sem permissão para editar este squad' }

  await logAudit({
    userId: viewer.userId,
    userEmail: viewer.user?.email ?? '',
    orgId: viewer.org.id,
    action: 'squad.update',
    resourceType: 'squad',
    resourceId: idParsed.data,
  })

  revalidatePath('/settings/squads')
  revalidatePath('/settings/users')
  return { success: true as const }
}
