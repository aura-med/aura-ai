import { z } from 'zod'
import { postgresUuidSchema } from './ids'

export const RtpCriterionSchema = z.object({
  label: z.string().min(1),
  done: z.boolean(),
})

export const RtpCriteriaSchema = z.array(RtpCriterionSchema)

export const ClinicalDataUpdateSchema = z.object({
  sessionId: postgresUuidSchema,
  field: z.string().min(1).max(100),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})

export const RtpUpdateSchema = z.object({
  sessionId: postgresUuidSchema,
  criteria: RtpCriteriaSchema,
})

export type RtpUpdateInput = z.infer<typeof RtpUpdateSchema>
export type ClinicalDataUpdateInput = z.infer<typeof ClinicalDataUpdateSchema>
