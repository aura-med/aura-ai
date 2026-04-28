import { createClient } from '@/lib/supabase/client'

export type NotificationType =
  | 'score_critical' | 'score_high' | 'injury_new'
  | 'rehab_update' | 'checkin_missing' | 'rtp_ready' | 'readiness_drop'

export interface Notification {
  id: string
  org_id: string
  squad_id: string | null
  athlete_id: string | null
  type: NotificationType
  title: string
  body: string | null
  metadata: Record<string, unknown>
  read_by: string[]
  created_at: string
}

export async function getNotifications(orgId: string): Promise<Notification[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as Notification[]
}

export async function markAllAsRead(orgId: string, userId: string): Promise<void> {
  const supabase = createClient()
  // Get all unread notification ids
  const { data } = await supabase
    .from('notifications')
    .select('id, read_by')
    .eq('org_id', orgId)
    .not('read_by', 'cs', `{${userId}}`)

  if (!data?.length) return

  // Mark each as read by adding userId to read_by array
  await Promise.all(
    data.map(({ id, read_by }: { id: string; read_by: string[] | null }) =>
      supabase
        .from('notifications')
        .update({ read_by: [...(read_by ?? []), userId] })
        .eq('id', id)
    )
  )
}

export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    score_critical: '🚨',
    score_high: '⚠️',
    injury_new: '🏥',
    rehab_update: '🔄',
    checkin_missing: '📋',
    rtp_ready: '✅',
    readiness_drop: '📉',
  }
  return icons[type]
}

export function getNotificationColor(type: NotificationType): string {
  const colors: Record<NotificationType, string> = {
    score_critical: 'var(--aura-danger)',
    score_high: 'var(--aura-warn)',
    injury_new: 'var(--aura-danger)',
    rehab_update: 'var(--aura-blue)',
    checkin_missing: 'var(--aura-warn)',
    rtp_ready: 'var(--aura-green)',
    readiness_drop: 'var(--aura-warn)',
  }
  return colors[type]
}
