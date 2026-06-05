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
  const themePreference = await getThemePreference(supabase, viewer.userId)

  if (!viewer.org?.id) return { ...viewer, notifications: [], themePreference }

  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, read_by, created_at')
    .eq('org_id', viewer.org.id)
    .order('created_at', { ascending: false })
    .limit(50)

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

  return { ...viewer, notifications, themePreference }
}

async function getThemePreference(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | null,
): Promise<'dark' | 'light' | null> {
  if (!userId) return null

  const { data } = await supabase
    .from('user_preferences')
    .select('theme')
    .eq('user_id', userId)
    .limit(1)

  const theme = asString(asRecordArray(data)[0]?.theme)
  return theme === 'dark' || theme === 'light' ? theme : null
}
