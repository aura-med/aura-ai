import { z } from 'zod'

export const ScoreHistorySchema = z.object({
  athlete_id: z.string().uuid(),
  score_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_score: z.number().min(0).max(1),
  confidence: z.enum(['high', 'medium', 'low']),
  acwr_partial: z.number().nullable().optional(),
  hrv_partial: z.number().nullable().optional(),
  fatigue_partial: z.number().nullable().optional(),
  sleep_partial: z.number().nullable().optional(),
  tqr_partial: z.number().nullable().optional(),
  history_partial: z.number().nullable().optional(),
  stress_partial: z.number().nullable().optional(),
  decel_partial: z.number().nullable().optional(),
  days_since_match: z.number().int().nullable().optional(),
})

export type ScoreHistoryInput = z.infer<typeof ScoreHistorySchema>
