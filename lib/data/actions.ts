'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/data/auth'
import { dataTags } from '@/lib/data/tags'
import { dateOnly, asRecordArray, asString } from '@/lib/data/records'
import { postgresUuidSchema } from '@/lib/schemas/ids'

const uuidSchema = postgresUuidSchema

const wellnessSchema = z.object({
  athleteId: uuidSchema,
  checkinDate: z.string().optional(),
  fatigue: z.number().min(1).max(7).nullable().optional(),
  sleepHours: z.number().min(0).max(24).nullable().optional(),
  tqr: z.number().min(6).max(20).nullable().optional(),
  stress: z.number().min(0).max(10).nullable().optional(),
})

const clinicalFieldSchema = z.enum(['pain_vas', 'strength_pct', 'test_ok', 'balance_s', 'hop_pct', 'vmax_pct'])

export async function upsertWellnessCheckin(input: z.input<typeof wellnessSchema>) {
  const parsed = wellnessSchema.parse(input)
  const supabase = await createClient()

  const { error } = await supabase
    .from('wellness_checkins')
    .upsert({
      athlete_id: parsed.athleteId,
      checkin_date: parsed.checkinDate ?? dateOnly(),
      checkin_type: 'morning',
      fatigue: parsed.fatigue ?? null,
      sleep_hours: parsed.sleepHours ?? null,
      tqr: parsed.tqr ?? null,
      stress: parsed.stress ?? null,
    }, { onConflict: 'athlete_id,checkin_date,checkin_type' })

  if (error) throw new Error(error.message)
  updateTag(dataTags.athleteWellness(parsed.athleteId))
  updateTag(dataTags.athleteReadiness(parsed.athleteId))
  updateTag(dataTags.athlete(parsed.athleteId))
}

export async function toggleRtpCriterion(sessionId: string, index: number, criteria: Array<{ label: string; done: boolean }>) {
  uuidSchema.parse(sessionId)
  const nextCriteria = criteria.map((criterion, i) => i === index ? { ...criterion, done: !criterion.done } : criterion)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rehab_sessions')
    .update({ rtp_criteria: nextCriteria, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select('athlete_id')
    .single()

  if (error) throw new Error(error.message)
  const athleteId = asString(data?.athlete_id)
  if (athleteId) {
    updateTag(dataTags.athleteRehab(athleteId))
    updateTag(dataTags.athlete(athleteId))
  }
}

export async function updateRehabClinicalValue(sessionId: string, field: string, value: number | boolean) {
  uuidSchema.parse(sessionId)
  const parsedField = clinicalFieldSchema.parse(field)
  const supabase = await createClient()

  const { data: current, error: readError } = await supabase
    .from('rehab_sessions')
    .select('athlete_id, clinical_data')
    .eq('id', sessionId)
    .single()

  if (readError) throw new Error(readError.message)

  const clinicalData = current?.clinical_data && typeof current.clinical_data === 'object'
    ? current.clinical_data as Record<string, unknown>
    : {}

  const { error } = await supabase
    .from('rehab_sessions')
    .update({
      clinical_data: { ...clinicalData, [parsedField]: value },
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)
  const athleteId = asString(current?.athlete_id)
  if (athleteId) {
    updateTag(dataTags.athleteRehab(athleteId))
    updateTag(dataTags.athlete(athleteId))
  }
}

export async function updatePassportShare(athleteId: string, isShareable: boolean) {
  uuidSchema.parse(athleteId)
  const supabase = await createClient()

  const { error } = await supabase
    .from('athlete_passport')
    .update({ is_shareable: isShareable, last_updated: new Date().toISOString() })
    .eq('athlete_id', athleteId)

  if (error) throw new Error(error.message)
  updateTag(dataTags.athletePassport(athleteId))
  updateTag(dataTags.athlete(athleteId))
}

export async function markAllNotificationsRead(orgId: string) {
  uuidSchema.parse(orgId)
  const viewer = await getViewerContext()
  if (!viewer.userId || viewer.org?.id !== orgId) return

  const supabase = await createClient()
  const { data } = await supabase
    .from('notifications')
    .select('id')
    .eq('org_id', orgId)
    // read_by is nullable — `.not('read_by', 'cs', ...)` alone evaluates
    // to NULL (not true) for a row with read_by IS NULL, silently
    // excluding it from this list forever, even though mark_notifications_
    // read (077) already handles a null array correctly once given the id.
    .or(`read_by.is.null,read_by.not.cs.{${viewer.userId}}`)

  const ids = asRecordArray(data).map((row) => asString(row.id)).filter((id): id is string => !!id)
  if (ids.length) {
    // mark_notifications_read (077) only ever appends auth.uid() to
    // read_by — notifications has no general UPDATE policy, since that
    // would let any org member rewrite other fields (type/title/body/...)
    // on every notification in the org.
    const { error } = await supabase.rpc('mark_notifications_read', { p_notification_ids: ids })
    if (error) throw new Error(error.message)
  }

  updateTag(dataTags.orgNotifications(orgId))
}
