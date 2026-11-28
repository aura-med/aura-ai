'use server'

// Clinical + administrative activity timeline (Phase D, reworked per user
// feedback: the audit_logs-only version only showed the handful of events
// logged since logAudit was wired up this session — not "uma verdadeira
// timeline de todos os acontecimentos"). Reads through get_org_activity_feed
// (migration 106), which unions every source table's own authorship columns
// (full history, no backfill needed) with audit_logs for the administrative
// actions that have no such columns of their own. Still a dedicated,
// role-gated server action with a closed allowlist — not a wider RLS grant.
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getViewerContext } from '@/lib/data/auth'
import { OWNER_ROLE, CLINICAL_ROLES } from '@/lib/roles'
import { FEED_ACTIONS, type FeedAction } from '@/lib/data/feed-actions'

export interface ActivityFeedItemDTO {
  id: string
  eventTime: string
  action: FeedAction
  actorUserId: string | null
  actorName: string
  athleteId: string | null
  athleteName: string | null
  athletePhotoUrl: string | null
  squadId: string | null
  detail: Record<string, unknown> | null
}

export interface ActivityFeedPageDTO {
  items: ActivityFeedItemDTO[]
  hasMore: boolean
}

export interface GetActivityFeedOptions {
  page?: number
  squadId?: string | null
  athleteId?: string | null
  actions?: FeedAction[] | null
}

const PAGE_SIZE = 25

export async function getClinicalActivityFeed(opts: GetActivityFeedOptions = {}): Promise<ActivityFeedPageDTO> {
  const viewer = await getViewerContext()
  if (!viewer.org?.id || !viewer.role || !(viewer.role === OWNER_ROLE || CLINICAL_ROLES.includes(viewer.role as (typeof CLINICAL_ROLES)[number]))) {
    throw new Error('Forbidden')
  }

  const service = createServiceRoleClient()
  if (!service) throw new Error('Service role not configured')

  const page = opts.page ?? 0
  // Never trust client-supplied action filters beyond the closed allowlist.
  const safeActions = opts.actions?.filter((a) => (FEED_ACTIONS as readonly string[]).includes(a)) ?? null

  const { data, error } = await service.rpc('get_org_activity_feed', {
    p_org_id: viewer.org.id,
    p_limit: PAGE_SIZE + 1, // one extra row to detect hasMore without a second count query
    p_offset: page * PAGE_SIZE,
    p_athlete_id: opts.athleteId ?? null,
    p_squad_id: opts.squadId ?? null,
    p_actions: safeActions && safeActions.length > 0 ? safeActions : null,
  })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{
    event_id: string; event_time: string; action: string; actor_user_id: string | null; actor_name: string
    athlete_id: string | null; athlete_name: string | null; athlete_photo_url: string | null
    squad_id: string | null; detail: Record<string, unknown> | null
  }>
  const hasMore = rows.length > PAGE_SIZE
  const items: ActivityFeedItemDTO[] = rows.slice(0, PAGE_SIZE).map((row) => ({
    id: row.event_id,
    eventTime: row.event_time,
    action: row.action as FeedAction,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    athleteId: row.athlete_id,
    athleteName: row.athlete_name,
    athletePhotoUrl: row.athlete_photo_url,
    squadId: row.squad_id,
    detail: row.detail,
  }))

  return { items, hasMore }
}
