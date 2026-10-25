'use server'

import { revalidatePath } from 'next/cache'
import { getViewerContext } from '@/lib/data/auth'
import { createServiceRoleClient, createApiAuthClient } from '@/lib/supabase/service'
import { buildInviteOptions } from '@/lib/auth/invite'
import { InviteUserSchema, UpdateUserSchema } from '@/lib/schemas/user'
import { postgresUuidSchema } from '@/lib/schemas/ids'
import {
  canInviteUsers, canManageUsers, inviteRoleAllowed, inviteRolesFor, validateSquadAssignment,
} from '@/lib/users/permissions'
import { logAudit, type AuditAction } from '@/lib/audit'
import { isSquadScoped } from '@/lib/roles'
import type { UserRole } from '@/types'

export type UserStatus = 'pending' | 'active' | 'inactive'

export interface OrgUserRow {
  id: string
  fullName: string | null
  email: string | null
  role: string | null
  squadIds: string[]
  status: UserStatus
  lastSignInAt: string | null
}

export interface UserCounts {
  orgTotal: number
  bySquad: Record<string, number>
}

type Fail = { success: false; error: string }
const fail = (error: string): Fail => ({ success: false, error })

const BAN_FOREVER = '876000h' // ~100 years; 'none' lifts it (same as apps/admin)
const MISSING_MIGRATION = 'Aplique a migração 093 (user admin) na base de dados.'

type ServiceClient = NonNullable<ReturnType<typeof createServiceRoleClient>>

async function getActor() {
  const viewer = await getViewerContext()
  const service = createServiceRoleClient()
  if (!viewer.userId || !viewer.org || !viewer.role || !service) return null
  return {
    viewer,
    service,
    userId: viewer.userId,
    email: viewer.user?.email ?? '',
    orgId: viewer.org.id,
    role: viewer.role,
    squadIds: new Set(viewer.squads.map((s) => s.id)),
  }
}
type Actor = NonNullable<Awaited<ReturnType<typeof getActor>>>

function isMissingColumn(message: string | undefined) {
  return !!message && /column .*active.* does not exist|active.*schema cache/i.test(message)
}

function webAppUrl() {
  return process.env.NEXT_PUBLIC_WEB_APP_URL
}

async function audit(actor: Actor, action: AuditAction, resourceId: string, metadata?: Record<string, unknown>) {
  await logAudit({
    userId: actor.userId, userEmail: actor.email, orgId: actor.orgId,
    action, resourceType: 'user', resourceId, metadata,
  })
}

interface OrgProfile { id: string; full_name: string | null; role: string | null; active: boolean }

// `active` only exists after migration 093 — fall back so the page still works.
async function loadOrgProfiles(service: ServiceClient, orgId: string): Promise<OrgProfile[]> {
  const withActive = await service.from('profiles').select('id, full_name, role, active').eq('org_id', orgId)
  if (!withActive.error) {
    return (withActive.data ?? []).map((p) => ({ ...p, active: p.active !== false }))
  }
  if (!isMissingColumn(withActive.error.message)) throw new Error(withActive.error.message)
  const legacy = await service.from('profiles').select('id, full_name, role').eq('org_id', orgId)
  if (legacy.error) throw new Error(legacy.error.message)
  return (legacy.data ?? []).map((p) => ({ ...p, active: true }))
}

async function loadOrgSquadLinks(service: ServiceClient, orgId: string) {
  const { data: squads, error } = await service.from('squads').select('id').eq('org_id', orgId)
  if (error) throw new Error(error.message)
  const squadIds = (squads ?? []).map((s) => s.id as string)
  if (!squadIds.length) return { squadIds, links: [] as { profile_id: string; squad_id: string }[] }
  const { data: links, error: linkError } = await service
    .from('staff_squads').select('profile_id, squad_id').in('squad_id', squadIds)
  if (linkError) throw new Error(linkError.message)
  return { squadIds, links: (links ?? []) as { profile_id: string; squad_id: string }[] }
}

function computeCounts(profiles: OrgProfile[], links: { profile_id: string; squad_id: string }[]): UserCounts {
  const activeIds = new Set(profiles.filter((p) => p.active).map((p) => p.id))
  const bySquad: Record<string, number> = {}
  for (const l of links) {
    if (activeIds.has(l.profile_id)) bySquad[l.squad_id] = (bySquad[l.squad_id] ?? 0) + 1
  }
  return { orgTotal: activeIds.size, bySquad }
}

// Active users per squad + org total. Aggregates only — visible to owner/doctor.
export async function getUserCounts(): Promise<{ success: true; counts: UserCounts } | Fail> {
  const actor = await getActor()
  if (!actor) return fail('Sessão inválida')
  if (!canInviteUsers(actor.role)) return fail('Sem permissão')
  try {
    const profiles = await loadOrgProfiles(actor.service, actor.orgId)
    const { links } = await loadOrgSquadLinks(actor.service, actor.orgId)
    return { success: true, counts: computeCounts(profiles, links) }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Erro ao carregar contagens')
  }
}

export async function listOrgUsers(): Promise<
  { success: true; users: OrgUserRow[]; counts: UserCounts; canManage: boolean; inviteRoles: string[] } | Fail
> {
  const actor = await getActor()
  if (!actor) return fail('Sessão inválida')
  if (!canInviteUsers(actor.role)) return fail('Sem permissão')

  try {
    const profiles = await loadOrgProfiles(actor.service, actor.orgId)
    const { links } = await loadOrgSquadLinks(actor.service, actor.orgId)
    const counts = computeCounts(profiles, links)

    const squadsByProfile = new Map<string, string[]>()
    for (const l of links) squadsByProfile.set(l.profile_id, [...(squadsByProfile.get(l.profile_id) ?? []), l.squad_id])

    // Owner sees the whole org; a doctor only the members of their own squads.
    const visible = actor.role === 'owner'
      ? profiles
      : profiles.filter((p) =>
          p.id === actor.userId ||
          (squadsByProfile.get(p.id) ?? []).some((sid) => actor.squadIds.has(sid)))

    const users: OrgUserRow[] = []
    for (let i = 0; i < visible.length; i += 20) {
      const chunk = visible.slice(i, i + 20)
      const authUsers = await Promise.all(chunk.map((p) => actor.service.auth.admin.getUserById(p.id)))
      chunk.forEach((p, idx) => {
        const au = authUsers[idx].data?.user
        const banned = !!au?.banned_until && new Date(au.banned_until).getTime() > Date.now()
        const status: UserStatus = !p.active || banned
          ? 'inactive'
          : !au?.email_confirmed_at && !au?.last_sign_in_at ? 'pending' : 'active'
        users.push({
          id: p.id,
          fullName: p.full_name,
          email: au?.email ?? null,
          role: p.role,
          squadIds: squadsByProfile.get(p.id) ?? [],
          status,
          lastSignInAt: au?.last_sign_in_at ?? null,
        })
      })
    }
    users.sort((a, b) => (a.fullName ?? a.email ?? '').localeCompare(b.fullName ?? b.email ?? ''))

    return { success: true, users, counts, canManage: canManageUsers(actor.role), inviteRoles: inviteRolesFor(actor.role) }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Erro ao carregar utilizadores')
  }
}

export async function inviteUser(payload: unknown): Promise<{ success: true } | Fail> {
  const parsed = InviteUserSchema.safeParse(payload)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Dados inválidos')
  const actor = await getActor()
  if (!actor) return fail('Sessão inválida')
  if (!canInviteUsers(actor.role)) return fail('Sem permissão para convidar utilizadores')

  const input = parsed.data
  if (!inviteRoleAllowed(actor.role, input.role)) return fail('Não pode convidar esta função')
  const squads = validateSquadAssignment(input.role, input.squad_ids, actor.squadIds)
  if (!squads.ok) return fail(squads.error)

  const { data, error } = await actor.service.auth.admin.inviteUserByEmail(
    input.email,
    buildInviteOptions(input.full_name, webAppUrl()),
  )
  if (error || !data.user) {
    return fail(/already|registered|exists/i.test(error?.message ?? '')
      ? 'Já existe um utilizador com este email'
      : error?.message ?? 'Não foi possível enviar o convite')
  }
  const newId = data.user.id

  // From here a failure would leave an invited auth user with no profile/squads,
  // so clean up that brand-new (never-accepted) invite and report the error.
  const { error: profileError } = await actor.service.from('profiles').upsert({
    id: newId, full_name: input.full_name, org_id: actor.orgId, role: input.role,
  })
  let squadError: string | null = null
  if (!profileError && squads.squadIds.length) {
    const { error: linkError } = await actor.service
      .from('staff_squads')
      .insert(squads.squadIds.map((squad_id) => ({ profile_id: newId, squad_id })))
    squadError = linkError?.message ?? null
  }
  if (profileError || squadError) {
    await actor.service.auth.admin.deleteUser(newId)
    return fail(profileError?.message ?? squadError ?? 'Não foi possível concluir o convite')
  }

  await audit(actor, 'user.invite', newId, { role: input.role, squadIds: squads.squadIds })
  revalidatePath('/settings/users')
  revalidatePath('/settings/squads')
  return { success: true }
}

// Owner: any org user. Doctor: only users that share one of their squads.
type Target =
  | { error: string }
  | {
      profile: { id: string; full_name: string | null; role: string | null; org_id: string }
      authUser: Awaited<ReturnType<ServiceClient['auth']['admin']['getUserById']>>['data']['user'] | null
    }

async function loadTarget(actor: Actor, userId: string): Promise<Target> {
  const idParsed = postgresUuidSchema.safeParse(userId)
  if (!idParsed.success) return { error: 'Utilizador inválido' }
  const { data: profile, error } = await actor.service
    .from('profiles').select('id, full_name, role, org_id').eq('id', idParsed.data).eq('org_id', actor.orgId).maybeSingle()
  if (error) return { error: error.message }
  if (!profile) return { error: 'Utilizador não encontrado' }

  if (actor.role !== 'owner') {
    const { data: links } = await actor.service.from('staff_squads').select('squad_id').eq('profile_id', profile.id)
    const shares = (links ?? []).some((l) => actor.squadIds.has(l.squad_id as string))
    if (!shares) return { error: 'Sem permissão para este utilizador' }
  }
  const { data: authData } = await actor.service.auth.admin.getUserById(profile.id)
  return { profile, authUser: authData?.user ?? null }
}

export async function resendInvite(userId: string): Promise<{ success: true } | Fail> {
  const actor = await getActor()
  if (!actor) return fail('Sessão inválida')
  if (!canInviteUsers(actor.role)) return fail('Sem permissão')
  const target = await loadTarget(actor, userId)
  if ('error' in target) return fail(target.error)

  const au = target.authUser
  if (!au?.email) return fail('Utilizador sem email')
  if (au.email_confirmed_at || au.last_sign_in_at) return fail('Este utilizador já aceitou o convite')

  const { error } = await actor.service.auth.admin.inviteUserByEmail(
    au.email, buildInviteOptions(target.profile.full_name, webAppUrl()),
  )
  if (error) return fail(error.message)
  await audit(actor, 'user.invite_resend', target.profile.id)
  return { success: true }
}

export async function updateUser(userId: string, payload: unknown): Promise<{ success: true } | Fail> {
  const parsed = UpdateUserSchema.safeParse(payload)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Dados inválidos')
  const actor = await getActor()
  if (!actor) return fail('Sessão inválida')
  if (!canManageUsers(actor.role)) return fail('Sem permissão para editar utilizadores')
  const target = await loadTarget(actor, userId)
  if ('error' in target) return fail(target.error)

  const input = parsed.data
  const squads = validateSquadAssignment(input.role, input.squad_ids, actor.squadIds)
  if (!squads.ok) return fail(squads.error)

  // The last-owner trigger (024/093) rejects demoting the only active owner.
  const { error } = await actor.service
    .from('profiles').update({ full_name: input.full_name, role: input.role }).eq('id', target.profile.id).eq('org_id', actor.orgId)
  if (error) return fail(error.message)

  const { data: current } = await actor.service.from('staff_squads').select('squad_id').eq('profile_id', target.profile.id)
  const orgSquadIds = actor.squadIds // owner: every squad of the org
  const currentIds = ((current ?? []).map((r) => r.squad_id as string)).filter((id) => orgSquadIds.has(id))
  const wanted = new Set(isSquadScoped(input.role as UserRole) ? squads.squadIds : [])
  const toRemove = currentIds.filter((id) => !wanted.has(id))
  const toAdd = [...wanted].filter((id) => !currentIds.includes(id))
  if (toRemove.length) {
    const { error: rmError } = await actor.service
      .from('staff_squads').delete().eq('profile_id', target.profile.id).in('squad_id', toRemove)
    if (rmError) return fail(rmError.message)
  }
  if (toAdd.length) {
    const { error: addError } = await actor.service
      .from('staff_squads').insert(toAdd.map((squad_id) => ({ profile_id: target.profile.id, squad_id })))
    if (addError) return fail(addError.message)
  }

  await audit(actor, 'user.update', target.profile.id, {
    roleFrom: target.profile.role, roleTo: input.role, squadsAdded: toAdd, squadsRemoved: toRemove,
  })
  revalidatePath('/settings/users')
  revalidatePath('/settings/squads')
  return { success: true }
}

export async function sendPasswordReset(userId: string): Promise<{ success: true } | Fail> {
  const actor = await getActor()
  if (!actor) return fail('Sessão inválida')
  if (!canManageUsers(actor.role)) return fail('Sem permissão')
  const target = await loadTarget(actor, userId)
  if ('error' in target) return fail(target.error)

  const au = target.authUser
  if (!au?.email) return fail('Utilizador sem email')
  if (!au.email_confirmed_at && !au.last_sign_in_at) return fail('O convite ainda não foi aceite — reenvie o convite')

  const anon = createApiAuthClient()
  if (!anon) return fail('Serviço indisponível')
  const base = webAppUrl()?.trim().replace(/\/+$/, '')
  const { error } = await anon.auth.resetPasswordForEmail(au.email, base ? { redirectTo: `${base}/reset-password` } : undefined)
  if (error) return fail(error.message)

  await audit(actor, 'user.password_reset', target.profile.id)
  return { success: true }
}

// Soft delete: profiles.active=false + auth ban. Nothing is ever deleted, and
// staff_squads rows are kept so reactivating restores the user's access.
export async function setUserActive(userId: string, active: boolean): Promise<{ success: true } | Fail> {
  if (typeof active !== 'boolean') return fail('Pedido inválido')
  const actor = await getActor()
  if (!actor) return fail('Sessão inválida')
  if (!canManageUsers(actor.role)) return fail('Sem permissão')
  const target = await loadTarget(actor, userId)
  if ('error' in target) return fail(target.error)
  if (!active && target.profile.id === actor.userId) return fail('Não pode remover a sua própria conta')

  const patch = { active, deactivated_at: active ? null : new Date().toISOString() }
  const { error } = await actor.service.from('profiles').update(patch).eq('id', target.profile.id).eq('org_id', actor.orgId)
  if (error) return fail(isMissingColumn(error.message) ? MISSING_MIGRATION : error.message)

  const { error: banError } = await actor.service.auth.admin.updateUserById(target.profile.id, {
    ban_duration: active ? 'none' : BAN_FOREVER,
  })
  if (banError) {
    // Keep profile and auth in sync.
    await actor.service.from('profiles')
      .update({ active: !active, deactivated_at: !active ? null : new Date().toISOString() })
      .eq('id', target.profile.id)
    return fail(banError.message)
  }

  // A reactivated user who never accepted the invite needs a fresh invite.
  const au = target.authUser
  if (active && au?.email && !au.email_confirmed_at && !au.last_sign_in_at) {
    await actor.service.auth.admin.inviteUserByEmail(au.email, buildInviteOptions(target.profile.full_name, webAppUrl()))
  }

  await audit(actor, active ? 'user.reactivate' : 'user.deactivate', target.profile.id)
  revalidatePath('/settings/users')
  revalidatePath('/settings/squads')
  return { success: true }
}
