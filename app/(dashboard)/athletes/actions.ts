'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/data/auth'
import { CreateAthleteSchema, UpdateAthleteSchema } from '@/lib/schemas/athlete'
import { postgresUuidSchema } from '@/lib/schemas/ids'
import { canUseNationality } from '@/lib/nationalities'
import { OWNER_ROLE, REHAB_ROLES, canManageAthletes } from '@/lib/roles'
import { logAudit } from '@/lib/audit'
import type { UserRole } from '@/types'

// Mirrors the athletes_insert RLS policy (018): owner, or doctor/physio on a
// squad they're assigned to. RLS stays the real gate; this gives a clear error
// and resolves org_id/squad type server-side instead of trusting the client.
export async function createAthlete(payload: unknown) {
  const parsed = CreateAthleteSchema.safeParse(payload)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const viewer = await getViewerContext()
  if (!viewer.userId || !viewer.org) {
    return { success: false as const, error: 'Sessão inválida' }
  }
  if (viewer.role !== OWNER_ROLE && !REHAB_ROLES.includes(viewer.role as UserRole)) {
    return { success: false as const, error: 'Sem permissão para adicionar jogadores' }
  }

  const input = parsed.data
  const squad = viewer.squads.find((s) => s.id === input.squad_id)
  if (!squad) {
    return { success: false as const, error: 'Plantel inválido' }
  }
  const isFemale = squad.type === 'female'

  const supabase = await createClient()

  // Club orgs: the player's club is always the org itself, whatever the client
  // sent. Federations: free text (informational only, not validated).
  const club = viewer.org.type === 'club' ? viewer.org.name : input.club

  const { data, error } = await supabase
    .from('athletes')
    .insert({
      org_id: viewer.org.id,
      squad_id: squad.id,
      name: input.name,
      shirt_number: input.shirt_number,
      position: input.position,
      date_of_birth: input.date_of_birth,
      nationality: input.nationality,
      club,
      ...(isFemale && input.menstrual_day !== null ? { menstrual_day: input.menstrual_day } : {}),
      ...(isFemale && input.cycle_length !== null ? { cycle_length: input.cycle_length } : {}),
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false as const, error: error?.message ?? 'Não foi possível criar o jogador' }
  }

  await logAudit({
    userId: viewer.userId,
    userEmail: viewer.user?.email ?? '',
    orgId: viewer.org.id,
    action: 'athlete.create',
    resourceType: 'athlete',
    resourceId: data.id,
    metadata: { squadId: squad.id },
  })

  revalidatePath('/')
  return { success: true as const, id: data.id as string }
}

const EDITABLE_FIELDS = [
  'squad_id', 'name', 'shirt_number', 'position', 'date_of_birth',
  'nationality', 'club', 'menstrual_day', 'cycle_length',
] as const

// Edit a player's details. Owner/doctor only (narrower than athletes_update RLS,
// which also lets physios update — so this check is the real gate for the UI).
export async function updateAthlete(id: unknown, payload: unknown) {
  const idParsed = postgresUuidSchema.safeParse(id)
  if (!idParsed.success) return { success: false as const, error: 'Jogador inválido' }
  const parsed = UpdateAthleteSchema.safeParse(payload)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const viewer = await getViewerContext()
  if (!viewer.userId || !viewer.org) {
    return { success: false as const, error: 'Sessão inválida' }
  }
  if (!canManageAthletes(viewer.role)) {
    return { success: false as const, error: 'Sem permissão para editar jogadores' }
  }

  const input = parsed.data
  const squad = viewer.squads.find((s) => s.id === input.squad_id)
  if (!squad) {
    return { success: false as const, error: 'Plantel inválido' }
  }

  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase
    .from('athletes')
    .select(EDITABLE_FIELDS.join(', '))
    .eq('id', idParsed.data)
    .eq('org_id', viewer.org.id)
    .maybeSingle<Record<(typeof EDITABLE_FIELDS)[number], string | number | null>>()
  if (currentError) return { success: false as const, error: currentError.message }
  if (!current) return { success: false as const, error: 'Jogador não encontrado' }

  if (!canUseNationality(input.nationality, (current.nationality as string | null) ?? null)) {
    return { success: false as const, error: 'Nacionalidade inválida' }
  }

  const next = {
    squad_id: squad.id,
    name: input.name,
    shirt_number: input.shirt_number,
    position: input.position,
    date_of_birth: input.date_of_birth,
    nationality: input.nationality,
    // Club orgs: always the org itself. Federations: free text (informational).
    club: viewer.org.type === 'club' ? viewer.org.name : input.club,
    // Cycle data only applies to female squads; on other squads leave it as is.
    ...(squad.type === 'female'
      ? { menstrual_day: input.menstrual_day, cycle_length: input.cycle_length ?? 28 }
      : {}),
  }

  const changed = Object.entries(next)
    .filter(([key, value]) => current[key as keyof typeof current] !== value)
    .map(([key]) => key)

  const { data, error } = await supabase
    .from('athletes')
    .update({ ...next, updated_at: new Date().toISOString() })
    .eq('id', idParsed.data)
    .eq('org_id', viewer.org.id)
    .select('id')
    .maybeSingle()
  if (error) return { success: false as const, error: error.message }
  if (!data) return { success: false as const, error: 'Sem permissão para editar este jogador' }

  await logAudit({
    userId: viewer.userId,
    userEmail: viewer.user?.email ?? '',
    orgId: viewer.org.id,
    action: 'athlete.update',
    resourceType: 'athlete',
    resourceId: idParsed.data,
    metadata: { changed },
  })

  revalidatePath('/')
  revalidatePath(`/athletes/${idParsed.data}`)
  return { success: true as const }
}

// Soft delete: flips athletes.active. The row and all of its history stay in the
// database — a disabled player just stops showing up. Never delete rows here.
export async function setAthleteActive(id: unknown, active: unknown) {
  const idParsed = postgresUuidSchema.safeParse(id)
  if (!idParsed.success || typeof active !== 'boolean') {
    return { success: false as const, error: 'Pedido inválido' }
  }

  const viewer = await getViewerContext()
  if (!viewer.userId || !viewer.org) {
    return { success: false as const, error: 'Sessão inválida' }
  }
  if (!canManageAthletes(viewer.role)) {
    return { success: false as const, error: 'Sem permissão para alterar jogadores' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athletes')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', idParsed.data)
    .eq('org_id', viewer.org.id)
    .select('id')
    .maybeSingle()
  if (error) return { success: false as const, error: error.message }
  if (!data) return { success: false as const, error: 'Jogador não encontrado' }

  await logAudit({
    userId: viewer.userId,
    userEmail: viewer.user?.email ?? '',
    orgId: viewer.org.id,
    action: active ? 'athlete.enable' : 'athlete.disable',
    resourceType: 'athlete',
    resourceId: idParsed.data,
  })

  revalidatePath('/')
  revalidatePath(`/athletes/${idParsed.data}`)
  return { success: true as const }
}
