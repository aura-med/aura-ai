import { z } from 'zod'

export const RtpCriterionSchema = z.object({
  label: z.string().min(1),
  done: z.boolean(),
})

export const RtpCriteriaSchema = z.array(RtpCriterionSchema)

export const ClinicalDataUpdateSchema = z.object({
  sessionId: z.string().uuid(),
  field: z.string().min(1).max(100),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})

export const RtpUpdateSchema = z.object({
  sessionId: z.string().uuid(),
  criteria: RtpCriteriaSchema,
})

export type RtpUpdateInput = z.infer<typeof RtpUpdateSchema>
export type ClinicalDataUpdateInput = z.infer<typeof ClinicalDataUpdateSchema>
