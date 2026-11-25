'use server'

// Clinical activity feed (Phase D) — read through a dedicated, role-gated
// server action with a closed allowlist of audit action types, NOT by
// widening audit_logs' RLS (owner-only SELECT, scoped to their own org).
// This keeps the GDPR audit table's access exactly as narrow as it is
// today while still letting clinical staff (not just owners) see the feed
// of clinical actions it's meant to surface for oversight.
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getViewerContext } from '@/lib/data/auth'
import { OWNER_ROLE, CLINICAL_ROLES } from '@/lib/roles'
import type { AuditAction } from '@/lib/audit'

const FEED_ACTIONS: AuditAction[] = [
  'occurrence.create',
  'occurrence.update',
  'occurrence.resolve',
  'occurrence_record.create',
  'diagnosis.create',
  'diagnosis.update',
  'diagnosis.resolve',
  'weight.create',
  'wellness.checkin',
  'rehab_plan.create',
  'rehab_plan.close',
  'rehab_criterion.complete',
]

export interface ActivityFeedItemDTO {
  id: string
  userEmail: string
  action: AuditAction
  resourceType: string
  resourceId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface ActivityFeedPageDTO {
  items: ActivityFeedItemDTO[]
  hasMore: boolean
}

const PAGE_SIZE = 20

export async function getClinicalActivityFeed(page = 0): Promise<ActivityFeedPageDTO> {
  const viewer = await getViewerContext()
  if (!viewer.org?.id || !viewer.role || !(viewer.role === OWNER_ROLE || CLINICAL_ROLES.includes(viewer.role as (typeof CLINICAL_ROLES)[number]))) {
    throw new Error('Forbidden')
  }

  const service = createServiceRoleClient()
  if (!service) throw new Error('Service role not configured')

  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE // one extra row to detect hasMore without a second count query

  const { data, error } = await service
    .from('audit_logs')
    .select('id, user_email, action, resource_type, resource_id, metadata, created_at')
    .eq('org_id', viewer.org.id)
    .in('action', FEED_ACTIONS)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  const rows = data ?? []
  const hasMore = rows.length > PAGE_SIZE
  const items: ActivityFeedItemDTO[] = rows.slice(0, PAGE_SIZE).map((row) => ({
    id: row.id,
    userEmail: row.user_email,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  }))

  return { items, hasMore }
}
