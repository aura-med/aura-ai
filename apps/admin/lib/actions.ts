'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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
  const context = await requirePlatformAdmin()
  const orgId = requiredString(formData, 'org_id')
  const ticketId = requiredString(formData, 'ticket_id')
  const reason = requiredString(formData, 'reason')

  if (ticketId.length < 3) throw new Error('Ticket ID must be at least 3 characters')
  if (reason.length < 10) throw new Error('Reason must be at least 10 characters')

  const service = createAdminClient()
  await service.rpc('expire_support_sessions')

  const { data, error } = await service
    .from('support_sessions')
    .insert({
      actor_user_id: context.user.id,
      org_id: orgId,
      ticket_id: ticketId,
      reason,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  await recordAudit({
    actor_user_id: context.user.id,
    event_type: 'support.session_started',
    target_type: 'organization',
    target_id: orgId,
    org_id: orgId,
    support_session_id: data.id,
    metadata: { ticket_id: ticketId },
  })

  revalidatePath('/')
  revalidatePath('/organizations')
}

export async function endSupportSession() {
  const context = await requirePlatformAdmin()
  const active = await getActiveSupportSession(context.user.id)
  if (!active) return

  const service = createAdminClient()
  const { error } = await service
    .from('support_sessions')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      ended_by: context.user.id,
    })
    .eq('id', active.id)

  if (error) throw new Error(error.message)

  await recordAudit({
    actor_user_id: context.user.id,
    event_type: 'support.session_ended',
    target_type: 'organization',
    target_id: active.org_id,
    org_id: active.org_id,
    support_session_id: active.id,
  })

  revalidatePath('/')
  revalidatePath('/organizations')
}

export async function updateOrganizationStatus(formData: FormData) {
  const context = await requirePlatformAdmin()
  const orgId = requiredString(formData, 'org_id')
  const status = requiredString(formData, 'status')

  if (!['active', 'suspended', 'archived'].includes(status)) {
    throw new Error('Invalid organization status')
  }

  const service = createAdminClient()
  const { error } = await service
    .from('organizations')
    .update({ status })
    .eq('id', orgId)

  if (error) throw new Error(error.message)

  await recordAudit({
    actor_user_id: context.user.id,
    event_type: `organization.${status}`,
    target_type: 'organization',
    target_id: orgId,
    org_id: orgId,
  })

  revalidatePath('/')
  revalidatePath('/organizations')
}

export async function inviteUser(formData: FormData) {
  const context = await requirePlatformAdmin()
  const email = requiredString(formData, 'email')
  const orgId = requiredString(formData, 'org_id')
  const role = requiredString(formData, 'role')
  const fullName = String(formData.get('full_name') ?? '').trim() || null

  if (!['admin', 'doctor', 'physio', 'coach', 'fitness_coach', 'athlete'].includes(role)) {
    throw new Error('Invalid role')
  }

  const service = createAdminClient()
  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
  })

  if (error) throw new Error(error.message)

  if (data.user) {
    const { error: profileError } = await service
      .from('profiles')
      .upsert({
        id: data.user.id,
        full_name: fullName,
        org_id: orgId,
        role,
      })

    if (profileError) throw new Error(profileError.message)
  }

  await recordAudit({
    actor_user_id: context.user.id,
    event_type: 'user.invited',
    target_type: 'user',
    target_id: data.user?.id,
    org_id: orgId,
    metadata: { email, role },
  })

  revalidatePath('/users')
}

export async function disableUser(formData: FormData) {
  const context = await requirePlatformAdmin()
  const userId = requiredString(formData, 'user_id')
  const orgId = String(formData.get('org_id') ?? '').trim() || undefined
  const service = createAdminClient()
  const { error } = await service.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
  })

  if (error) throw new Error(error.message)

  await recordAudit({
    actor_user_id: context.user.id,
    event_type: 'user.disabled',
    target_type: 'user',
    target_id: userId,
    org_id: orgId,
  })

  revalidatePath('/users')
}
