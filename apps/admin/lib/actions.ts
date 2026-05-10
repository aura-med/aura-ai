'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuthClient } from '@/lib/supabase/server'
import { getActiveSupportSession } from '@/lib/admin-data'
import { recordAudit, requirePlatformAdmin } from '@/lib/admin-auth'

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim()
  if (!value) throw new Error(`${key} is required`)
  return value
}

export async function signOut() {
  const auth = await createAuthClient()
  await auth.auth.signOut()
  redirect('/login')
}

export async function startSupportSession(formData: FormData) {
  try {
    const context = await requirePlatformAdmin()
    const orgId    = requiredString(formData, 'org_id')
    const ticketId = requiredString(formData, 'ticket_id')
    const reason   = requiredString(formData, 'reason')
    if (ticketId.length < 3)  throw new Error('Ticket ID must be at least 3 characters')
    if (reason.length < 10)   throw new Error('Reason must be at least 10 characters')

    const service = createAdminClient()
    await service.rpc('expire_support_sessions')

    const { data, error } = await service
      .from('support_sessions')
      .insert({ actor_user_id: context.user.id, org_id: orgId, ticket_id: ticketId, reason })
      .select('id')
      .single()
    if (error) throw new Error(error.message)

    await recordAudit({
      actor_user_id: context.user.id,
      event_type: 'support.session_started',
      target_type: 'organization', target_id: orgId, org_id: orgId,
      support_session_id: data.id,
      metadata: { ticket_id: ticketId },
    })
    revalidatePath('/')
    revalidatePath('/organizations')
  } catch (e) {
    redirect(`/?error=${encodeURIComponent((e as Error).message)}`)
  }
  redirect('/?success=Support+session+started')
}

export async function endSupportSession() {
  try {
    const context = await requirePlatformAdmin()
    const active = await getActiveSupportSession(context.user.id)
    if (!active) return

    const service = createAdminClient()
    const { error } = await service
      .from('support_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString(), ended_by: context.user.id })
      .eq('id', active.id)
    if (error) throw new Error(error.message)

    await recordAudit({
      actor_user_id: context.user.id,
      event_type: 'support.session_ended',
      target_type: 'organization', target_id: active.org_id, org_id: active.org_id,
      support_session_id: active.id,
    })
    revalidatePath('/')
    revalidatePath('/organizations')
  } catch (e) {
    redirect(`/?error=${encodeURIComponent((e as Error).message)}`)
  }
}

export async function updateOrganizationStatus(formData: FormData) {
  const redirectPath = '/organizations'
  try {
    const context = await requirePlatformAdmin()
    const orgId  = requiredString(formData, 'org_id')
    const status = requiredString(formData, 'status')
    if (!['active', 'suspended', 'archived'].includes(status)) throw new Error('Invalid status')

    const service = createAdminClient()
    const { error } = await service.from('organizations').update({ status }).eq('id', orgId)
    if (error) throw new Error(error.message)

    await recordAudit({
      actor_user_id: context.user.id,
      event_type: `organization.${status}`,
      target_type: 'organization', target_id: orgId, org_id: orgId,
    })
    revalidatePath('/')
    revalidatePath('/organizations')
  } catch (e) {
    redirect(`${redirectPath}?error=${encodeURIComponent((e as Error).message)}`)
  }
  redirect(`${redirectPath}?success=Organization+status+updated`)
}

export async function inviteUser(formData: FormData) {
  const redirectPath = '/users'
  try {
    const context  = await requirePlatformAdmin()
    const email    = requiredString(formData, 'email')
    const orgId    = requiredString(formData, 'org_id')
    const role     = requiredString(formData, 'role')
    const fullName = String(formData.get('full_name') ?? '').trim() || null

    const validRoles = ['admin', 'doctor', 'physio', 'coach', 'fitness_coach', 'athlete']
    if (!validRoles.includes(role)) throw new Error('Invalid role')

    const service = createAdminClient()
    const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
      data: fullName ? { full_name: fullName } : undefined,
    })
    if (error) throw new Error(error.message)

    if (data.user) {
      const { error: pe } = await service
        .from('profiles')
        .upsert({ id: data.user.id, full_name: fullName, org_id: orgId, role })
      if (pe) throw new Error(pe.message)
    }

    await recordAudit({
      actor_user_id: context.user.id,
      event_type: 'user.invited',
      target_type: 'user', target_id: data.user?.id, org_id: orgId,
      metadata: { email, role },
    })
  } catch (e) {
    redirect(`${redirectPath}?error=${encodeURIComponent((e as Error).message)}`)
  }
  redirect(`${redirectPath}?success=Invitation+sent`)
}

export async function disableUser(formData: FormData) {
  const redirectPath = '/users'
  try {
    const context = await requirePlatformAdmin()
    const userId  = requiredString(formData, 'user_id')
    const orgId   = String(formData.get('org_id') ?? '').trim() || undefined

    const service = createAdminClient()
    const { error } = await service.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
    if (error) throw new Error(error.message)

    await recordAudit({
      actor_user_id: context.user.id,
      event_type: 'user.disabled',
      target_type: 'user', target_id: userId, org_id: orgId,
    })
  } catch (e) {
    redirect(`${redirectPath}?error=${encodeURIComponent((e as Error).message)}`)
  }
  redirect(`${redirectPath}?success=User+disabled`)
}

// ── New actions ───────────────────────────────────────────────────────────────

export async function enableUser(formData: FormData) {
  const redirectPath = '/users'
  try {
    const context = await requirePlatformAdmin()
    const userId  = requiredString(formData, 'user_id')
    const orgId   = String(formData.get('org_id') ?? '').trim() || undefined

    const service = createAdminClient()
    const { error } = await service.auth.admin.updateUserById(userId, { ban_duration: 'none' })
    if (error) throw new Error(error.message)

    await recordAudit({
      actor_user_id: context.user.id,
      event_type: 'user.enabled',
      target_type: 'user', target_id: userId, org_id: orgId,
    })
  } catch (e) {
    redirect(`${redirectPath}?error=${encodeURIComponent((e as Error).message)}`)
  }
  redirect(`${redirectPath}?success=User+re-enabled`)
}

export async function updateUserRole(formData: FormData) {
  const redirectPath = '/users'
  try {
    const context = await requirePlatformAdmin()
    const userId  = requiredString(formData, 'user_id')
    const role    = requiredString(formData, 'role')
    const orgId   = String(formData.get('org_id') ?? '').trim() || undefined

    const validRoles = ['admin', 'doctor', 'physio', 'coach', 'fitness_coach', 'athlete']
    if (!validRoles.includes(role)) throw new Error('Invalid role')

    const service = createAdminClient()
    const { error } = await service.from('profiles').update({ role }).eq('id', userId)
    if (error) throw new Error(error.message)

    await recordAudit({
      actor_user_id: context.user.id,
      event_type: 'user.role_changed',
      target_type: 'user', target_id: userId, org_id: orgId,
      metadata: { role },
    })
  } catch (e) {
    redirect(`${redirectPath}?error=${encodeURIComponent((e as Error).message)}`)
  }
  redirect(`${redirectPath}?success=Role+updated`)
}

export async function createOrganization(formData: FormData) {
  const redirectPath = '/organizations'
  try {
    const context = await requirePlatformAdmin()
    const name    = requiredString(formData, 'name')
    const type    = requiredString(formData, 'type')
    const plan    = requiredString(formData, 'plan')

    if (!['federation', 'club'].includes(type)) throw new Error('Invalid org type')
    if (!['trial', 'standard', 'enterprise'].includes(plan)) throw new Error('Invalid plan')

    const modules = {
      readiness:    formData.get('readiness')    === 'on',
      rehab:        formData.get('rehab')        === 'on',
      performance:  formData.get('performance')  === 'on',
      female_squad: formData.get('female_squad') === 'on',
      passport:     formData.get('passport')     === 'on',
    }

    const service = createAdminClient()
    const { data, error } = await service
      .from('organizations')
      .insert({ name, type, plan, modules, status: 'active' })
      .select('id')
      .single()
    if (error) throw new Error(error.message)

    await recordAudit({
      actor_user_id: context.user.id,
      event_type: 'organization.created',
      target_type: 'organization', target_id: data.id,
      metadata: { name, type, plan },
    })
  } catch (e) {
    redirect(`${redirectPath}?error=${encodeURIComponent((e as Error).message)}`)
  }
  redirect(`${redirectPath}?success=Organization+created`)
}

export async function inviteAdmin(formData: FormData) {
  const redirectPath = '/security'
  try {
    const context = await requirePlatformAdmin()
    if (context.admin.level !== 'owner') throw new Error('Only owners can manage the admin registry')

    const userId = requiredString(formData, 'user_id')
    const level  = requiredString(formData, 'level')
    if (!['owner', 'admin', 'support', 'analyst'].includes(level)) throw new Error('Invalid level')

    const service = createAdminClient()
    const { error } = await service
      .from('platform_admins')
      .upsert({ user_id: userId, level, active: true, created_by: context.user.id })
    if (error) throw new Error(error.message)

    await recordAudit({
      actor_user_id: context.user.id,
      event_type: 'admin.invited',
      target_type: 'user', target_id: userId,
      metadata: { level },
    })
  } catch (e) {
    redirect(`${redirectPath}?error=${encodeURIComponent((e as Error).message)}`)
  }
  redirect(`${redirectPath}?success=Admin+added+to+registry`)
}

export async function revokeAdmin(formData: FormData) {
  const redirectPath = '/security'
  try {
    const context = await requirePlatformAdmin()
    if (context.admin.level !== 'owner') throw new Error('Only owners can revoke admin access')

    const userId = requiredString(formData, 'user_id')
    if (userId === context.user.id) throw new Error('You cannot revoke your own admin access')

    const service = createAdminClient()
    const { error } = await service
      .from('platform_admins')
      .update({ active: false })
      .eq('user_id', userId)
    if (error) throw new Error(error.message)

    await recordAudit({
      actor_user_id: context.user.id,
      event_type: 'admin.revoked',
      target_type: 'user', target_id: userId,
    })
  } catch (e) {
    redirect(`${redirectPath}?error=${encodeURIComponent((e as Error).message)}`)
  }
  redirect(`${redirectPath}?success=Admin+access+revoked`)
}
