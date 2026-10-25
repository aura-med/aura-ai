import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/data/auth'
import { asRecordArray, asString } from '@/lib/data/records'
import { clinicalStatus } from '@/lib/data/status'
import type { NotificationDTO, TopbarDTO } from '@/lib/data/types'

function notificationStatus(type: string) {
  if (type === 'score_critical' || type === 'injury_new') return clinicalStatus('red', 'Notificacao urgente')
  if (type === 'score_high' || type === 'checkin_missing' || type === 'readiness_drop') return clinicalStatus('amber', 'Notificacao de atencao')
  return clinicalStatus('green', 'Notificacao informativa')
}

export async function getTopbarDTO(): Promise<TopbarDTO> {
  const viewer = await getViewerContext()
  const supabase = await createClient()
  const { theme: themePreference, defaultSquadId } = await getUserPreferences(supabase, viewer.userId)

  if (!viewer.org?.id) return { ...viewer, notifications: [], unreadNotificationCount: 0, themePreference, defaultSquadId }

  const notificationsQuery = supabase
    .from('notifications')
    .select('id, type, title, body, read_by, created_at')
    .eq('org_id', viewer.org.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const unreadQuery = viewer.userId
    ? supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', viewer.org.id)
        // read_by is nullable — `.not(..., 'cs', ...)` alone evaluates to
        // NULL (not true) for a row with read_by IS NULL, silently
        // excluding it from this count and undercounting unread alerts.
        .or(`read_by.is.null,read_by.not.cs.{${viewer.userId}}`)
    : null

  const [{ data }, unreadResult] = await Promise.all([
    notificationsQuery,
    unreadQuery ?? Promise.resolve({ count: 0 }),
  ])

  const notifications: NotificationDTO[] = asRecordArray(data).map((row) => {
    const type = asString(row.type) ?? 'score_high'
    return {
      id: asString(row.id) ?? '',
      type,
      title: asString(row.title) ?? 'Notificacao',
      body: asString(row.body),
      readBy: Array.isArray(row.read_by) ? row.read_by.filter((id): id is string => typeof id === 'string') : [],
      createdAt: asString(row.created_at) ?? '',
      status: notificationStatus(type),
    }
  }).filter((notification) => notification.id)

  return { ...viewer, notifications, unreadNotificationCount: unreadResult.count ?? 0, themePreference, defaultSquadId }
}

async function getUserPreferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | null,
): Promise<{ theme: 'dark' | 'light' | null; defaultSquadId: string | null }> {
  if (!userId) return { theme: null, defaultSquadId: null }

  const { data } = await supabase
    .from('user_preferences')
    .select('theme, default_squad_id')
    .eq('user_id', userId)
    .limit(1)

  const row = asRecordArray(data)[0]
  const theme = asString(row?.theme)
  return {
    theme: theme === 'dark' || theme === 'light' ? theme : null,
    defaultSquadId: asString(row?.default_squad_id),
  }
}
