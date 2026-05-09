import { createHash } from 'crypto'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAuthClient } from '@/lib/supabase/server'

export type PlatformAdminLevel = 'owner' | 'admin' | 'support' | 'analyst'

export interface PlatformAdminContext {
  user: {
    id: string
    email?: string
  }
  admin: {
    level: PlatformAdminLevel
  }
}

export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const auth = await createAuthClient()
  const {
    data: { user },
  } = await auth.auth.getUser()

  if (!user) redirect('/login')

  const service = createAdminClient()
  const { data: admin, error } = await service
    .from('platform_admins')
    .select('level, active')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle()

  if (error || !admin) redirect('/forbidden')

  await service
    .from('platform_admins')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    admin: {
      level: admin.level as PlatformAdminLevel,
    },
  }
}

export async function requestHashes() {
  const headerStore = await headers()
  const ip = headerStore.get('x-forwarded-for') ?? headerStore.get('x-real-ip') ?? 'unknown'
  const ua = headerStore.get('user-agent') ?? 'unknown'

  return {
    ip_hash: createHash('sha256').update(ip).digest('hex'),
    user_agent_hash: createHash('sha256').update(ua).digest('hex'),
  }
}

export async function recordAudit(event: {
  actor_user_id: string
  event_type: string
  target_type?: string
  target_id?: string
  org_id?: string
  support_session_id?: string
  metadata?: Record<string, unknown>
}) {
  const service = createAdminClient()
  const hashes = await requestHashes()

  await service
    .from('platform_audit_logs')
    .insert({
      actor_user_id: event.actor_user_id,
      event_type: event.event_type,
      target_type: event.target_type ?? null,
      target_id: event.target_id ?? null,
      org_id: event.org_id ?? null,
      support_session_id: event.support_session_id ?? null,
      metadata: event.metadata ?? {},
      ...hashes,
    })
}
