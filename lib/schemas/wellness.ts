import { z } from 'zod'

export const WellnessCheckinSchema = z.object({
  athlete_id: z.string().uuid(),
  checkin_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  fatigue: z.number().int().min(1).max(10).nullable().optional(),
  sleep_quality: z.number().int().min(1).max(10).nullable().optional(),
  sleep_hours: z.number().min(0).max(24).nullable().optional(),
  hrv_ms: z.number().positive().nullable().optional(),
  tqr: z.number().int().min(6).max(20).nullable().optional(),
  stress: z.number().int().min(1).max(10).nullable().optional(),
  checkin_type: z.enum(['morning', 'post_session']).optional(),
})

export type WellnessCheckinInput = z.infer<typeof WellnessCheckinSchema>
